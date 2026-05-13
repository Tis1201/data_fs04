/**
 * MQTT State Reconciliation
 *
 * Reconciles Redis presence + DB state with the actual MQTT broker state.
 * Called on worker startup (and periodically) so we recover gracefully from
 * missed connect/disconnect events while the worker was down.
 *
 * Tier-aware (Option A — typed clientids; see clientIdentity.ts):
 *   - agent  → drives Device.connected + presence:device:<id>:agent:clients
 *   - radar  → drives Controller.connected + presence:controller:<cid>:clients
 *   - other  → ignored for presence
 */

import { logger } from '$lib/server/logger';
import redis from '$lib/server/redis';
import { getAdminPrisma } from '$lib/server/prisma';
import type { PrismaClient } from '@prisma/client';
import { getMqttTransport } from '../core/transport';
import { parseMqttClientId } from './clientIdentity';
import { publishDeviceStatusNotification } from '../handlers/notifications/device_status_publisher';
import { publishControllerStatusNotification } from '../handlers/notifications/controller_status_publisher';

const EMQX_URL = process.env.EMQX_URL || 'http://localhost:18083';
const EMQX_API_KEY = process.env.EMQX_API_KEY || '';
const EMQX_API_SECRET = process.env.EMQX_API_SECRET || '';

/** Parsed broker snapshot, bucketed by tier. */
export type BrokerDevicePresenceSnapshot = {
    /** Device ids that have at least one *agent* session connected to the broker. */
    deviceIds: Set<string>;
    /** deviceId -> connected agent clientids (`device:<id>::agent::<6hex>` or legacy). */
    clientIdsByDevice: Map<string, Set<string>>;
    /** Controller ids that have at least one *radar* (controller) session connected. */
    controllerIds: Set<string>;
    /** controllerId -> connected radar clientids. */
    clientIdsByController: Map<string, Set<string>>;
    /** controllerId -> deviceId, so we can update DB rows safely (`{id, deviceId}`). */
    deviceIdByController: Map<string, string>;
};

const PRESENCE_PIPELINE_CHUNK = 800;

/**
 * Backwards-compatible parser kept for callers who only need a device id from a clientid/username.
 * Internally delegates to the new typed parser.
 */
export function parseDeviceIdFromDeviceClientId(
    clientId: string,
    username?: string | null
): string | null {
    const identity = parseMqttClientId(clientId, username);
    switch (identity.kind) {
        case 'agent':
        case 'radar':
            return identity.deviceId;
        default:
            return null;
    }
}

/**
 * Fetches all device-scoped MQTT sessions from EMQX (paginated) and buckets
 * them by tier so device-vs-controller presence can be reconciled independently.
 */
