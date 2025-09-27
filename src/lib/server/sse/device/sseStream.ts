// Using global ReadableStream from web standards
import { logger } from '$lib/server/logger';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import {
    ResponseStatus,
    ResponseCategory,
    ResponseSeverity,
    createSystemResponse,
    createErrorResponse
} from '$lib/shared/response_format';

declare global {
    interface ReadableStream<R = any> {
        [Symbol.asyncIterator](): AsyncIterableIterator<R>;
    }
}

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
}: SSESteamOptions): globalThis.ReadableStream {
    logger.debug('Creating ReadableStream for SSE connection');
    
    // Store connectionId in outer scope to make it accessible in both start and cancel
    let connectionId: string | null = null;
    
    return new globalThis.ReadableStream({
        async start(controller: ReadableStreamDefaultController) {
            try {
                logger.debug('SSE ReadableStream started');
                
                // Create the SSE connection
                logger.debug('Creating SSEConnection instance');
                const connection = new SSEConnection(connectionMeta, controller);
                
                // Register the connection and get the connection ID
                ConnectionManager.registerConnection(connection);
                const newConnectionId = connection.meta?.id;
                
                if (!newConnectionId) {
                    throw new Error('Failed to generate connection ID');
                }
                
                // Update the outer scope connectionId
                connectionId = newConnectionId;
                
                // Add subscription for device-specific messages
                const deviceSubscriptionKey = `subscription:device:${device.id}`;
                const connectionScope = `subscriber:connection:${connectionId}`;
                
                try {
                    await subscriptionRegistry.addSubscription(deviceSubscriptionKey, connectionScope);
                    logger.info(`[Device SSE] Successfully subscribed device ${device.id} (connection ${connectionId}) to ${deviceSubscriptionKey}`);
                } catch (error) {
                    logger.error(`[Device SSE] Failed to subscribe device ${device.id} to ${deviceSubscriptionKey}: ${error}`);
                    throw error; // Re-throw to ensure the connection fails if subscription fails
                }
                
                // Notify that connection is established
                await onConnectionEstablished(connectionId);

                // Broadcast connection status to subscribers (real-time UI update)
                try {
                    const routing = MessageFactory.createSystemMessage(
                        'device:connection',
                        `subscription:device:${device.id}`,
                        {
                            action: 'device:connection',
                            deviceId: device.id,
                            connected: true,
                            connectedAt: new Date().toISOString()
                        },
                        SystemUser,
                        { echoToSender: false }
                    );
                    await publisher.publish(routing);
                } catch (e) {
                    logger.warn(`Failed to broadcast device connection for ${device.id}: ${String(e)}`);
                }

                logger.info(`SSE connection established for device ${device.id}`);
                
            } catch (error) {
                logger.error(`Error in SSE ReadableStream start: ${error}`);
                
                // Update device status on error (device may not exist yet during registration)
                try {
                    await locals.prisma.device.updateMany({
                        where: { id: device.id },
                        data: {
                            connected: false,
                            disconnectedAt: new Date()
                        }
                    });
                } catch (dbError) {
                    logger.error(`Failed to update device ${device.id} status on connection error: ${dbError}`);
                }
                
                // Close the controller with error
                controller.error(error);
            }
        },
        
        async cancel(reason?: any) {
            logger.debug(`SSE connection cancelled: ${reason}`);
            
            // Only proceed if we have a valid connectionId
            if (!connectionId) {
                logger.warn('No connectionId available during connection cleanup');
                return;
            }
            
            // Notify that connection is closed
            try {
                await onConnectionClosed(connectionId);
            } catch (error) {
                logger.error(`Error in connection closed handler: ${error}`);
            }
            
            // Clean up resources
            try {
                await cleanupConnection(connectionId, device.id, locals);
                logger.debug(`Cleanup completed for connection: ${connectionId}`);
            } catch (error) {
                logger.error(`Error during connection cleanup: ${error}`);
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
                logger.error(`Error removing subscription ${sub.key} for connection ${connectionId}: ${subError}`);
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
                // Broadcast disconnection status to subscribers
                try {
                    const routing = MessageFactory.createSystemMessage(
                        'device:connection',
                        `subscription:device:${deviceId}`,
                        {
                            action: 'device:connection',
                            deviceId,
                            connected: false,
                            disconnectedAt: new Date().toISOString()
                        },
                        SystemUser,
                        { echoToSender: false }
                    );
                    await publisher.publish(routing);
                } catch (e) {
                    logger.warn(`Failed to broadcast device disconnection for ${deviceId}: ${String(e)}`);
                }
            } catch (updateError: any) {
                // Handle specific Prisma errors
                if (updateError.code === 'P2025') {
                    // Record not found - device was likely deleted, ignore
                    logger.debug(`Device ${deviceId} not found during cleanup - likely deleted`);
                } else if (updateError.code === 'P2002') {
                    // Unique constraint violation - ignore during cleanup
                    logger.debug(`Unique constraint error during device ${deviceId} cleanup - ignoring`);
                } else if (!String(updateError).includes('closed')) {
                    logger.error(`Failed to update device ${deviceId} status: ${JSON.stringify(updateError)}`);
                }
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
