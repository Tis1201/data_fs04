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
 * Fast startup sync: Bulk-refresh Redis presence from MQTT broker
 * This is optimized for speed - only updates Redis, no DB or notifications
 * Use this on worker startup for immediate presence data
 */
export async function fastStartupSync(): Promise<void> {
    logger.info('[MQTT Fast Sync] Starting fast startup sync...');
    
    try {
        // Get all connected devices from broker (source of truth)
        const brokerDevices = await getConnectedClientsFromBroker();
        
        if (brokerDevices.size === 0) {
            logger.info('[MQTT Fast Sync] No devices connected to broker');
            return;
        }
        
        if (!redis) {
            logger.warn('[MQTT Fast Sync] Redis not available, skipping sync');
            return;
        }
        
        const presenceTTL = parseInt(process.env.PRESENCE_TTL || '600', 10);
        
        // Use Redis pipeline for bulk operations (much faster than individual commands)
        const pipeline = redis.pipeline();
        const presenceSetKey = 'presence:devices:online';
        
        // Clear the Set first (fast startup sync - rebuild from scratch)
        pipeline.del(presenceSetKey);
        
        for (const deviceId of brokerDevices) {
            // Set presence key with TTL for each connected device
            pipeline.setex(`presence:device:${deviceId}`, presenceTTL, '1');
            // Add to Set for fast listing
            pipeline.sadd(presenceSetKey, deviceId);
        }
        
        // Execute all commands at once
        await pipeline.exec();
        
        logger.info(`[MQTT Fast Sync] Completed - marked ${brokerDevices.size} devices online in Redis (TTL: ${presenceTTL}s)`);
    } catch (error) {
        logger.error(`[MQTT Fast Sync] Failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Send device status notification to users
 */
async function sendDeviceStatusNotification(
    device: { id: string; name: string; accountId: string | null },
    connected: boolean,
    prisma: any
): Promise<void> {
    const transport = getMqttTransport();
    if (!transport) {
        logger.warn('[MQTT Reconciliation] MQTT transport not available, skipping notifications');
        return;
    }

    const notificationType = connected ? 'device:connection' : 'device:disconnection';
    const payload = {
        type: notificationType,
        deviceId: device.id,
        deviceName: device.name,
        timestamp: new Date().toISOString(),
        connected
    };

    // Get users to notify (account members)
    const usersToNotify: string[] = [];
    if (device.accountId) {
        const accountMembers = await prisma.accountMembership.findMany({
            where: { accountId: device.accountId },
            select: { userId: true }
        });
        for (const member of accountMembers) {
            usersToNotify.push(member.userId);
        }
    }

    // Send notification to each user
    for (const userId of usersToNotify) {
        try {
            const topic = `subscription:user:${userId}:${device.accountId}`;
            await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
            logger.debug(`[MQTT Reconciliation] Published ${notificationType} to ${topic}`);
        } catch (err) {
            logger.error(`[MQTT Reconciliation] Failed to publish to user ${userId}:`, err);
        }
    }
}

/**
 * Fetches all currently connected clients from EMQX broker with pagination
 * Supports 100k+ devices by fetching in pages of 10k
 */
async function getConnectedClientsFromBroker(): Promise<Set<string>> {
    try {
        const auth = Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');
        const deviceIds = new Set<string>();
        let page = 1;
        const limit = 10000;
        const maxPages = 20; // Support up to 200k devices
        
        while (page <= maxPages) {
            const response = await fetch(`${EMQX_API_URL}/clients?page=${page}&limit=${limit}`, {
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
            
            if (clients.length === 0) {
                // No more clients to fetch
                break;
            }
            
            // Extract device IDs from clientid (format: "device:DEVICE_ID_SUFFIX" where suffix is "_XXXXXX")
            for (const client of clients) {
                const clientId = client.clientid as string;
                if (clientId && clientId.startsWith('device:')) {
                    let deviceId = clientId.substring(7); // Remove "device:" prefix
                    // Strip random suffix if present (format: "DEVICE_ID_XXXXXX" where suffix is _XXXXXX)
                    const underscoreIndex = deviceId.lastIndexOf('_');
                    if (underscoreIndex > 0 && deviceId.length - underscoreIndex <= 7) {
                        deviceId = deviceId.substring(0, underscoreIndex);
                    }
                    deviceIds.add(deviceId);
                }
            }
            
            logger.debug(`[MQTT Reconciliation] Fetched page ${page}: ${clients.length} clients, total devices: ${deviceIds.size}`);
            
            // If we got less than limit, we've reached the end
            if (clients.length < limit) {
                break;
            }
            
            page++;
        }
        
        if (page > maxPages) {
            logger.warn(`[MQTT Reconciliation] Reached max pagination limit (${maxPages} pages, ${maxPages * limit} clients)`);
        }

        logger.info(`[MQTT Reconciliation] Found ${deviceIds.size} devices connected to broker (fetched ${page} pages)`);
        return deviceIds;
    } catch (error) {
        logger.error(`[MQTT Reconciliation] Failed to fetch clients from broker: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Gets all device IDs that Redis thinks are online
 * Uses Redis Set for O(1) performance (much faster than KEYS scan)
 */
async function getOnlineDevicesFromRedis(): Promise<Set<string>> {
    try {
        if (!redis) {
            logger.warn('[MQTT Reconciliation] Redis not available, skipping Redis check');
            return new Set();
        }

        const presenceSetKey = 'presence:devices:online';
        
        // Try to use Set first (O(N) where N = number of devices, but single operation)
        try {
            const members = await redis.smembers(presenceSetKey);
            if (members && members.length > 0) {
                logger.info(`[MQTT Reconciliation] Found ${members.length} devices marked online in Redis (using Set)`);
                return new Set(members);
            }
        } catch (setError) {
            logger.warn('[MQTT Reconciliation] Failed to fetch from Set, falling back to KEYS scan');
        }
        
        // Fallback to KEYS scan (slower but works if Set doesn't exist yet)
        const keys = await redis.keys('presence:device:*');
        const deviceIds = new Set<string>();
        
        for (const key of keys) {
            const deviceId = key.replace('presence:device:', '');
            const isOnline = await redis.get(key);
            if (isOnline === '1') {
                deviceIds.add(deviceId);
            }
        }

        logger.info(`[MQTT Reconciliation] Found ${deviceIds.size} devices marked online in Redis (using KEYS scan)`);
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
        logger.info(`[MQTT Reconciliation] Broker devices: ${Array.from(brokerDevices).join(', ') || 'none'}`);
        
        // Get Redis state
        const redisDevices = await getOnlineDevicesFromRedis();
        logger.info(`[MQTT Reconciliation] Redis devices: ${Array.from(redisDevices).join(', ') || 'none'}`);

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
            logger.info('[MQTT Reconciliation] Redis and Broker are synchronized.');
            
            // Even if Redis/Broker match, database might be stale
            // This can happen if device was connected before worker started
            // Check and fix database state for connected devices
            if (brokerDevices.size > 0) {
                try {
                    // Find devices that are online in broker/Redis but database shows offline
                    const onlineDeviceIds = Array.from(brokerDevices);
                    const devicesInDb = await adminPrisma.device.findMany({
                        where: { id: { in: onlineDeviceIds } },
                        select: { id: true, connected: true }
                    });
                    
                    logger.info(`[MQTT Reconciliation] Database check: ${devicesInDb.map(d => `${d.id}:${d.connected ? 'online' : 'offline'}`).join(', ')}`);
                    
                    const dbNeedsUpdate = devicesInDb.filter(d => !d.connected).map(d => d.id);
                    
                    if (dbNeedsUpdate.length > 0) {
                        logger.info(`[MQTT Reconciliation] Found ${dbNeedsUpdate.length} devices online but database shows offline, updating...`);
                        
                        const now = new Date();
                        await adminPrisma.device.updateMany({
                            where: { id: { in: dbNeedsUpdate } },
                            data: {
                                connected: true,
                                connectedAt: now
                            }
                        });
                        
                        logger.info(`[MQTT Reconciliation] Updated ${dbNeedsUpdate.length} devices to online in database`);
                        
                        // Send notifications for these devices
                        for (const deviceId of dbNeedsUpdate) {
                            try {
                                const device = await adminPrisma.device.findUnique({
                                    where: { id: deviceId },
                                    select: { id: true, name: true, accountId: true }
                                });
                                
                                if (device) {
                                    await sendDeviceStatusNotification(device, true, adminPrisma);
                                }
                            } catch (notifError) {
                                logger.error(`[MQTT Reconciliation] Failed to send notification for ${deviceId}: ${notifError}`);
                            }
                        }
                    } else {
                        logger.info('[MQTT Reconciliation] All device states are synchronized (including database). No action needed.');
                    }
                } catch (dbCheckError) {
                    logger.error(`[MQTT Reconciliation] Failed to check database state: ${dbCheckError instanceof Error ? dbCheckError.message : String(dbCheckError)}`);
                }
            }
            
            // Even if everything is synchronized, refresh TTLs for all connected devices
            // This prevents Redis keys from expiring while device is still online
            if (redis && brokerDevices.size > 0) {
                try {
                    const presenceKey = 'presence:devices:online';
                    const presenceTTL = parseInt(process.env.PRESENCE_TTL || '600', 10);
                    const pipeline = redis.pipeline();
                    
                    for (const deviceId of brokerDevices) {
                        const devicePresenceKey = `presence:device:${deviceId}`;
                        pipeline.setex(devicePresenceKey, presenceTTL, '1');
                    }
                    
                    // Also refresh the Set TTL
                    pipeline.expire(presenceKey, presenceTTL);
                    
                    await pipeline.exec();
                    logger.debug(`[MQTT Reconciliation] Refreshed TTLs for ${brokerDevices.size} online devices`);
                } catch (ttlError) {
                    logger.error(`[MQTT Reconciliation] Failed to refresh TTLs: ${ttlError instanceof Error ? ttlError.message : String(ttlError)}`);
                }
            }
            
            return;
        }

        if (staleDevices.length > 0) {
            logger.info(`[MQTT Reconciliation] Found ${staleDevices.length} stale devices (marked online but disconnected), marking offline...`);
        }
        if (missingDevices.length > 0) {
            logger.info(`[MQTT Reconciliation] Found ${missingDevices.length} missing devices (connected but not in Redis), marking online...`);
        }

        // Mark stale devices as offline in Redis (batch operation)
        if (staleDevices.length > 0 && redis) {
            const pipeline = redis.pipeline();
            const presenceSetKey = 'presence:devices:online';
            
            for (const deviceId of staleDevices) {
                pipeline.del(`presence:device:${deviceId}`);
                pipeline.srem(presenceSetKey, deviceId);
            }
            await pipeline.exec();
            logger.info(`[MQTT Reconciliation] Removed ${staleDevices.length} stale devices from Redis`);
        }

        // Batch update database for stale devices
        if (staleDevices.length > 0) {
            const now = new Date();
            await adminPrisma.device.updateMany({
                where: { id: { in: staleDevices } },
                data: {
                    connected: false,
                    disconnectedAt: now
                }
            });
            logger.info(`[MQTT Reconciliation] Updated ${staleDevices.length} devices to offline in database`);
        }

        // Send notifications for stale devices
        for (const deviceId of staleDevices) {
            try {
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
                    const topic = `subscription:user:${userId}:${device.accountId}`;
                    await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
                    logger.debug(`[MQTT Reconciliation] Sent disconnection notification for device ${deviceId} to user ${userId}`);
                }

                logger.info(`[MQTT Reconciliation] Reconciled device ${deviceId} (marked offline, notified ${usersToNotify.length} users)`);
            } catch (err) {
                logger.error(`[MQTT Reconciliation] Failed to reconcile device ${deviceId}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // Refresh TTL for devices that are still connected (prevent expiration)
        const presenceTTL = parseInt(process.env.PRESENCE_TTL || '600', 10); // 10 minutes default (increased for stability)
        for (const deviceId of brokerDevices) {
            try {
                if (redis) {
                    const presenceKey = `presence:device:${deviceId}`;
                    const exists = await redis.exists(presenceKey);
                    if (exists === 1) {
                        // Refresh TTL for devices that are still connected
                        await redis.expire(presenceKey, presenceTTL);
                        logger.debug(`[MQTT Reconciliation] Refreshed TTL for device ${deviceId} (TTL: ${presenceTTL}s)`);
                    }
                }
            } catch (err) {
                logger.error(`[MQTT Reconciliation] Failed to refresh TTL for device ${deviceId}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // Mark missing devices as online in Redis (batch operation)
        if (missingDevices.length > 0 && redis) {
            const pipeline = redis.pipeline();
            const presenceSetKey = 'presence:devices:online';
            
            for (const deviceId of missingDevices) {
                pipeline.setex(`presence:device:${deviceId}`, presenceTTL, '1');
                pipeline.sadd(presenceSetKey, deviceId);
            }
            await pipeline.exec();
            logger.info(`[MQTT Reconciliation] Added ${missingDevices.length} missing devices to Redis (TTL: ${presenceTTL}s)`);
        }

        // Batch update database for missing devices
        if (missingDevices.length > 0) {
            const now = new Date();
            await adminPrisma.device.updateMany({
                where: { id: { in: missingDevices } },
                data: {
                    connected: true,
                    connectedAt: now
                }
            });
            logger.info(`[MQTT Reconciliation] Updated ${missingDevices.length} devices to online in database`);
        }

        // Send notifications for missing devices
        for (const deviceId of missingDevices) {
            try {
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
                    const topic = `subscription:user:${userId}:${device.accountId}`;
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