export async function fetchBrokerDevicePresenceSnapshot(): Promise<BrokerDevicePresenceSnapshot> {
    if (!EMQX_API_KEY || !EMQX_API_SECRET) {
        logger.warn(
            '[MQTT Reconciliation] EMQX_API_KEY / EMQX_API_SECRET not set; broker snapshot will likely fail'
        );
    }
    const auth = Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');
    const deviceIds = new Set<string>();
    const clientIdsByDevice = new Map<string, Set<string>>();
    const controllerIds = new Set<string>();
    const clientIdsByController = new Map<string, Set<string>>();
    const deviceIdByController = new Map<string, string>();

    let page = 1;
    const limit = 10000;
    const maxPages = 20;

    while (page <= maxPages) {
        const response = await fetch(`${EMQX_URL}/api/v5/clients?page=${page}&limit=${limit}`, {
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`EMQX API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const clients = data.data || [];

        if (clients.length === 0) {
            break;
        }

        for (const client of clients) {
            const clientId = client.clientid as string;
            const username = client.username as string | undefined;
            const identity = parseMqttClientId(clientId, username);

            if (identity.kind === 'agent') {
                deviceIds.add(identity.deviceId);
                let bucket = clientIdsByDevice.get(identity.deviceId);
                if (!bucket) {
                    bucket = new Set();
                    clientIdsByDevice.set(identity.deviceId, bucket);
                }
                bucket.add(clientId);
            } else if (identity.kind === 'radar') {
                controllerIds.add(identity.controllerId);
                let bucket = clientIdsByController.get(identity.controllerId);
                if (!bucket) {
                    bucket = new Set();
                    clientIdsByController.set(identity.controllerId, bucket);
                }
                bucket.add(clientId);
                deviceIdByController.set(identity.controllerId, identity.deviceId);
            }
        }

        logger.debug(
            `[MQTT Reconciliation] Page ${page}: ${clients.length} client(s); agents=${deviceIds.size} controllers=${controllerIds.size}`
        );

        if (clients.length < limit) {
            break;
        }
        page++;
    }

    if (page > maxPages) {
        logger.warn(
            `[MQTT Reconciliation] Reached max pagination limit (${maxPages} pages, ${maxPages * limit} clients)`
        );
    }

    logger.info(
        `[MQTT Reconciliation] Broker snapshot: agents=${deviceIds.size}, controllers=${controllerIds.size}`
    );
    return {
        deviceIds,
        clientIdsByDevice,
        controllerIds,
        clientIdsByController,
        deviceIdByController
    };
}

/**
 * Apply broker snapshot to Redis presence keys (agent + controller buckets).
 *
 * Race-safe: never DELs `:clients`. Only SADDs current broker clientids and refreshes TTL.
 * Stale clientids drift out via the per-key TTL refresh cycle and EMQX disconnect events.
 *
 * When `rebuildOnlineSet` is true, replaces both `presence:devices:online` and
 * `presence:controllers:online` (fast startup only).
 */
export async function applyBrokerPresenceToRedis(
    snapshot: BrokerDevicePresenceSnapshot,
    presenceTTL: number,
    options: { rebuildOnlineSet: boolean }
): Promise<void> {
    if (!redis) {
        return;
    }

    // ── Agents ──────────────────────────────────────────────────────────────
    const devicePresenceSetKey = 'presence:devices:online';
    const deviceEntries = Array.from(snapshot.deviceIds).sort();
    let didDelDeviceOnlineSet = false;
    for (let i = 0; i < deviceEntries.length; i += PRESENCE_PIPELINE_CHUNK) {
        const slice = deviceEntries.slice(i, i + PRESENCE_PIPELINE_CHUNK);
        const pipeline = redis.pipeline();

        if (options.rebuildOnlineSet && !didDelDeviceOnlineSet) {
            pipeline.del(devicePresenceSetKey);
            didDelDeviceOnlineSet = true;
        }

        for (const deviceId of slice) {
            const clientsKey = `presence:device:${deviceId}:agent:clients`;
            const clientSet = snapshot.clientIdsByDevice.get(deviceId) ?? new Set<string>();
            for (const cid of clientSet) {
                pipeline.sadd(clientsKey, cid);
            }
            pipeline.expire(clientsKey, presenceTTL);
            pipeline.setex(`presence:device:${deviceId}`, presenceTTL, '1');
            pipeline.sadd(devicePresenceSetKey, deviceId);
        }

        await pipeline.exec();
    }

    // Edge-case: rebuild requested but no agent online → still clear the set.
    if (options.rebuildOnlineSet && !didDelDeviceOnlineSet) {
        await redis.del(devicePresenceSetKey);
    }

    // ── Controllers ─────────────────────────────────────────────────────────
    const controllerPresenceSetKey = 'presence:controllers:online';
    const controllerEntries = Array.from(snapshot.controllerIds).sort();
    let didDelControllerOnlineSet = false;
    for (let i = 0; i < controllerEntries.length; i += PRESENCE_PIPELINE_CHUNK) {
        const slice = controllerEntries.slice(i, i + PRESENCE_PIPELINE_CHUNK);
        const pipeline = redis.pipeline();

        if (options.rebuildOnlineSet && !didDelControllerOnlineSet) {
            pipeline.del(controllerPresenceSetKey);
            didDelControllerOnlineSet = true;
        }

        for (const controllerId of slice) {
            const clientsKey = `presence:controller:${controllerId}:clients`;
            const clientSet = snapshot.clientIdsByController.get(controllerId) ?? new Set<string>();
            for (const cid of clientSet) {
                pipeline.sadd(clientsKey, cid);
            }
            pipeline.expire(clientsKey, presenceTTL);
            pipeline.setex(`presence:controller:${controllerId}`, presenceTTL, '1');
            pipeline.sadd(controllerPresenceSetKey, controllerId);
        }

        await pipeline.exec();
    }

    if (options.rebuildOnlineSet && !didDelControllerOnlineSet) {
        await redis.del(controllerPresenceSetKey);
    }
}

/**
 * Fast startup sync: bulk-refresh Redis presence from MQTT broker.
 * Optimized for speed: only updates Redis (no DB writes, no notifications).
 */
export async function fastStartupSync(): Promise<void> {
    logger.info('[MQTT Fast Sync] Starting fast startup sync...');

    try {
        const snapshot = await fetchBrokerDevicePresenceSnapshot();

        if (snapshot.deviceIds.size === 0 && snapshot.controllerIds.size === 0) {
            logger.info('[MQTT Fast Sync] No agents or controllers connected to broker');
            return;
        }

        if (!redis) {
            logger.warn('[MQTT Fast Sync] Redis not available, skipping sync');
            return;
        }

        const presenceTTL = parseInt(process.env.PRESENCE_TTL || '600', 10);
        await applyBrokerPresenceToRedis(snapshot, presenceTTL, { rebuildOnlineSet: true });

        logger.info(
            `[MQTT Fast Sync] Completed — agents=${snapshot.deviceIds.size}, controllers=${snapshot.controllerIds.size} (TTL=${presenceTTL}s)`
        );
    } catch (error) {
        logger.error(
            `[MQTT Fast Sync] Failed: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
    }
}

/** O(1) read of Redis online sets. Falls back to KEYS scan for legacy keys. */
async function getOnlineFromRedis(setKey: string, legacyKeyPrefix: string): Promise<Set<string>> {
    if (!redis) return new Set();
    try {
        const members = await redis.smembers(setKey);
        if (members && members.length > 0) {
            return new Set(members);
        }
    } catch (err) {
        logger.warn(
            `[MQTT Reconciliation] Failed to fetch ${setKey} as Set, falling back to KEYS scan`,
            { error: err instanceof Error ? err.message : String(err) }
        );
    }

    // Fallback (rare). Returns ids of presence keys whose value is '1'.
    const keys = await redis.keys(`${legacyKeyPrefix}*`);
    const ids = new Set<string>();
    for (const key of keys) {
        if (key.endsWith(':clients') || key.endsWith(':agent:clients')) continue;
        const id = key.replace(legacyKeyPrefix, '');
        if (id.includes(':')) continue; // ignore namespaced sub-keys
        const present = await redis.get(key);
        if (present === '1') ids.add(id);
    }
    return ids;
}

/**
 * Reconcile Redis + DB with the actual MQTT broker state.
 * Sends connect/disconnect notifications to the UI for any state changes.
 */
export async function reconcileDevicePresence(): Promise<void> {
    logger.info('[MQTT Reconciliation] Starting presence reconciliation...');
    const adminPrisma = getAdminPrisma();
    const transport = getMqttTransport();
    if (!transport) {
        logger.warn('[MQTT Reconciliation] MQTT transport not available; will skip notifications');
    }

    try {
        const snapshot = await fetchBrokerDevicePresenceSnapshot();
        const presenceTTL = parseInt(process.env.PRESENCE_TTL || '600', 10);

        // ── Devices (agent tier) ────────────────────────────────────────────
        const brokerDevices = snapshot.deviceIds;
        const redisDevices = await getOnlineFromRedis('presence:devices:online', 'presence:device:');
        const staleDevices = Array.from(redisDevices).filter((id) => !brokerDevices.has(id));
        const missingDevices = Array.from(brokerDevices).filter((id) => !redisDevices.has(id));

        // ── Controllers (radar tier) ────────────────────────────────────────
        const brokerControllers = snapshot.controllerIds;
        const redisControllers = await getOnlineFromRedis(
            'presence:controllers:online',
            'presence:controller:'
        );
        const staleControllers = Array.from(redisControllers).filter(
            (id) => !brokerControllers.has(id)
        );
        const missingControllers = Array.from(brokerControllers).filter(
            (id) => !redisControllers.has(id)
        );

        logger.info(
            `[MQTT Reconciliation] Diffs: devices stale=${staleDevices.length} missing=${missingDevices.length}; controllers stale=${staleControllers.length} missing=${missingControllers.length}`
        );

        // 1. Sync Redis presence + per-key client sets from broker (covers missing buckets too).
        if (redis) {
            try {
                await applyBrokerPresenceToRedis(snapshot, presenceTTL, { rebuildOnlineSet: false });
                const pipeline = redis.pipeline();
                pipeline.expire('presence:devices:online', presenceTTL);
                pipeline.expire('presence:controllers:online', presenceTTL);
                await pipeline.exec();
            } catch (err) {
                logger.error(
                    `[MQTT Reconciliation] Failed to refresh Redis presence: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        // 2. Devices: drop stale Redis entries + flip DB offline + notify.
        if (staleDevices.length > 0) {
            await dropStaleDevicePresence(staleDevices);
            await markDevicesOfflineInDbAndNotify(adminPrisma, staleDevices);
        }
        if (missingDevices.length > 0) {
            await markDevicesOnlineInDbAndNotify(adminPrisma, missingDevices);
        }

        // 3. Make sure DB matches broker for *every* device the broker reports
        //    (catches the case where Redis already had the key but DB drifted).
        if (brokerDevices.size > 0) {
            await reconcileDeviceDbSync(adminPrisma, brokerDevices, missingDevices);
        }

        // 4. Controllers: drop stale Redis entries + flip DB offline + notify.
        if (staleControllers.length > 0) {
            await dropStaleControllerPresence(staleControllers);
            await markControllersOfflineInDbAndNotify(adminPrisma, staleControllers);
        }
        if (missingControllers.length > 0) {
            await markControllersOnlineInDbAndNotify(
                adminPrisma,
                missingControllers,
                snapshot.deviceIdByController
            );
        }
        if (brokerControllers.size > 0) {
            await reconcileControllerDbSync(
                adminPrisma,
                brokerControllers,
                snapshot.deviceIdByController,
                missingControllers
            );
        }

        logger.info(
            `[MQTT Reconciliation] Completed: device-changes (offline=${staleDevices.length}, online=${missingDevices.length}); controller-changes (offline=${staleControllers.length}, online=${missingControllers.length})`
        );
    } catch (error) {
        logger.error(
            `[MQTT Reconciliation] Failed: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Device (agent) helpers
// ────────────────────────────────────────────────────────────────────────────

async function dropStaleDevicePresence(deviceIds: string[]): Promise<void> {
    if (!redis || deviceIds.length === 0) return;
    const pipeline = redis.pipeline();
    for (const deviceId of deviceIds) {
        pipeline.del(`presence:device:${deviceId}`);
        pipeline.del(`presence:device:${deviceId}:agent:clients`);
        pipeline.del(`presence:device:${deviceId}:clients`); // legacy key cleanup
        pipeline.srem('presence:devices:online', deviceId);
    }
    await pipeline.exec();
    logger.info(`[MQTT Reconciliation] Removed ${deviceIds.length} stale device(s) from Redis`);
}

async function markDevicesOfflineInDbAndNotify(
    prisma: PrismaClient,
    deviceIds: string[]
): Promise<void> {
    const now = new Date();
    await prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { connected: false, disconnectedAt: now }
    });
    logger.info(`[MQTT Reconciliation] DB: marked ${deviceIds.length} device(s) offline`);

    for (const deviceId of deviceIds) {
        try {
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                select: { id: true, name: true, accountId: true, createdBy: true }
            });
            if (!device) continue;
            await publishDeviceStatusNotification({
                prisma,
                device,
                connected: false,
                timestamp: now.toISOString(),
                reason: 'Reconciliation - device was offline while worker was down'
            });
        } catch (err) {
            logger.error(
                `[MQTT Reconciliation] Notify (offline) failed for device ${deviceId}: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }
}

async function markDevicesOnlineInDbAndNotify(
    prisma: PrismaClient,
    deviceIds: string[]
): Promise<void> {
    const now = new Date();
    await prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { connected: true, connectedAt: now }
    });
    logger.info(`[MQTT Reconciliation] DB: marked ${deviceIds.length} device(s) online`);

    for (const deviceId of deviceIds) {
        try {
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                select: { id: true, name: true, accountId: true, createdBy: true }
            });
            if (!device) continue;
            await publishDeviceStatusNotification({
                prisma,
                device,
                connected: true,
                timestamp: now.toISOString()
            });
        } catch (err) {
            logger.error(
                `[MQTT Reconciliation] Notify (online) failed for device ${deviceId}: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }
}

/** Catch DB drift: any device the broker reports online but DB still says offline. */
async function reconcileDeviceDbSync(
    prisma: PrismaClient,
    brokerDevices: Set<string>,
    alreadyHandled: string[]
): Promise<void> {
    const handledSet = new Set(alreadyHandled);
    const candidates = Array.from(brokerDevices).filter((id) => !handledSet.has(id));
    if (candidates.length === 0) return;

    const dbRows = await prisma.device.findMany({
        where: { id: { in: candidates } },
        select: { id: true, connected: true }
    });
    const drift = dbRows.filter((d) => !d.connected).map((d) => d.id);
    if (drift.length === 0) return;

    await markDevicesOnlineInDbAndNotify(prisma, drift);
}

// ────────────────────────────────────────────────────────────────────────────
// Controller (radar) helpers
// ────────────────────────────────────────────────────────────────────────────

async function dropStaleControllerPresence(controllerIds: string[]): Promise<void> {
    if (!redis || controllerIds.length === 0) return;
    const pipeline = redis.pipeline();
    for (const controllerId of controllerIds) {
        pipeline.del(`presence:controller:${controllerId}`);
        pipeline.del(`presence:controller:${controllerId}:clients`);
        pipeline.srem('presence:controllers:online', controllerId);
    }
    await pipeline.exec();
    logger.info(`[MQTT Reconciliation] Removed ${controllerIds.length} stale controller(s) from Redis`);
}

async function markControllersOfflineInDbAndNotify(
    prisma: PrismaClient,
    controllerIds: string[]
): Promise<void> {
    const now = new Date();
    await prisma.controller.updateMany({
        where: { id: { in: controllerIds } },
        data: { connected: false, disconnectedAt: now }
    });
    logger.info(`[MQTT Reconciliation] DB: marked ${controllerIds.length} controller(s) offline`);

    for (const controllerId of controllerIds) {
        try {
            const controller = await prisma.controller.findUnique({
                where: { id: controllerId },
                select: { id: true, type: true, deviceId: true }
            });
            if (!controller) continue;
            await publishControllerStatusNotification({
                prisma,
                deviceId: controller.deviceId,
                controllerId,
                controllerType: controller.type ?? 'radar',
                connected: false,
                timestamp: now.toISOString(),
                reason: 'Reconciliation - controller was offline while worker was down'
            });
        } catch (err) {
            logger.error(
                `[MQTT Reconciliation] Notify (offline) failed for controller ${controllerId}: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }
}

async function markControllersOnlineInDbAndNotify(
    prisma: PrismaClient,
    controllerIds: string[],
    deviceIdByController: Map<string, string>
): Promise<void> {
    const now = new Date();
    await prisma.controller.updateMany({
        where: { id: { in: controllerIds } },
        data: { connected: true, connectedAt: now }
    });
    logger.info(`[MQTT Reconciliation] DB: marked ${controllerIds.length} controller(s) online`);

    for (const controllerId of controllerIds) {
        try {
            const controller = await prisma.controller.findUnique({
                where: { id: controllerId },
                select: { id: true, type: true, deviceId: true }
            });
            if (!controller) continue;
            await publishControllerStatusNotification({
                prisma,
                deviceId: deviceIdByController.get(controllerId) ?? controller.deviceId,
                controllerId,
                controllerType: controller.type ?? 'radar',
                connected: true,
                timestamp: now.toISOString()
            });
        } catch (err) {
            logger.error(
                `[MQTT Reconciliation] Notify (online) failed for controller ${controllerId}: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }
}

async function reconcileControllerDbSync(
    prisma: PrismaClient,
    brokerControllers: Set<string>,
    deviceIdByController: Map<string, string>,
    alreadyHandled: string[]
): Promise<void> {
    const handledSet = new Set(alreadyHandled);
    const candidates = Array.from(brokerControllers).filter((id) => !handledSet.has(id));
    if (candidates.length === 0) return;

    const dbRows = await prisma.controller.findMany({
        where: { id: { in: candidates } },
        select: { id: true, connected: true }
    });
    const drift = dbRows.filter((c) => !c.connected).map((c) => c.id);
    if (drift.length === 0) return;

    await markControllersOnlineInDbAndNotify(prisma, drift, deviceIdByController);
}
