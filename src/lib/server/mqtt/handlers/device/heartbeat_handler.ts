/**
 * MQTT Device Heartbeat Handler
 *
 * Processes heartbeats from devices (e.g. fs04_device_linux) published to
 * device/{deviceId}/heartbeat. Batches updates and flushes to Redis + Postgres
 * for Last ping / presence tracking. Uses Postgres lastUsedAt (not ClickHouse)
 * to avoid inserting rows with empty os_version, model, etc. that overwrite
 * richer data from HTTP heartbeat. Designed for 100k+ devices.
 */

import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import redis from '$lib/server/redis';

const FLUSH_INTERVAL_MS = Math.max(5000, parseInt(process.env.MQTT_HEARTBEAT_FLUSH_INTERVAL_MS || '120000', 10) || 120000); // 2 min default
const PRESENCE_TTL = parseInt(process.env.PRESENCE_TTL || '600', 10) || 600;
const CLOCK_SKEW_MAX_FUTURE_MS = 5 * 60 * 1000; // 5 min - reject device timestamps too far in future

interface HeartbeatEntry {
    lastPingAt: Date;
}

const batch = new Map<string, HeartbeatEntry>();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

/**
 * Extract deviceId from topic device/{subject}/heartbeat.
 * Subject is "device:{deviceId}" for claimed devices, "factory:{pin}" for unclaimed.
 * We only process claimed devices - connection_handler does not set presence for factory.
 */
function extractDeviceIdFromTopic(topic: string): string | null {
    // device/device:abc123/heartbeat -> deviceId = abc123
    // device/factory:pin123/heartbeat -> return null (skip factory)
    const match = topic.match(/^device\/([^/]+)\/heartbeat$/);
    if (!match) return null;
    const subject = match[1];
    if (subject.startsWith('factory:')) return null;
    return subject.startsWith('device:') ? subject.slice('device:'.length) : subject;
}

/**
 * Add a heartbeat to the batch (keeps latest per device).
 */
export function addHeartbeat(deviceId: string, lastPingAt: Date): void {
    const existing = batch.get(deviceId);
    if (!existing || lastPingAt > existing.lastPingAt) {
        batch.set(deviceId, { lastPingAt });
    }
}

/**
 * Flush batch: Redis presence + Postgres lastUsedAt.
 * Uses Postgres (not ClickHouse) to avoid inserting empty rows that overwrite
 * os_version, model, cpu_usage etc. from HTTP heartbeat. Guard prevents
 * overlapping flushes when interval < flush duration.
 */
async function flushBatch(prisma: PrismaClient): Promise<void> {
    if (flushing) return;
    const deviceIds = Array.from(batch.keys());
    if (deviceIds.length === 0) return;

    flushing = true;
    batch.clear();
    const startMs = Date.now();
    const now = new Date();

    try {
        // 1. Redis: update presence for all devices (pipeline for performance)
        const REDIS_CHUNK_SIZE = 5000;
        if (redis) {
            const presenceSetKey = 'presence:devices:online';
            let redisErrors = 0;
            for (let i = 0; i < deviceIds.length; i += REDIS_CHUNK_SIZE) {
                const chunk = deviceIds.slice(i, i + REDIS_CHUNK_SIZE);
                const pipeline = redis.pipeline();
                for (const deviceId of chunk) {
                    pipeline.setex(`presence:device:${deviceId}`, PRESENCE_TTL, '1');
                    pipeline.sadd(presenceSetKey, deviceId);
                }
                const results = await pipeline.exec();
                const failed = results?.filter(([err]) => err) ?? [];
                if (failed.length > 0) {
                    redisErrors += failed.length;
                    logger.warn(`[MQTT Heartbeat] Redis pipeline errors: ${failed.length}/${chunk.length}`, {
                        errors: failed.slice(0, 3).map(([e]) => (e as Error)?.message)
                    });
                }
            }
            logger.debug(
                `[MQTT Heartbeat] Flushed Redis presence for ${deviceIds.length} devices` +
                    (redisErrors > 0 ? ` (${redisErrors} errors)` : '')
            );
        }

        // 2. Postgres: batch update lastUsedAt (Last ping). Chunk to avoid query size limits.
        const PG_CHUNK_SIZE = 5000;
        let pgUpdated = 0;
        for (let i = 0; i < deviceIds.length; i += PG_CHUNK_SIZE) {
            const chunk = deviceIds.slice(i, i + PG_CHUNK_SIZE);
            const result = await prisma.device.updateMany({
                where: { id: { in: chunk } },
                data: { lastUsedAt: now }
            });
            pgUpdated += result.count;
        }
        const durationMs = Date.now() - startMs;
        const slowFlush = durationMs > FLUSH_INTERVAL_MS * 0.8;
        logger.info(
            `[MQTT Heartbeat] Flushed Redis + Postgres lastUsedAt for ${deviceIds.length} devices (updated=${pgUpdated}, total=${durationMs}ms)` +
                (slowFlush ? ' [WARN: flush near/over interval]' : '')
        );
        if (slowFlush) {
            logger.warn(`[MQTT Heartbeat] Flush duration ${durationMs}ms approaches interval ${FLUSH_INTERVAL_MS}ms - consider scaling workers`);
        }
    } catch (err) {
        logger.error(`[MQTT Heartbeat] Flush failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        flushing = false;
    }
}

/**
 * Start the periodic flush timer.
 */
function ensureFlushTimer(prisma: PrismaClient): void {
    if (flushTimer) return;
    flushTimer = setInterval(() => {
        flushBatch(prisma);
    }, FLUSH_INTERVAL_MS);
    logger.info(`[MQTT Heartbeat] Flush timer started (interval=${FLUSH_INTERVAL_MS}ms)`);
}

/**
 * Handle incoming MQTT heartbeat message.
 * Topic: device/{deviceId}/heartbeat or device/device:{deviceId}/heartbeat
 * Payload: typically { "timestamp": "2026-03-17T12:00:00Z" } or minimal
 */
export async function handleHeartbeatMessage(
    topic: string,
    payload: Buffer,
    prisma: PrismaClient
): Promise<void> {
    const deviceId = extractDeviceIdFromTopic(topic);
    if (!deviceId) {
        // Expected for factory devices (device/factory:xxx/heartbeat) - skip silently
        if (!topic.includes('factory:')) {
            logger.warn(`[MQTT Heartbeat] Could not extract deviceId from topic: ${topic}`);
        }
        return;
    }

    const serverNow = new Date();
    let lastPingAt = serverNow;
    try {
        const raw = payload.toString('utf8');
        const data = JSON.parse(raw);
        if (data.timestamp) {
            const ts = new Date(data.timestamp);
            if (!isNaN(ts.getTime())) {
                // Reject future timestamps beyond clock skew (device clock drift)
                if (ts.getTime() <= serverNow.getTime() + CLOCK_SKEW_MAX_FUTURE_MS) {
                    lastPingAt = ts;
                }
            }
        }
    } catch {
        // Use server time if payload not parseable
    }

    addHeartbeat(deviceId, lastPingAt);
    ensureFlushTimer(prisma);
}
