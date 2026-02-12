import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import redis from '$lib/server/redis';
import { publishDeviceStatusNotification } from '../notifications/device_status_publisher';

/********************************************************************************************
 * Handle MQTT connection/disconnection events
 * Processes EMQX connection events and updates device presence, database, and notifications
 ********************************************************************************************/
export async function handleConnectionEvent(
    topic: string,
    payload: Buffer,
    prisma: PrismaClient
): Promise<void> {
    const rawEvent = payload.toString('utf8');
    let eventData: any = null;

    // EMQX may emit event payloads as Erlang-style maps, e.g.:
    // {
    // clientid: "device:..._suffix",
    // username: "device:...",
    // reason: "remote",
    // disconnected_at: "<epoch-ms>"
    // }
    // which is not valid JSON. Try JSON.parse first, then fall back to regex extraction.
    try {
        // eslint-disable-next-line no-console
        console.log('rawEvent', rawEvent);
        eventData = JSON.parse(rawEvent);
    } catch {
        // Swallow JSON errors; we'll try to extract fields from the raw string below.
    }

    let clientId = typeof eventData?.clientid === 'string' ? eventData.clientid : '';
    let username = typeof eventData?.username === 'string' ? eventData.username : '';
    let reason = typeof eventData?.reason === 'string' ? eventData.reason : '';
    let connectedAtMs: number | null = null;
    let disconnectedAtMs: number | null = null;
    let node: string | null =
        typeof eventData?.node === 'string' ? (eventData.node as string) : null;

    if (!clientId) {
        const clientIdMatch = rawEvent.match(/clientid:\s*"([^\"]+)"/);
        if (clientIdMatch) {
            clientId = clientIdMatch[1];
        }
    }

    if (!username) {
        const usernameMatch = rawEvent.match(/username:\s*"([^\"]+)"/);
        if (usernameMatch) {
            username = usernameMatch[1];
        }
    }

    if (!reason) {
        const reasonMatch = rawEvent.match(/reason:\s*"([^\"]+)"/);
        if (reasonMatch) {
            reason = reasonMatch[1];
        }
    }

    if (!node) {
        const nodeMatch = rawEvent.match(/node:\s*"([^\"]+)"/);
        if (nodeMatch) {
            node = nodeMatch[1];
        }
    }

    if (eventData?.connected_at != null) {
        connectedAtMs = Number(eventData.connected_at);
    } else {
        const connectedMatch = rawEvent.match(/connected_at:\s*"?(\d+)"?/);
        if (connectedMatch) {
            connectedAtMs = Number(connectedMatch[1]);
        }
    }

    if (eventData?.disconnected_at != null) {
        disconnectedAtMs = Number(eventData.disconnected_at);
    } else {
        const disconnectedMatch = rawEvent.match(/disconnected_at:\s*"?(\d+)"?/);
        if (disconnectedMatch) {
            disconnectedAtMs = Number(disconnectedMatch[1]);
        }
    }

    // Derive username from clientId if necessary: clientId is typically `${username}_${suffix}`.
    if (!username && clientId.startsWith('device:')) {
        username = clientId.split('_')[0];
    }
    if (!username && clientId.startsWith('user:')) {
        username = clientId.split('_')[0];
    }

    const kind = username.startsWith('device:')
        ? 'device'
        : username.startsWith('user:')
          ? 'user'
          : username.startsWith('factory:')
            ? 'factory'
          : 'other';
    // Only extract deviceId for claimed devices (not factory devices)
    const deviceId = kind === 'device' ? username.slice('device:'.length) : null;

    const now = new Date();
    const isConnectEvent =
        topic === '$events/client/connected' ||
        topic === '$events/client/connected/' ||
        topic === '$events/client_connected';
    const eventTimestampMs = isConnectEvent ? connectedAtMs ?? disconnectedAtMs : disconnectedAtMs ?? connectedAtMs;
    const eventDate =
        typeof eventTimestampMs === 'number' && !Number.isNaN(eventTimestampMs)
            ? new Date(eventTimestampMs)
            : now;

    // Update device presence in Redis for claimed devices (not factory devices)
    // When multiple apps share the same device ID (e.g. radar + RDM), we only mark offline when the *last* connection disconnects.
    if (deviceId && redis) {
        const presenceKey = `presence:device:${deviceId}`;
        const presenceClientsKey = `presence:device:${deviceId}:clients`;
        const presenceSetKey = 'presence:devices:online';
        const presenceTTL = parseInt(process.env.PRESENCE_TTL || '600', 10); // 10 minutes default (increased for stability)

        try {
            if (isConnectEvent) {
                const pipeline = redis.pipeline();
                pipeline.sadd(presenceClientsKey, clientId);
                pipeline.expire(presenceClientsKey, presenceTTL);
                pipeline.setex(presenceKey, presenceTTL, '1');
                pipeline.sadd(presenceSetKey, deviceId);
                await pipeline.exec();
                logger.debug(`[MQTT Presence] Device ${deviceId} marked online (clientId=${clientId}, TTL: ${presenceTTL}s)`);
            } else {
                const pipeline = redis.pipeline();
                pipeline.srem(presenceClientsKey, clientId);
                pipeline.scard(presenceClientsKey);
                const results = await pipeline.exec();
                const remainingCount = (results?.[1]?.[1] as number) ?? 0;
                if (remainingCount === 0) {
                    await redis
                        .multi()
                        .del(presenceKey)
                        .srem(presenceSetKey, deviceId)
                        .del(presenceClientsKey)
                        .exec();
                    logger.debug(`[MQTT Presence] Device ${deviceId} marked offline (last connection: ${clientId})`);
                } else {
                    logger.debug(`[MQTT Presence] Device ${deviceId} still has ${remainingCount} connection(s), staying online`);
                }
            }
        } catch (redisError) {
            logger.error(`[MQTT Presence] Failed to update presence for device ${deviceId}:`, {
                error: redisError instanceof Error ? redisError.message : String(redisError)
            });
        }
    }

    // Single-row-per-clientId session style: track latest state per clientId
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
    } else {
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

    // Maintain high-level Device.connected flags for device clients only
    if (kind === 'device' && deviceId) {
        if (isConnectEvent) {
            await prisma.device.updateMany({
                where: { id: deviceId },
                data: { connected: true, connectedAt: eventDate }
            });
            logger.info('[MQTT Events] Device connected', { deviceId, username, clientId });

            // Publish MQTT notification for real-time UI updates
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

            // Auto-sync: Push pending configs for this device's sensors
            try {
                // Use raw query to avoid type issues with syncStatus field
                const pendingSensors = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
                    SELECT s.id, s.name 
                    FROM "Sensor" s
                    JOIN "Controller" c ON s."controllerId" = c.id
                    WHERE c."deviceId" = ${deviceId}
                    AND s."syncStatus" = 'PENDING'
                `;

                if (pendingSensors.length > 0) {
                    logger.info(`[MQTT Events] Auto-syncing ${pendingSensors.length} pending configs for device ${deviceId}`);

                    const { handleSensorConfigPush } = await import('../web/handle_sensor_config');

                    for (const sensor of pendingSensors) {
                        try {
                            // Create minimal RpcHandlerArgs for the handler
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
                }
            } catch (err) {
                logger.warn('[MQTT Events] Failed to check for pending configs:', err);
            }
        } else {
            await prisma.device.updateMany({
                where: { id: deviceId },
                data: { connected: false, disconnectedAt: eventDate }
            });
            logger.info('[MQTT Events] Device disconnected', { deviceId, username, clientId, reason });

            // Publish MQTT notification for real-time UI updates
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
    }
}
