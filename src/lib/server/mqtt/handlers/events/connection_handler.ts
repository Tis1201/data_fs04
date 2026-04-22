import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import redis from '$lib/server/redis';
import { publishDeviceStatusNotification } from '../notifications/device_status_publisher';
import { publishControllerStatusNotification } from '../notifications/controller_status_publisher';
import {
    parseMqttClientId,
    type MqttClientIdentity
} from '$lib/server/mqtt/utils/clientIdentity';

/**
 * EMQX `$events/client/connected` and `.../disconnected` handler.
 *
 * Routing uses typed `clientid`s ({@link parseMqttClientId}): `agent` updates the RDM
 * device session (`Device`, `device:*` notifications); `radar` updates the controller bridge
 * (`Controller`, `controller:*`). Other tiers only write `mqttConnection` audit rows.
 */
export async function handleConnectionEvent(
    topic: string,
    payload: Buffer,
    prisma: PrismaClient
): Promise<void> {
    const rawEvent = payload.toString('utf8');
    const parsedEvent = parseEmqxEvent(rawEvent);
    const {
        clientId,
        username,
        reason,
        node,
        connectedAtMs,
        disconnectedAtMs
    } = parsedEvent;

    if (!clientId) {
        logger.warn('[MQTT Events] Connection event missing clientid; ignoring', { topic });
        return;
    }

    const isConnectEvent =
        topic === '$events/client/connected' ||
        topic === '$events/client/connected/' ||
        topic === '$events/client_connected';

    const eventTimestampMs = isConnectEvent
        ? connectedAtMs ?? disconnectedAtMs
        : disconnectedAtMs ?? connectedAtMs;
    const eventDate =
        typeof eventTimestampMs === 'number' && !Number.isNaN(eventTimestampMs)
            ? new Date(eventTimestampMs)
            : new Date();

    const identity = parseMqttClientId(clientId, username);
    const auditKind = identityToAuditKind(identity);

    // 1. Audit row first — survives any downstream branch failure.
    await upsertMqttConnectionRow({
        prisma,
        clientId,
        username,
        kind: auditKind,
        isConnectEvent,
        eventDate,
        reason,
        node
    });

    // 2. Tier-specific presence + business state.
    switch (identity.kind) {
        case 'agent':
            await handleAgentEvent({
                prisma,
                identity,
                clientId,
                username,
                isConnectEvent,
                eventDate,
                reason
            });
            break;
        case 'radar':
            await handleRadarEvent({
                prisma,
                identity,
                clientId,
                username,
                isConnectEvent,
                eventDate,
                reason
            });
            break;
        case 'user':
        case 'factory':
        case 'server':
        case 'unknown':
            // No presence keys / DB writes for these; the audit row above is sufficient.
            break;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Agent flow (RDM / Linux device agent)
// ────────────────────────────────────────────────────────────────────────────

const AGENT_PRESENCE_TTL_FALLBACK = 600;

async function handleAgentEvent(args: {
    prisma: PrismaClient;
    identity: Extract<MqttClientIdentity, { kind: 'agent' }>;
    clientId: string;
    username: string;
    isConnectEvent: boolean;
    eventDate: Date;
    reason: string;
}): Promise<void> {
    const { prisma, identity, clientId, username, isConnectEvent, eventDate, reason } = args;
    const { deviceId } = identity;

    const presence = await updateAgentPresence({
        deviceId,
        clientId,
        isConnectEvent
    });

    if (isConnectEvent) {
        await prisma.device.updateMany({
            where: { id: deviceId },
            data: { connected: true, connectedAt: eventDate }
        });
        logger.info('[MQTT Events] Agent connected', { deviceId, username, clientId, legacy: identity.legacy });

        const deviceRecord = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { id: true, name: true, accountId: true, createdBy: true }
        });
        if (deviceRecord) {
            await publishDeviceStatusNotification({
                prisma,
                device: deviceRecord,
                connected: true,
                timestamp: eventDate.toISOString()
            });
        }

        // Auto-sync: Push pending configs for this device's sensors (kept from previous behaviour).
        await autoSyncPendingSensorConfigs(prisma, deviceId);
        return;
    }

    if (presence === 'sessions-remain') {
        logger.info(
            '[MQTT Events] Agent MQTT session ended; other agent session(s) still active — skipping Device.connected=false',
            { deviceId, username, clientId, reason }
        );
        return;
    }

    await prisma.device.updateMany({
        where: { id: deviceId },
        data: { connected: false, disconnectedAt: eventDate }
    });
    logger.info('[MQTT Events] Agent disconnected', { deviceId, username, clientId, reason });

    const deviceRecord = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { id: true, name: true, accountId: true, createdBy: true }
    });
    if (deviceRecord) {
        await publishDeviceStatusNotification({
            prisma,
            device: deviceRecord,
            connected: false,
            timestamp: eventDate.toISOString(),
            reason
        });
    }
}

