/****************************************************************************************
 *  pushpinMiddleware.ts
 *
 *  – Single-promise bootstrap (no race conditions)
 *  – Subscribes to device_status_changes, then hydrates online devices
 *  – Registers / unregisters devices in ConnectionManager
 *
 ***************************************************************************************/

import type { Handle } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { getRedisService } from '$lib/server/services/redisService';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { PushpinConnection } from '$lib/server/messaging/connections/pushpin_connection';
import { getAdminPrisma } from '$lib/server/prisma';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';

/****************************************************************************************
 *  Globals
 ***************************************************************************************/
let bootstrapPromise: Promise<void> | null = null;   // guards one-time init
const adminPrisma = getAdminPrisma();

/****************************************************************************************
 *  Middleware – exported
 ***************************************************************************************/
export const pushpinMiddleware: Handle = async ({ event, resolve }) => {
    if (event.locals.redis && !bootstrapPromise) {
        const redisService = getRedisService(event.locals);
        bootstrapPromise = bootstrap(redisService).catch(err => {
            logger.error('[Pushpin] bootstrap failure', err);
            bootstrapPromise = null;          // allow retry on next request
        });
    }
    return resolve(event);
};

/****************************************************************************************
 *  Bootstrap sequence: subscribe first, hydrate second
 ***************************************************************************************/
async function bootstrap(redisService: ReturnType<typeof getRedisService>): Promise<void> {
    logger.info('[Pushpin] Bootstrapping (subscribe + hydrate)');
    await subscribeToDeviceStatusChange(redisService);
    await loadOnlineDevices(redisService);
    logger.info('[Pushpin] Bootstrap finished');
}

/****************************************************************************************
 *  publish — thin wrapper with logging
 ***************************************************************************************/
async function publish(
    redisService: ReturnType<typeof getRedisService>,
    channel: string,
    message: unknown
): Promise<void> {
    logger.debug(`[Pushpin] publish → ${channel}: ${JSON.stringify(message)}`);
    await redisService.publish(channel, JSON.stringify(message));
}

/****************************************************************************************
 *
 *  subscribeToDeviceStatusChange
 *
 *  Accepts payloads like { deviceId | id, status: 'online' | 'offline' }
 *
 ***************************************************************************************/
async function subscribeToDeviceStatusChange(
    redisService: ReturnType<typeof getRedisService>
): Promise<void> {
    const CHANNEL = 'device_status_changes';
    logger.info(`[Pushpin] Subscribing to "${CHANNEL}"`);

    const sub = await redisService.subscribeToChannel(CHANNEL, async (raw: string) => {
        logger.debug(`[Pushpin] raw: ${raw}`);

        const payload = safeParse<Record<string, unknown>>(raw);
        if (!payload) return;

        const deviceId = extractDeviceId(payload);
        const status   = String(payload.status ?? '').toLowerCase();

        if (!deviceId || (status !== 'online' && status !== 'offline')) {
            logger.warn('[Pushpin] invalid payload – ignored');
            return;
        }

        logger.debug(`[Pushpin] ${deviceId} → ${status}`);

        try {
            if (status === 'online') {
                await registerDevice(deviceId, redisService);
            } else {
                await unregisterDevice(deviceId);
            }
        } catch (err: any) {
            logger.error(`[Pushpin] handler error for ${deviceId}: ${err.message}`);
        }
    });

    sub?.on('error', (err: Error) => {
        logger.error(`[Pushpin] Redis sub error: ${err.message}`);
        setTimeout(() => subscribeToDeviceStatusChange(redisService).catch(logger.error), 1000);
    });

    logger.info('[Pushpin] Subscription established');
}

/****************************************************************************************
 *  loadOnlineDevices – one-shot hydration on startup
 ***************************************************************************************/
async function loadOnlineDevices(
    redisService: ReturnType<typeof getRedisService>
): Promise<void> {
    logger.info('[Pushpin] Loading online devices from Redis');
    const keys = await redisService.client.keys('device:*:status');

    const onlineIds = (await Promise.all(
        keys.map(async k => (await redisService.get(k)) === 'online' ? k.split(':')[1] : null)
    )).filter(Boolean) as string[];

    logger.info(`[Pushpin] ${onlineIds.length} devices reported online`);
    for (const id of onlineIds) await registerDevice(id, redisService);
}

/****************************************************************************************
 *  registerDevice – adds into ConnectionManager & DB (id === deviceId)
 ***************************************************************************************/
async function registerDevice(
    deviceId: string,
    redisService: ReturnType<typeof getRedisService>
): Promise<void> {
    if (ConnectionManager.getConnection(deviceId)) return;   // already registered

    const dbDevice = await adminPrisma.device.findFirst({
        where: { id: deviceId },
        include: {
            user: { select: { id: true, email: true, name: true, systemRole: true } }
        }
    });

    if (!dbDevice?.user) {
        logger.warn(`[Pushpin] Device ${deviceId} has no linked user`);
        return;
    }

    const userInfo = {
        id: dbDevice.user.id,
        email: dbDevice.user.email,
        name: dbDevice.user.name,
        systemRole: dbDevice.user.systemRole,
        source: 'apiKey' as const
    };

    const publishFn = (ch: string, msg: unknown) => publish(redisService, ch, msg);

    const meta: ConnectionMeta = {
        id: deviceId,                    // connectionId === deviceId
        userInfo,
        nodeId: process.env.NODE_ID || 'unknown',
        protocol: 'pushpin',
        deviceId,
        connectedAt: Date.now()
    };

    const connection = new PushpinConnection(meta, publishFn);
    ConnectionManager.registerConnection(connection);

    await adminPrisma.device.update({
        where: { id: deviceId },
        data: { connected: true, connectedAt: new Date() }
    });

    await subscriptionRegistry.addSubscription(
        `subscription:device:${deviceId}`,
        `subscriber:connection:${deviceId}`
    );

    logger.info(`[Pushpin] Device ${deviceId} registered`);
}

/****************************************************************************************
 *  unregisterDevice – removes from ConnectionManager & DB
 ***************************************************************************************/
async function unregisterDevice(deviceId: string): Promise<void> {
    if (ConnectionManager.getConnection(deviceId)) {
        ConnectionManager.unregisterConnection(deviceId);
    }

    try {
        await adminPrisma.device.update({
            where: { id: deviceId },
            data: { connected: false }
        });
    } catch (err: any) {
        logger.error(`[Pushpin] DB update failed for ${deviceId}: ${err.message}`);
    }

    logger.info(`[Pushpin] Device ${deviceId} unregistered`);
}

/****************************************************************************************
 *  Utility helpers
 ***************************************************************************************/
function safeParse<T>(raw: string): T | null {
    try   { return JSON.parse(raw) as T; }
    catch { logger.warn('[Pushpin] malformed JSON'); return null; }
}

function extractDeviceId(obj: Record<string, unknown>): string | null {
    const key = Object.keys(obj).find(k =>
        ['deviceid', 'id', 'device_id'].includes(k.toLowerCase())
    );
    return key ? String(obj[key]) : null;
}
