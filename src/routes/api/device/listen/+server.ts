// Device listening endpoint with API key authentication
// Standard SSE implementation for device communication

import type { RequestHandler } from './$types';
import { auth_device } from '$lib/server/device/deviceAuth';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { logger } from '$lib/server/logger';

/**
 * Handles GET requests to establish an SSE connection for device communication
 */
export const GET: RequestHandler = async ({ locals, request }) => {
    try {
        // Authenticate the device
        const { device, userInfo } = await auth_device(locals, request);
        
        // Create SSE stream
        const stream = new ReadableStream({
            start(controller) {
                // Create connection metadata
                const connectionMeta = {
                    id: device.id,
                    userInfo,
                    nodeId: 'device-listen',
                    protocol: 'sse',
                    connectedAt: Date.now()
                };

                // Create SSE connection
                const connection = new SSEConnection(connectionMeta, controller);
                ConnectionManager.registerConnection(connection);

                // DEBUG: Log device connection details
                logger.info(`[DEBUG] Device ${device.id} connected via /api/device/listen`, {
                    deviceId: device.id,
                    connectionId: device.id,
                    userInfo: userInfo?.id,
                    nodeId: 'device-listen',
                    protocol: 'sse'
                });

                // DEBUG: Log connection metadata before registration
                logger.info(`[DEBUG] Connection metadata before registration:`, {
                    id: connectionMeta.id,
                    nodeId: connectionMeta.nodeId,
                    protocol: connectionMeta.protocol
                });

                // DEBUG: Check current subscriptions
                subscriptionRegistry.getAll().then(allSubscriptions => {
                    logger.info(`[DEBUG] Current subscriptions after device connect:`, {
                        totalCount: allSubscriptions.length,
                        subscriptions: allSubscriptions.map(sub => ({ key: sub.key, scope: sub.scope }))
                    });
                }).catch(error => {
                    logger.error(`[DEBUG] Failed to get all subscriptions: ${String(error)}`);
                });

                subscriptionRegistry.getByKey(`subscription:device:${device.id}`).then(deviceSubscriptions => {
                    logger.info(`[DEBUG] Device-specific subscriptions for ${device.id}:`, {
                        count: deviceSubscriptions.length,
                        subscriptions: deviceSubscriptions.map(sub => ({ key: sub.key, scope: sub.scope }))
                    });
                }).catch(error => {
                    logger.error(`[DEBUG] Failed to get device subscriptions: ${String(error)}`);
                });

                // Auto-subscribe device to its own scope for receiving commands
                subscriptionRegistry.addSubscription(
                    `subscription:device:${device.id}`,
                    `subscriber:connection:${device.id}`
                ).then(() => {
                    logger.info(`[DEBUG] Device ${device.id} auto-subscribed to subscription:device:${device.id}`);
                }).catch(error => {
                    logger.error(`[DEBUG] Failed to auto-subscribe device ${device.id}: ${String(error)}`);
                });

                // Send initial message
                controller.enqueue(new TextEncoder().encode(
                    `data: ${JSON.stringify({
                        type: 'connected',
                        deviceId: device.id,
                        message: 'Device connected successfully'
                    })}\n\n`
                ));

                logger.info(`Device ${device.id} connected via SSE`);
            },
            cancel() {
                // Clean up device subscription when connection closes
                subscriptionRegistry.removeSubscription(
                    `subscription:device:${device.id}`,
                    `subscriber:connection:${device.id}`
                ).then(() => {
                    logger.debug(`[DEBUG] Device ${device.id} subscription cleaned up`);
                }).catch(error => {
                    logger.warn(`[DEBUG] Failed to clean up device ${device.id} subscription: ${String(error)}`);
                });
                
                logger.debug(`Device ${(device as any).id} SSE connection closed`);
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