/**
 * Update the agent's per-device presence set and return whether any sessions remain.
 *
 * Returns:
 *  - 'connect'         on connect events (no count meaning)
 *  - 'sessions-remain' on disconnect when ≥1 agent sessions are still tracked
 *  - 'last-session'    on disconnect when this was the last agent session
 *  - 'redis-unavailable' when Redis is down (fail-safe: caller treats as last-session)
 */
async function updateAgentPresence(args: {
    deviceId: string;
    clientId: string;
    isConnectEvent: boolean;
}): Promise<'connect' | 'sessions-remain' | 'last-session' | 'redis-unavailable'> {
    const { deviceId, clientId, isConnectEvent } = args;
    if (!redis) {
        return isConnectEvent ? 'connect' : 'redis-unavailable';
    }

    const presenceKey = `presence:device:${deviceId}`;
    const agentClientsKey = `presence:device:${deviceId}:agent:clients`;
    const presenceSetKey = 'presence:devices:online';
    const presenceTTL = parseInt(process.env.PRESENCE_TTL || String(AGENT_PRESENCE_TTL_FALLBACK), 10);

    try {
        if (isConnectEvent) {
            const pipeline = redis.pipeline();
            pipeline.sadd(agentClientsKey, clientId);
            pipeline.expire(agentClientsKey, presenceTTL);
            pipeline.setex(presenceKey, presenceTTL, '1');
            pipeline.sadd(presenceSetKey, deviceId);
            await pipeline.exec();
            logger.debug(
                `[MQTT Presence] Agent for device ${deviceId} marked online (clientId=${clientId}, TTL: ${presenceTTL}s)`
            );
            return 'connect';
        }

        const pipeline = redis.pipeline();
        pipeline.srem(agentClientsKey, clientId);
        pipeline.scard(agentClientsKey);
        const results = await pipeline.exec();
        const remaining = (results?.[1]?.[1] as number) ?? 0;

        if (remaining > 0) {
            logger.debug(
                `[MQTT Presence] Device ${deviceId} still has ${remaining} agent connection(s), staying online`
            );
            return 'sessions-remain';
        }

        await redis
            .multi()
            .del(presenceKey)
            .srem(presenceSetKey, deviceId)
            .del(agentClientsKey)
            .exec();
        logger.debug(`[MQTT Presence] Device ${deviceId} agent fully offline (last session: ${clientId})`);
        return 'last-session';
    } catch (err) {
        logger.error(`[MQTT Presence] Failed to update agent presence for device ${deviceId}:`, {
            error: err instanceof Error ? err.message : String(err)
        });
        return isConnectEvent ? 'connect' : 'redis-unavailable';
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Radar (controller) flow
// ────────────────────────────────────────────────────────────────────────────

async function handleRadarEvent(args: {
    prisma: PrismaClient;
    identity: Extract<MqttClientIdentity, { kind: 'radar' }>;
    clientId: string;
    username: string;
    isConnectEvent: boolean;
    eventDate: Date;
    reason: string;
}): Promise<void> {
    const { prisma, identity, clientId, username, isConnectEvent, eventDate, reason } = args;
    const { deviceId, controllerId } = identity;

    const presence = await updateRadarPresence({
        controllerId,
        clientId,
        isConnectEvent
    });

    if (isConnectEvent) {
        // Mark the controller online; tolerate the case where the controller row is gone
        // (e.g. soft-deleted) without aborting — presence is still tracked in Redis.
        const updated = await prisma.controller.updateMany({
            where: { id: controllerId, deviceId },
            data: { connected: true, connectedAt: eventDate }
        });
        if (updated.count === 0) {
            logger.warn(
                `[MQTT Events] Radar connect for unknown/deleted controller ${controllerId} on device ${deviceId}; presence updated but DB skipped`
            );
            return;
        }
        logger.info('[MQTT Events] Radar bridge connected', {
            deviceId,
            controllerId,
            clientId,
            username
        });
        await publishControllerStatusNotification({
            prisma,
            deviceId,
            controllerId,
            controllerType: 'radar',
            connected: true,
            timestamp: eventDate.toISOString()
        });
        return;
    }

    if (presence === 'sessions-remain') {
        logger.info(
            '[MQTT Events] Radar MQTT session ended; other radar session(s) still active — skipping Controller.connected=false',
            { deviceId, controllerId, clientId, reason }
        );
        return;
    }

    const updated = await prisma.controller.updateMany({
        where: { id: controllerId, deviceId },
        data: { connected: false, disconnectedAt: eventDate }
    });
    if (updated.count === 0) {
        logger.warn(
            `[MQTT Events] Radar disconnect for unknown/deleted controller ${controllerId} on device ${deviceId}; DB skipped`
        );
        return;
    }
    logger.info('[MQTT Events] Radar bridge disconnected', {
        deviceId,
        controllerId,
        clientId,
        reason
    });
    await publishControllerStatusNotification({
        prisma,
        deviceId,
        controllerId,
        controllerType: 'radar',
        connected: false,
        timestamp: eventDate.toISOString(),
        reason
    });
}

async function updateRadarPresence(args: {
    controllerId: string;
    clientId: string;
    isConnectEvent: boolean;
}): Promise<'connect' | 'sessions-remain' | 'last-session' | 'redis-unavailable'> {
    const { controllerId, clientId, isConnectEvent } = args;
    if (!redis) {
        return isConnectEvent ? 'connect' : 'redis-unavailable';
    }

    const presenceKey = `presence:controller:${controllerId}`;
    const clientsKey = `presence:controller:${controllerId}:clients`;
    const onlineSetKey = 'presence:controllers:online';
    const presenceTTL = parseInt(process.env.PRESENCE_TTL || String(AGENT_PRESENCE_TTL_FALLBACK), 10);

    try {
        if (isConnectEvent) {
            const pipeline = redis.pipeline();
            pipeline.sadd(clientsKey, clientId);
            pipeline.expire(clientsKey, presenceTTL);
            pipeline.setex(presenceKey, presenceTTL, '1');
            pipeline.sadd(onlineSetKey, controllerId);
            await pipeline.exec();
            logger.debug(
                `[MQTT Presence] Controller ${controllerId} marked online (clientId=${clientId}, TTL: ${presenceTTL}s)`
            );
            return 'connect';
        }

        const pipeline = redis.pipeline();
        pipeline.srem(clientsKey, clientId);
        pipeline.scard(clientsKey);
        const results = await pipeline.exec();
        const remaining = (results?.[1]?.[1] as number) ?? 0;

        if (remaining > 0) {
            logger.debug(
                `[MQTT Presence] Controller ${controllerId} still has ${remaining} connection(s), staying online`
            );
            return 'sessions-remain';
        }

        await redis
            .multi()
            .del(presenceKey)
            .srem(onlineSetKey, controllerId)
            .del(clientsKey)
            .exec();
        logger.debug(`[MQTT Presence] Controller ${controllerId} fully offline (last session: ${clientId})`);
        return 'last-session';
    } catch (err) {
        logger.error(`[MQTT Presence] Failed to update controller presence for ${controllerId}:`, {
            error: err instanceof Error ? err.message : String(err)
        });
        return isConnectEvent ? 'connect' : 'redis-unavailable';
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Audit row (mqttConnection)
// ────────────────────────────────────────────────────────────────────────────

async function upsertMqttConnectionRow(args: {
    prisma: PrismaClient;
    clientId: string;
    username: string;
    kind: string;
    isConnectEvent: boolean;
    eventDate: Date;
    reason: string;
    node: string | null;
}): Promise<void> {
    const { prisma, clientId, username, kind, isConnectEvent, eventDate, reason, node } = args;

    if (isConnectEvent) {
        await prisma.mqttConnection.upsert({
            where: { clientId },
            create: {
                clientId,
                username,
                kind,
                status: 'CONNECTED',
                connectedAt: eventDate,
                disconnectedAt: null,
                lastEventAt: eventDate,
                node: node ?? undefined,
                reason: null
            },
            update: {
                username,
                kind,
                status: 'CONNECTED',
                connectedAt: eventDate,
                disconnectedAt: null,
                lastEventAt: eventDate,
                node: node ?? undefined,
                reason: null
            }
        });
        return;
    }

    await prisma.mqttConnection.upsert({
        where: { clientId },
        create: {
            clientId,
            username,
            kind,
            status: 'DISCONNECTED',
            connectedAt: eventDate,
            disconnectedAt: eventDate,
            lastEventAt: eventDate,
            node: node ?? undefined,
            reason: reason || null
        },
        update: {
            username,
            kind,
            status: 'DISCONNECTED',
            disconnectedAt: eventDate,
            lastEventAt: eventDate,
            node: node ?? undefined,
            reason: reason || null
        }
    });
}

function identityToAuditKind(identity: MqttClientIdentity): string {
    switch (identity.kind) {
        case 'agent':
        case 'radar':
            return 'device'; // both share the device:* MQTT username
        case 'user':
            return 'user';
        case 'factory':
            return 'factory';
        case 'server':
            return 'server';
        case 'unknown':
            return 'other';
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Auto-sync: kept verbatim from previous handler (radar config push on agent connect)
// ────────────────────────────────────────────────────────────────────────────

async function autoSyncPendingSensorConfigs(prisma: PrismaClient, deviceId: string): Promise<void> {
    try {
        const pendingSensors = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
            SELECT s.id, s.name
            FROM "Sensor" s
            JOIN "Controller" c ON s."controllerId" = c.id
            WHERE c."deviceId" = ${deviceId}
            AND s."syncStatus" = 'PENDING'
        `;

        if (pendingSensors.length === 0) return;

        logger.info(
            `[MQTT Events] Auto-syncing ${pendingSensors.length} pending configs for device ${deviceId}`
        );

        const { handleSensorConfigPush } = await import('../web/handle_sensor_config');

        for (const sensor of pendingSensors) {
            try {
                const args = {
                    prisma,
                    sub: `device:${deviceId}`,
                    topic: '$system/auto-sync',
                    requestId: `auto-sync-${sensor.id}`,
                    op: 'sensor.config.push',
                    params: { sensorId: sensor.id }
                };
                await handleSensorConfigPush({ sensorId: sensor.id }, args);
                logger.info(`[MQTT Events] Auto-synced config for sensor ${sensor.name}`);
            } catch (err) {
                logger.warn(`[MQTT Events] Auto-sync failed for sensor ${sensor.name}:`, err);
            }
        }
    } catch (err) {
        logger.warn('[MQTT Events] Failed to check for pending configs:', err);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Raw EMQX event parsing (handles both JSON and Erlang-map style payloads)
// ────────────────────────────────────────────────────────────────────────────

type ParsedEmqxEvent = {
    clientId: string;
    username: string;
    reason: string;
    node: string | null;
    connectedAtMs: number | null;
    disconnectedAtMs: number | null;
};

function parseEmqxEvent(rawEvent: string): ParsedEmqxEvent {
    let eventData: Record<string, unknown> | null = null;
    try {
        // EMQX Erlang-map style payloads aren't valid JSON; JSON.parse will throw and we fall through.
        eventData = JSON.parse(rawEvent) as Record<string, unknown>;
    } catch {
        eventData = null;
    }

    const pickString = (key: string): string => {
        const v = eventData?.[key];
        if (typeof v === 'string') return v;
        const m = rawEvent.match(new RegExp(`${key}:\\s*"([^\"]+)"`));
        return m ? m[1] : '';
    };

    const pickNumber = (key: string): number | null => {
        const v = eventData?.[key];
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && v.length > 0 && !Number.isNaN(Number(v))) return Number(v);
        const m = rawEvent.match(new RegExp(`${key}:\\s*"?(\\d+)"?`));
        return m ? Number(m[1]) : null;
    };

    let clientId = pickString('clientid');
    let username = pickString('username');
    const reason = pickString('reason');
    const nodeStr = pickString('node');

    // Derive username from clientId if missing (legacy fallback).
    if (!username && clientId.startsWith('device:')) {
        username = clientId.split('_')[0]?.split('::')[0] ?? '';
    }
    if (!username && clientId.startsWith('user:')) {
        username = clientId.split('_')[0]?.split('::')[0] ?? '';
    }

    return {
        clientId,
        username,
        reason,
        node: nodeStr || null,
        connectedAtMs: pickNumber('connected_at'),
        disconnectedAtMs: pickNumber('disconnected_at')
    };
}
