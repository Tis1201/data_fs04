// Device listening endpoint with API key authentication
// Standard SSE implementation for device communication

import type { RequestHandler } from './$types';
import { auth_device } from '$lib/server/device/deviceAuth';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { logger } from '$lib/server/logger';

/**
 * Handles GET requests to establish an SSE connection for device communication
 */
export const GET: RequestHandler = async ({ locals, request }) => {
    try {
        // Authenticate the device
        const { device, userInfo } = await auth_device(locals, request);
        
        // Clean up any existing connection for this device
        const existingConnection = ConnectionManager.getConnection(device.id);
        if (existingConnection) {
            logger.info(`[SSE] Cleaning up existing connection for device ${device.id}`);
            (existingConnection as any).close();
        }

        // Update device status to online
        await DeviceStatusManager.setDeviceOnline(device.id, locals, device.id);

        // Create SSE stream
        const stream = new ReadableStream({
            start(controller) {
                // Create connection metadata
                const connectionMeta = {
                    id: device.id,
                    deviceId: device.id,
                    userInfo,
                    nodeId: 'device-listen',
                    protocol: 'sse',
                    connectedAt: Date.now()
                };

                // Create SSE connection
                const connection = new SSEConnection(connectionMeta, controller);
                ConnectionManager.registerConnection(connection);

                // Auto-subscribe device to its own scope for receiving commands
                subscriptionRegistry.addSubscription(
                    `subscription:device:${device.id}`,
                    `subscriber:connection:${device.id}`
                ).then(() => {
                    logger.info(`[SSE] Device ${device.id} auto-subscribed to subscription:device:${device.id}`);
                }).catch(error => {
                    logger.error(`[SSE] Failed to auto-subscribe device ${device.id}: ${String(error)}`);
                });

                // Send initial message to device
                controller.enqueue(new TextEncoder().encode(
                    `data: ${JSON.stringify({
                        type: 'connected',
                        deviceId: device.id,
                        message: 'Device connected successfully'
                    })}\n\n`
                ));

                // Publish device connection message to UI (bypassing dispatcher)
                const connectionMessage = MessageFactory.createSystemMessage(
                    'device:connection',
                    `subscription:device:${device.id}`,
                    {
                        deviceId: device.id,
                        connected: true,
                        connectedAt: new Date().toISOString(),
                        protocol: 'sse'
                    },
                    userInfo,
                    { echoToSender: false }
                );

                logger.info(`[SSE] Publishing connection event for device ${device.id}`);
                publisher.publish(connectionMessage).then(() => {
                    logger.info(`[SSE] Connection event published successfully for device ${device.id}`);
                }).catch(error => {
                    logger.error(`[SSE] Failed to publish connection event for device ${device.id}: ${String(error)}`);
                });

                logger.info(`Device ${device.id} connected via SSE`);
            },
            cancel() {
                // Update device status to offline
                DeviceStatusManager.setDeviceOffline(device.id, locals, device.id).then(() => {
                    logger.info(`[SSE] Device ${device.id} marked as offline`);
                }).catch(error => {
                    logger.error(`[SSE] Failed to mark device ${device.id} as offline: ${String(error)}`);
                });

                // Publish device disconnection message to UI
                const disconnectionMessage = MessageFactory.createSystemMessage(
                    'device:connection',
                    `subscription:device:${device.id}`,
                    {
                        deviceId: device.id,
                        connected: false,
                        disconnectedAt: new Date().toISOString(),
                        protocol: 'sse'
                    },
                    userInfo,
                    { echoToSender: false }
                );

                logger.info(`[SSE] Publishing disconnection event for device ${device.id}`);
                publisher.publish(disconnectionMessage).then(() => {
                    logger.info(`[SSE] Disconnection event published successfully for device ${device.id}`);
                }).catch(error => {
                    logger.error(`[SSE] Failed to publish disconnection event for device ${device.id}: ${String(error)}`);
                });

                // Clean up device subscription when connection closes
                subscriptionRegistry.removeSubscription(
                    `subscription:device:${device.id}`,
                    `subscriber:connection:${device.id}`
                ).then(() => {
                    logger.debug(`[SSE] Device ${device.id} subscription cleaned up`);
                }).catch(error => {
                    logger.warn(`[SSE] Failed to clean up device ${device.id} subscription: ${String(error)}`);
                });
                
                logger.debug(`Device ${device.id} SSE connection closed`);
            }
        });

        // Return SSE response
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } catch (error) {
        logger.error('Device listen SSE error', { error: String(error) });
        return new Response('SSE connection failed', { status: 500 });
    }
};