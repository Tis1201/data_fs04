// Device listening endpoint with API key authentication
// - Devices connect using their API key after registration
// - Authenticates using X-API-KEY header against stored device API keys
// - Creates an SSE connection for real-time communication
// - Sets up proper connection metadata for message routing
// - Adds subscription:device:uuid to subscriber:connection:uuid for indirect messaging
// - Cleans up subscriptions and connections when SSE disconnects
// Device listening endpoint with API key authentication
// - Devices connect using their API key after registration
// - Authenticates using X-API-KEY header against stored device API keys
// - Creates an SSE connection for real-time communication
// - Sets up proper connection metadata for message routing
// - Adds subscription:device:uuid to subscriber:connection:uuid for indirect messaging
// - Cleans up subscriptions and connections when SSE disconnects


import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../../$types';
import { sseManager } from '$lib/server/sse';
import { logger } from '$lib/server/logger';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { auth_device } from '$lib/server/device/deviceAuth';

/**
 * Options for creating an SSE stream
 * @property {ConnectionMeta} connectionMeta - Metadata for the connection
 * @property {any} device - The device object
 * @property {App.Locals} locals - Application locals including Prisma client
 * @property {(connectionId: string) => Promise<void>} onConnectionEstablished - Callback when connection is established
 * @property {(connectionId: string) => Promise<void>} onConnectionClosed - Callback when connection is closed
 */
interface SSESteamOptions {
    connectionMeta: ConnectionMeta;
    device: any;
    locals: App.Locals;
    onConnectionEstablished: (connectionId: string) => Promise<void>;
    onConnectionClosed: (connectionId: string) => Promise<void>;
}

/**
 * Creates a ReadableStream for Server-Sent Events (SSE) with proper connection management
 * 
 * @param {SSESteamOptions} options - Configuration options for the SSE stream
 * @param {ConnectionMeta} options.connectionMeta - Metadata for the connection
 * @param {any} options.device - The device object
 * @param {App.Locals} options.locals - Application locals including Prisma client
 * @param {Function} options.onConnectionEstablished - Callback when connection is established
 * @param {Function} options.onConnectionClosed - Callback when connection is closed
 * @returns {ReadableStream} A ReadableStream for SSE communication
 */
function createSSEStream({
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
                logger.error(`Error in connection closed handler:, ${error}`);
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
 * Handles GET requests to establish an SSE connection for device communication
 * 
 * @param {Object} params - Route parameters
 * @param {App.Locals} locals - Application locals including Prisma client
 * @param {Request} request - The incoming request object
 * @returns {Promise<Response>} SSE response stream or error response
 * @throws {Response} Returns error response if authentication or connection fails
 */
export const GET: RequestHandler = async ({ params, locals, request }) => {
    try {
        // Authenticate device and get device info
        const { device, userInfo } = await auth_device(locals, request);
        
        // Define connectionMeta outside the ReadableStream so it's accessible in both start and cancel functions
        const connectionMeta: ConnectionMeta = {
            userInfo: userInfo,
            nodeId: 'node-1',
            protocol: 'sse',
            deviceId: device.id,
            connectedAt: Date.now(),
        };
        
        // Let the ConnectionManager generate the connection ID
        let connectionId: string;

        // Create the SSE stream with connection management
        const stream = createSSEStream({
            connectionMeta,
            device,
            locals,
            onConnectionEstablished: async (connectionId: string) => {
                // Update device connection status in DB
                await locals.prisma.device.update({
                    where: { id: device.id },
                    data: {
                        connected: true,
                        connectedAt: new Date()
                    }
                });
            },
            onConnectionClosed: async (connectionId: string) => {
                try {
                    await locals.prisma.device.update({
                        where: { id: device.id },
                        data: {
                            connected: false,
                            disconnectedAt: new Date()
                        }
                    });
                    logger.debug(`Updated device ${device.id} status to disconnected`);
                } catch (error) {
                    logger.error(`Failed to update device ${device.id} status:`, error);
                }
            }
        });

        // Return the SSE response
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } catch (error) {
        // Handle errors from auth_device or any other synchronous errors
        logger.error(`Error in device/listen endpoint: ${error}`);
        
        // If the error is already a Response (from auth_device), return it directly
        if (error instanceof Response) {
            return error;
        }
        
        // For other errors, return a 500 response
        return json({
            success: false,
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        }, { status: 500 });
    }
};

/**
 * Parameters for cleaning up a connection
 * 
 * @property {string} connectionId - The unique identifier for the connection
 * @property {string} deviceId - The unique identifier for the device
 * @property {App.Locals} locals - Application locals including Prisma client
 */
interface CleanupConnectionParams {
    connectionId: string;
    deviceId: string;
    locals: App.Locals;
}

/**
 * Cleans up all resources associated with a device connection when it's closed
 * 
 * @async
 * @function cleanupConnection
 * @param {string} connectionId - The unique identifier of the connection to clean up
 * @param {string} deviceId - The unique identifier of the device to update
 * @param {App.Locals} locals - Application locals containing Prisma client and other context
 * @returns {Promise<void>} Resolves when cleanup is complete
 * @throws {Error} If there's an error during the cleanup process that should be handled by the caller
 * 
 * @description
 * This function performs the following cleanup tasks:
 * 1. Removes the connection from the ConnectionManager
 * 2. Unsubscribes all subscriptions for the connection
 * 3. Updates the device status in the database
 * 4. Removes device-specific subscriptions
 * 
 * @example
 * await cleanupConnection('conn-123', 'device-456', locals);
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
