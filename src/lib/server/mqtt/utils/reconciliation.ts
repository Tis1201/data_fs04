/**
 * MQTT State Reconciliation
 * 
 * Reconciles Redis presence state with actual MQTT broker state.
 * Called on worker startup to handle cases where worker was down
 * and missed device disconnection events.
 */

import { logger } from '$lib/server/logger';
import redis from '$lib/server/redis';
import { getAdminPrisma } from '$lib/server/prisma';
import { getMqttTransport } from '../core/transport';

const EMQX_API_URL = process.env.EMQX_API_URL || 'http://localhost:18083/api/v5';
const EMQX_API_KEY = process.env.EMQX_API_KEY || '';
const EMQX_API_SECRET = process.env.EMQX_API_SECRET || '';

interface EmqxClient {
    clientid: string;
    username: string;
    connected_at: number;
    node: string;
}

/**
 * Fetches all currently connected clients from EMQX broker
 */
async function getConnectedClientsFromBroker(): Promise<Set<string>> {
    try {
        const auth = Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');
        
        const response = await fetch(`${EMQX_API_URL}/clients?limit=10000`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`EMQX API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const clients = data.data || [];
        
        // Extract device IDs from clientid (format: "device:UUID")
        const deviceIds = new Set<string>();
        for (const client of clients) {
            const clientId = client.clientid as string;
            if (clientId && clientId.startsWith('device:')) {
                const deviceId = clientId.substring(7); // Remove "device:" prefix
                deviceIds.add(deviceId);
            }
        }

        logger.info(`[MQTT Reconciliation] Found ${deviceIds.size} devices connected to broker`);
        return deviceIds;
    } catch (error) {
        logger.error(`[MQTT Reconciliation] Failed to fetch clients from broker: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Gets all device IDs that Redis thinks are online
 */
async function getOnlineDevicesFromRedis(): Promise<Set<string>> {
    try {
        if (!redis) {
            logger.warn('[MQTT Reconciliation] Redis not available, skipping Redis check');
            return new Set();
        }

        // Use the correct key pattern: presence:device:*
        const keys = await redis.keys('presence:device:*');
        const deviceIds = new Set<string>();
        
        for (const key of keys) {
            const deviceId = key.replace('presence:device:', '');
            const isOnline = await redis.get(key);
            if (isOnline === '1') {
                deviceIds.add(deviceId);
            }
        }

        logger.info(`[MQTT Reconciliation] Found ${deviceIds.size} devices marked online in Redis`);
        return deviceIds;
    } catch (error) {
        logger.error(`[MQTT Reconciliation] Failed to fetch online devices from Redis: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Reconciles Redis state with actual MQTT broker state
 * - Marks devices offline in Redis if they're not connected to broker
 * - Sends notifications to UI for state changes
 */
export async function reconcileDevicePresence(): Promise<void> {
    logger.info('[MQTT Reconciliation] Starting device presence reconciliation...')
    const adminPrisma = getAdminPrisma();

    try {
        // Get actual state from MQTT broker
        const brokerDevices = await getConnectedClientsFromBroker();
        
        // Get Redis state
        const redisDevices = await getOnlineDevicesFromRedis();

        // Find devices that Redis thinks are online but aren't connected to broker (mark offline)
        const staleDevices: string[] = [];
        for (const deviceId of redisDevices) {
            if (!brokerDevices.has(deviceId)) {
                staleDevices.push(deviceId);
            }
        }

        // Find devices that are connected to broker but Redis doesn't know about (mark online)
        const missingDevices: string[] = [];
        for (const deviceId of brokerDevices) {
            if (!redisDevices.has(deviceId)) {
                missingDevices.push(deviceId);
            }
        }

        if (staleDevices.length === 0 && missingDevices.length === 0) {
            logger.info('[MQTT Reconciliation] All device states are synchronized. No action needed.');
            return;
        }

        if (staleDevices.length > 0) {
            logger.info(`[MQTT Reconciliation] Found ${staleDevices.length} stale devices (marked online but disconnected), marking offline...`);
        }
        if (missingDevices.length > 0) {
            logger.info(`[MQTT Reconciliation] Found ${missingDevices.length} missing devices (connected but not in Redis), marking online...`);
        }

        // Mark stale devices as offline in Redis and send notifications
        for (const deviceId of staleDevices) {
            try {
                // Mark offline in Redis by deleting the presence key (matching handler behavior)
                if (redis) {
                    await redis.del(`presence:device:${deviceId}`);
                    logger.debug(`[MQTT Reconciliation] Marked device ${deviceId} offline in Redis`);
                }

                // Fetch device info to send proper notifications
                const device = await adminPrisma.device.findUnique({
                    where: { id: deviceId },
                    select: {
                        id: true,
                        name: true,
                        accountId: true
                    }
                });

                if (!device) {
                    logger.warn(`[MQTT Reconciliation] Device ${deviceId} not found in database`);
                    continue;
                }

                // Build notification payload (include type directly, not in ticket)
                const payload = {
                    type: 'device:disconnection',
                    deviceId: device.id,
                    deviceName: device.name,
                    timestamp: new Date().toISOString(),
                    reason: 'Reconciliation - device was offline while worker was down'
                };

                // Publish disconnection notification to UI
                const transport = getMqttTransport();
                if (!transport) {
                    logger.warn('[MQTT Reconciliation] MQTT transport not available, skipping notifications');
                    continue;
                }

                // Get users to notify (account members)
                const usersToNotify: string[] = [];
                if (device.accountId) {
                    const accountMembers = await adminPrisma.accountMembership.findMany({
                        where: { accountId: device.accountId },
                        select: { userId: true }
                    });
                    for (const member of accountMembers) {
                        usersToNotify.push(member.userId);
                    }
                }

                // Send notification to each user
                for (const userId of usersToNotify) {
                    const topic = `user/user:${userId}:${device.accountId}/notifications`;
                    await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
                    logger.debug(`[MQTT Reconciliation] Sent disconnection notification for device ${deviceId} to user ${userId}`);
                }

                logger.info(`[MQTT Reconciliation] Reconciled device ${deviceId} (marked offline, notified ${usersToNotify.length} users)`);
            } catch (err) {
                logger.error(`[MQTT Reconciliation] Failed to reconcile device ${deviceId}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // Mark missing devices as online in Redis and send notifications
        for (const deviceId of missingDevices) {
            try {
                // Mark online in Redis with TTL
                if (redis) {
                    const presenceTTL = parseInt(process.env.PRESENCE_TTL || '300', 10);
                    await redis.setex(`presence:device:${deviceId}`, presenceTTL, '1');
                    logger.debug(`[MQTT Reconciliation] Marked device ${deviceId} online in Redis (TTL: ${presenceTTL}s)`);
                }

                // Fetch device info to send proper notifications
                const device = await adminPrisma.device.findUnique({
                    where: { id: deviceId },
                    select: {
                        id: true,
                        name: true,
                        accountId: true
                    }
                });

                if (!device) {
                    logger.warn(`[MQTT Reconciliation] Device ${deviceId} not found in database`);
                    continue;
                }

                // Build notification payload (include type directly, not in ticket)
                const payload = {
                    type: 'device:connection',
                    deviceId: device.id,
                    deviceName: device.name,
                    timestamp: new Date().toISOString(),
                    connected: true
                };

                // Publish connection notification to UI
                const transport = getMqttTransport();
                if (!transport) {
                    logger.warn('[MQTT Reconciliation] MQTT transport not available, skipping notifications');
                    continue;
                }

                // Get users to notify (account members)
                const usersToNotify: string[] = [];
                if (device.accountId) {
                    const accountMembers = await adminPrisma.accountMembership.findMany({
                        where: { accountId: device.accountId },
                        select: { userId: true }
                    });
                    for (const member of accountMembers) {
                        usersToNotify.push(member.userId);
                    }
                }

                // Send notification to each user
                for (const userId of usersToNotify) {
                    const topic = `user/user:${userId}:${device.accountId}/notifications`;
                    await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
                    logger.debug(`[MQTT Reconciliation] Sent connection notification for device ${deviceId} to user ${userId}`);
                }

                logger.info(`[MQTT Reconciliation] Reconciled device ${deviceId} (marked online, notified ${usersToNotify.length} users)`);
            } catch (err) {
                logger.error(`[MQTT Reconciliation] Failed to reconcile device ${deviceId}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        logger.info(`[MQTT Reconciliation] Completed reconciliation. Processed ${staleDevices.length} stale devices (marked offline) and ${missingDevices.length} missing devices (marked online).`);
    } catch (error) {
        logger.error(`[MQTT Reconciliation] Reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

