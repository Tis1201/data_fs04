import { ReadableStream } from 'stream/web';
import { logger } from '$lib/server/logger';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import type { App } from '$lib/types';

/**
 * Options for creating an SSE stream
 */
export interface SSESteamOptions {
    connectionMeta: ConnectionMeta;
    device: any;
    locals: App.Locals;
    onConnectionEstablished: (connectionId: string) => Promise<void>;
    onConnectionClosed: (connectionId: string) => Promise<void>;
}

/**
 * Creates a ReadableStream for Server-Sent Events (SSE) with proper connection management
 */
export function createSSEStream({
    connectionMeta,
    device,
    locals,
    onConnectionEstablished,
    onConnectionClosed
}: SSESteamOptions): ReadableStream {
    logger.debug('Creating ReadableStream for SSE connection');
    
    // Store connectionId in outer scope to make it accessible in both start and cancel
    let connectionId: string | null = null;
    
    return new ReadableStream({
        async start(controller) {
            try {
                logger.debug('SSE ReadableStream started');
                
                // Create the SSE connection
                logger.debug('Creating SSEConnection instance');
                const connection = new SSEConnection(connectionMeta, controller);
                
                // Register the connection
                ConnectionManager.registerConnection(connection);
                connectionId = connection.meta.id; // Assign to outer scope variable
                
                // Add subscription for device-specific messages
                const deviceSubscriptionKey = `subscription:device:${device.id}`;
                const connectionScope = `subscriber:connection:${connectionId}`;
                
                await subscriptionRegistry.addSubscription(deviceSubscriptionKey, connectionScope);
                logger.debug('Subscription added successfully');
                
                // Notify that connection is established
                await onConnectionEstablished(connectionId);
                
                logger.info(`SSE connection established for device ${device.id}`);
                
            } catch (error) {
                logger.error(`Error in SSE ReadableStream start: ${error}`);
                
                // Update device status on error
                try {
                    await locals.prisma.device.update({
                        where: { id: device.id },
                        data: {
                            connected: false,
                            disconnectedAt: new Date()
                        }
                    });
                } catch (dbError) {
                    logger.error('Failed to update device status on connection error:', dbError);
                }
                
                // Close the controller with error
                controller.error(error);
            }
        },
        
        async cancel(reason) {
            logger.debug(`SSE connection cancelled: ${reason}`);
            
            // Notify that connection is closed
            try {
                await onConnectionClosed(connectionId);
            } catch (error) {
                logger.error(`Error in connection closed handler:`, error);
            }
            
            // Clean up resources
            try {
                if (connectionId) {
                    await cleanupConnection(connectionId, device.id, locals);
                    logger.debug(`Cleanup completed for connection: ${connectionId}`);
                }
            } catch (error) {
                logger.error('Error during connection cleanup:', error);
            }
        }
    });
}

/**
 * Cleans up all resources associated with a device connection when it's closed
 */
async function cleanupConnection(connectionId: string, deviceId: string, locals: App.Locals): Promise<void> {
    if (!connectionId) {
        logger.warn('No connection ID provided for cleanup');
        return;
    }

    logger.debug(`Starting cleanup for connection: ${connectionId}`);
    
    try {
        // Remove connection from ConnectionManager
        logger.debug(`Removing connection from ConnectionManager: ${connectionId}`);
        await ConnectionManager.unregisterConnection(connectionId);
        
        // Remove all subscriptions for this connection
        logger.debug(`Removing subscriptions for connection: ${connectionId}`);
        const connectionScope = `subscriber:connection:${connectionId}`;
        const subscriptions = await subscriptionRegistry.getByScope(connectionScope);
        
        // Remove each subscription individually
        for (const sub of subscriptions) {
            try {
                await subscriptionRegistry.removeSubscription(sub.key, connectionScope);
                logger.debug(`Removed subscription: ${sub.key} for connection: ${connectionId}`);
            } catch (subError) {
                logger.error(`Error removing subscription ${sub.key} for connection ${connectionId}:`, subError);
                // Continue with other subscriptions even if one fails
            }
        }
        
        // Update device connection status in DB if deviceId is provided and we have Prisma access
        if (deviceId && locals?.prisma) {
            try {
                await locals.prisma.device.update({
                    where: { id: deviceId },
                    data: {
                        connected: false,
                        disconnectedAt: new Date()
                    }
                });
                logger.debug(`Updated device ${deviceId} status to disconnected`);
            } catch (updateError) {
                logger.error(`Failed to update device ${deviceId} status:`, updateError);
            }
        } else {
            logger.warn('No device ID provided for cleanup');
        }
        
        logger.info(`Successfully cleaned up connection: ${connectionId}`);
    } catch (error) {
        logger.error(`Error during cleanup of connection ${connectionId}: ${error}`);
        throw error; // Rethrow to ensure the error is logged by the caller
    }
}
