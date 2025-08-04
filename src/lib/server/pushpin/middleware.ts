import type { Handle } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";
import { getRedisService } from "$lib/server/services/redisService";
import { ConnectionManager } from "$lib/server/messaging/core/connectionManager";
import { PushpinConnection } from "$lib/server/messaging/connections/pushpin_connection";
import { getAdminPrisma } from "$lib/server/prisma";

// Flag to track if we've already initialized the Redis subscription
// This prevents multiple subscriptions when the middleware runs multiple times
let isRedisSubscriptionInitialized = false;

// Flag to track if we've already loaded initial devices
let isInitialDevicesLoaded = false;

const adminPrisma = getAdminPrisma();

/**
 * Middleware that handles Pushpin connection tracking
 * This should be applied after auth middleware to ensure user authentication is available
 */

/**
 * Publish a message to a Redis channel for Pushpin to deliver
 * @param redisService Redis service instance
 * @param channel Channel to publish to
 * @param message Message to publish
 */
async function publish(redisService: ReturnType<typeof getRedisService>, channel: string, message: any): Promise<void> {
    try {

        logger.debug(`Entry to publish: ${channel}:${JSON.stringify(message)}`);


        // Publish to Redis channel
        await redisService.publish(channel, JSON.stringify(message));
        logger.debug(`[PushpinMiddleware] Published message to channel ${channel}`);
    } catch (error: any) {
        logger.error(`[PushpinMiddleware] Failed to publish message to channel ${channel}: ${error.message}`);
        throw error;
    }
}

export const pushpinMiddleware: Handle = async ({ event, resolve }) => {

    // logger.debug(`Entry to pushpinMiddleware`);

    // Only proceed if Redis is available
    if (event.locals.redis) {
        const redisService = getRedisService(event.locals);

        if (redisService) {
            logger.debug("[PushpinMiddleware] Redis service available");

            // Initialize Redis subscription and load devices only once
            if (!isRedisSubscriptionInitialized || !isInitialDevicesLoaded) {
                try {
                    // Use a non-blocking approach to avoid delaying the response
                    (async () => {
                        // Load online devices only if not done yet
                        if (!isInitialDevicesLoaded) {
                            const onlineDevices = await load_online_devices(redisService);
                            logger.info(`[PushpinMiddleware] Found ${onlineDevices.length} online devices`);

                            // Register the devices with the ConnectionManager
                            if (onlineDevices.length > 0) {
                                logger.debug(`[PushpinMiddleware] Online device IDs: ${onlineDevices.map(d => d.id).join(', ')}`);

                                // Register each online device with the connection manager
                                for (const device of onlineDevices) {
                                    try {

                                        logger.debug(`Check if device exists in db: ${JSON.stringify(device.id)}`);

                                        const dbDevice = await adminPrisma.device.findFirst({
                                            where: { id: device.id },
                                            include: {
                                                user: {
                                                    select: {
                                                        id: true,
                                                        email: true,
                                                        name: true,
                                                        systemRole: true
                                                    }
                                                }
                                            }
                                        });


                                        logger.debug(`Found device: ${JSON.stringify(dbDevice)}`);

                                        if (!dbDevice) {
                                            logger.warn(`Unable to find dbDevice with id: ${device.id}`)
                                        }

                                        //Create userInfo from dbDevice
                                        const userInfo = {
                                            id: dbDevice?.user.id,
                                            email: dbDevice?.user.email,
                                            name: dbDevice?.user.name,
                                            systemRole: dbDevice?.user.systemRole,
                                        }

                                        logger.debug(`Using UserInfo: ${JSON.stringify(userInfo)}`)

                                        // Create a publish function bound to this Redis service
                                        const publishFn = (channel: string, message: any) => {
                                            return publish(redisService, channel, message);
                                        };

                                        // Create a new PushpinConnection for each device with the publish function
                                        const connection = new PushpinConnection({
                                            id: device.id,
                                            type: 'pushpin',
                                            deviceId: device.id,
                                            meta: {
                                                deviceInfo: device.info,
                                                nodeId: process.env.NODE_ID || 'unknown'
                                            }
                                        }, publishFn);

                                        // Register the connection with the ConnectionManager
                                        ConnectionManager.registerConnection(connection);
                                        logger.debug(`[PushpinMiddleware] Registered device ${device.id} with ConnectionManager`);
                                    } catch (error: any) {
                                        logger.error(`[PushpinMiddleware] Failed to register device ${device.id}: ${error.message}`);
                                    }
                                }
                            }

                            // Mark initial devices as loaded
                            isInitialDevicesLoaded = true;
                        }

                        // Subscribe to device status changes only if not already subscribed
                        if (!isRedisSubscriptionInitialized) {
                            await subscribe_to_device_status_changes(redisService);
                            // Mark subscription as initialized
                            isRedisSubscriptionInitialized = true;
                            logger.info(`[PushpinMiddleware] Redis subscription initialized`);
                        }
                    })().catch(error => {
                        logger.error(`[PushpinMiddleware] Error in async device loading: ${error.message}`, {
                            error: error.message,
                            stack: error.stack
                        });
                    });
                } catch (error: any) {
                    logger.error(`[PushpinMiddleware] Failed to process devices: ${error.message}`, {
                        error: error.message,
                        stack: error.stack
                    });
                }
            }
        }
    }

    // Always continue to the next middleware/handler
    return await resolve(event);
}

