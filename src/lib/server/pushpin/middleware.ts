/****************************************************************************************
 *  pushpinMiddleware.ts
 *
 *  Tracks device online/offline status via Redis, keeps the in-memory
 *  ConnectionManager in sync, and re-hydrates currently-online devices on boot.
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
 *  Module-level singletons / guards
 ***************************************************************************************/
let redisSubscriptionReady = false;   // ensure single pub/sub listener
let initialDevicesLoaded   = false;   // ensure we hydrate devices only once
const adminPrisma          = getAdminPrisma();

/****************************************************************************************
 *  publish — thin wrapper with logging
 ***************************************************************************************/
async function publish(
    redisService: ReturnType<typeof getRedisService>,
    channel: string,
    message: unknown
): Promise<void> {
    try {
        logger.debug(`[Pushpin] publish → ${channel}: ${JSON.stringify(message)}`);
        await redisService.publish(channel, JSON.stringify(message));
    } catch (err: any) {
        logger.error(`[Pushpin] publish failed (${channel}): ${err.message}`);
        throw err;
    }
}

/****************************************************************************************
 *
 *  pushpinMiddleware  (export)
 *
 *  Should be mounted **after** auth middleware so event.locals.redis is populated.
 *
 ***************************************************************************************/
export const pushpinMiddleware: Handle = async ({ event, resolve }) => {
    if (event.locals.redis) {
        const redisService = getRedisService(event.locals);

        if (redisService) {
            logger.debug('[Pushpin] Redis available');

            // hydrate + subscribe exactly once per node process
            if (!initialDevicesLoaded || !redisSubscriptionReady) {
                (async () => {
                    try {
                        if (!initialDevicesLoaded) {
                            await loadOnlineDevices(redisService);
                            initialDevicesLoaded = true;
                        }
                        if (!redisSubscriptionReady) {
                            await subscribeToDeviceStatusChange(redisService);
                            redisSubscriptionReady = true;
                        }
                    } catch (err: any) {
                        logger.error(`[Pushpin] bootstrap error: ${err.message}`, {
                            stack: err.stack
                        });
                    }
                })();
            }
        }
    }

    return resolve(event);
};

/****************************************************************************************
 *
 *  loadOnlineDevices
 *
 *  One-shot fetch of devices whose Redis key says status=online; registers each.
 *
 ***************************************************************************************/
async function loadOnlineDevices(
    redisService: ReturnType<typeof getRedisService>
): Promise<void> {
    logger.info('[Pushpin] Loading currently-online devices');

    const keys      = await redisService.client.keys('device:*:status');
    const onlineIds = (await Promise.all(
        keys.map(async (k) => (await redisService.get(k)) === 'online' ? k.split(':')[1] : null)
    )).filter(Boolean) as string[];

    logger.info(`[Pushpin] ${onlineIds.length} devices reported online`);

    for (const id of onlineIds) {
        try {
            await registerDevice(id, redisService);
        } catch (err: any) {
            logger.error(`[Pushpin] Failed to re-hydrate device ${id}: ${err.message}`);
        }
    }
}

/****************************************************************************************
 *
 *  subscribeToDeviceStatusChange
 *
 *  Long-lived Redis pub/sub listener that reacts to real-time online/offline events.
 *
 ***************************************************************************************/
async function subscribeToDeviceStatusChange(
    redisService: ReturnType<typeof getRedisService>
): Promise<void> {
    const CHANNEL = 'device_status_changes';
    logger.info(`[Pushpin] Subscribing to "${CHANNEL}"`);

    const sub = await redisService.subscribeToChannel(CHANNEL, async (raw: string) => {
        const data = safeParse<{ deviceId?: string; status?: 'online' | 'offline' }>(raw);
        if (!data?.deviceId || !data.status) {
            logger.warn('[Pushpin] Invalid payload received – ignoring');
            return;
        }

        const { deviceId, status } = data;
        logger.debug(`[Pushpin] ${deviceId} → ${status}`);

        try {
            if (status === 'online') {
                await registerDevice(deviceId, redisService);
            } else {
                await unregisterDevice(deviceId);
            }
        } catch (err: any) {
            logger.error(`[Pushpin] Error applying status for ${deviceId}: ${err.message}`);
        }
    });

    // simple back-off auto-resubscribe
    sub?.on('error', (err: Error) => {
        logger.error(`[Pushpin] Redis sub error: ${err.message}`);
        setTimeout(() => subscribeToDeviceStatusChange(redisService).catch(logger.error), 1000);
    });

    logger.info('[Pushpin] Subscription established');
}

/****************************************************************************************
 *
 *  registerDevice
 *
 *  Registers a device in ConnectionManager & DB if not already present.
 *
 ***************************************************************************************/
async function registerDevice(
    deviceId: string,
    redisService: ReturnType<typeof getRedisService>
): Promise<void> {
    if (ConnectionManager.getConnectionById(deviceId)) return; // already registered

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

    const publishFn = (channel: string, msg: unknown) => publish(redisService, channel, msg);

    const meta: ConnectionMeta = {
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
        `subscriber:connection:${connection.meta.id}`
    );

    logger.info(`[Pushpin] Device ${deviceId} registered`);
}

/****************************************************************************************
 *
 *  unregisterDevice
 *
 *  Removes device from ConnectionManager and flags it offline in DB.
 *
 ***************************************************************************************/
async function unregisterDevice(deviceId: string): Promise<void> {
    const conn = ConnectionManager.getConnectionById(deviceId);
    if (conn) ConnectionManager.unregisterConnection(conn);

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
 *
 *  safeParse  – tiny JSON.parse wrapper that returns null on failure.
 *
 ***************************************************************************************/
function safeParse<T>(raw: string): T | null {
    try {
        return JSON.parse(raw) as T;
    } catch {
        logger.warn('[Pushpin] Malformed JSON – discarded');
        return null;
    }
}