/**
 * Load all online devices from Redis
 * @param redisService The Redis service instance
 * @returns Promise<Array<{id: string, info: any}>> Array of online device objects
 */
async function load_online_devices(redisService: ReturnType<typeof getRedisService>): Promise<Array<{ id: string, info: any }>> {
    try {
        logger.info('[PushpinMiddleware] Loading online devices from Redis');

        // Get all keys matching the pattern for online devices
        const keys = await redisService.client.keys('device:*:status');
        logger.info(`[PushpinMiddleware] Found ${keys.length} device status keys`);

        // Filter for online devices only
        const onlineDevices: Array<{ id: string, info: any }> = [];

        for (const key of keys) {
            const status = await redisService.get(key);
            if (status === 'online') {
                // Extract device ID from the key (format: device:<id>:status)
                const deviceId = key.split(':')[1];

                // Get additional device info if available
                const deviceInfoKey = `device:${deviceId}:info`;
                let deviceInfo: any = {};

                try {
                    const infoStr = await redisService.get(deviceInfoKey);
                    if (infoStr) {
                        deviceInfo = JSON.parse(infoStr);
                    }
                } catch (error: any) {
                    logger.warn(`[PushpinMiddleware] Error parsing device info for ${deviceId}: ${error.message}`);
                }

                onlineDevices.push({
                    id: deviceId,
                    info: deviceInfo
                });
            }
        }

        logger.info(`[PushpinMiddleware] Loaded ${onlineDevices.length} online devices`);
        return onlineDevices;
    } catch (error: any) {
        logger.error(`[PushpinMiddleware] Failed to load online devices: ${error.message}`, {
            error: error.message,
            stack: error.stack
        });
        return [];
    }
}

/**
 * Subscribe to device status changes from Redis
 * @param redisService The Redis service instance
 */
async function subscribe_to_device_status_changes(redisService: ReturnType<typeof getRedisService>): Promise<void> {
    try {
        const channelName = 'device_status_changes';
        logger.info(`[PushpinMiddleware] Subscribing to ${channelName} channel`);

        // Create a subscription to the device status changes channel
        const subscriber = await redisService.subscribeToChannel(channelName, (message: string) => {
            try {
                // Parse the message
                const data = JSON.parse(message);
                logger.debug(`[PushpinMiddleware] Received device status change: ${JSON.stringify(data)}`);

                // Handle the device status change
                if (data && data.deviceId && data.status) {
                    const { deviceId, status } = data;

                    if (status === 'online') {
                        // Device came online - register it
                        logger.info(`[PushpinMiddleware] Device ${deviceId} came online`);

                        // Get device info if available
                        (async () => {
                            try {
                                const deviceInfoKey = `device:${deviceId}:info`;
                                let deviceInfo: any = {};

                                const infoStr = await redisService.get(deviceInfoKey);
                                if (infoStr) {
                                    deviceInfo = JSON.parse(infoStr);
                                }

                                // Create a publish function bound to this Redis service
                                const publishFn = (channel: string, message: any) => {
                                    return publish(redisService, channel, message);
                                };

                                // Create and register the connection with publish function
                                const connection = new PushpinConnection({
                                    id: deviceId,
                                    type: 'pushpin',
                                    deviceId: deviceId,
                                    meta: {
                                        deviceInfo,
                                        nodeId: process.env.NODE_ID || 'unknown'
                                    }
                                }, publishFn);

                                ConnectionManager.registerConnection(connection);
                                logger.info(`[PushpinMiddleware] Registered device ${deviceId} with ConnectionManager`);
                            } catch (error: any) {
                                logger.error(`[PushpinMiddleware] Error registering device ${deviceId}: ${error.message}`);
                            }
                        })();
                    } else if (status === 'offline') {
                        // Device went offline - unregister it
                        logger.info(`[PushpinMiddleware] Device ${deviceId} went offline`);

                        // Find and unregister the connection
                        const connection = ConnectionManager.getConnectionById(deviceId);
                        if (connection) {
                            ConnectionManager.unregisterConnection(connection);
                            logger.info(`[PushpinMiddleware] Unregistered device ${deviceId} from ConnectionManager`);
                        }
                    }
                }
            } catch (error: any) {
                logger.error(`[PushpinMiddleware] Error processing device status change: ${error.message}`, {
                    error: error.message,
                    stack: error.stack
                });
            }
        });

        // Handle subscription errors
        if (subscriber) {
            subscriber.on('error', (error: Error) => {
                logger.error(`[PushpinMiddleware] Redis subscription error: ${error.message}`, {
                    error: error.message,
                    stack: error.stack
                });
            });

            logger.info(`[PushpinMiddleware] Successfully subscribed to ${channelName} channel`);
        } else {
            logger.warn(`[PushpinMiddleware] Failed to subscribe to ${channelName} channel`);
        }
    } catch (error: any) {
        logger.error(`[PushpinMiddleware] Failed to subscribe to device status changes: ${error.message}`, {
            error: error.message,
            stack: error.stack
        });
    }
}