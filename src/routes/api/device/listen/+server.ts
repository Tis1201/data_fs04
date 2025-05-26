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
import { prisma } from '$lib/server/prisma';
import { checkPinFormat } from '$lib/server/device/devicePinChecker';
import type { DeviceMeta } from '$lib/server/device/deviceMeta';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
import { restrict_device } from '$lib/server/security/guards';


export const GET: RequestHandler = async ({ params, locals, request }) => {
    // Get the API key directly
    const apiKey = request.headers.get('x-api-key') || request.headers.get('x-api-Key');

    if (!apiKey) {
        logger.warn('No API Key provided');
        return json({ error: 'No API Key provided' }, { status: 400 });
    }

    const prisma = locals.prisma;

    // Find device by apiKey
    const device = await prisma.device.findFirst({
        where: { apiKey },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    systemRole: true
                }
            }
        }
    });

    if (!device) {
        logger.warn(`Invalid API key: ${apiKey.substring(0, 8)}...`);
        return json({ error: 'Invalid API key', code: 'INVALID_API_KEY' }, { status: 401 });
    }

    logger.info(`Device ${device.id} (${device.name || 'unnamed'}) connected via API key, owned by: ${device.user.name}`);

    const userInfo = await userInfoByUserId(device.user.id);
    
    // Add debugging to check device object structure
    logger.debug('Device object structure:', { 
        deviceId: device.id,
        deviceKeys: Object.keys(device)
    });
    
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

    logger.debug('Creating ReadableStream for SSE connection');
    const stream = new ReadableStream({
        async start(controller) {
            try {
                logger.debug('SSE ReadableStream started');
                
                // Create the SSE connection
                logger.debug('Creating SSEConnection instance');
                const connection = new SSEConnection(connectionMeta, controller);
                

                ConnectionManager.registerConnection(connection);

                let connectionId = connection.meta.id;

                // // Add subscription for device:deviceId -> connection:connectionId
                const deviceSubscriptionKey = `subscription:device:${device.id}`;
                const connectionScope = `subscriber:connection:${connectionId}`;
                
                // logger.debug(`Adding subscription: ${deviceSubscriptionKey} -> ${connectionScope}`);
                await subscriptionRegistry.addSubscription(deviceSubscriptionKey, connectionScope);
                logger.debug('Subscription added successfully');
                
                // Update device connection status in DB
                await prisma.device.update({
                    where: { id: device.id },
                    data: {
                        connected: true,
                        connectedAt: new Date(),
                    }
                });
                

                // // Send initial connection success message
                // const initialMessage = {
                //     type: 'system',
                //     action: 'connected',
                //     connectionId,
                //     deviceId: device.id,
                //     timestamp: new Date().toISOString()
                // };
                
                // logger.debug('Sending initial message to device');
                // await connection.send(initialMessage);
                // logger.debug('Initial message sent successfully');
                
            } catch (error) {
                logger.error(`Error in SSE ReadableStream start: ${error}`);
                // Rethrow to ensure the error is propagated
                //Update device connection status in DB
                await prisma.device.update({
                    where: { id: device.id },
                    data: {
                        connected: false,
                        disconnectedAt: new Date(),
                    }
                });

                throw error;
            }
        },

        async cancel() {
            logger.debug(`SSE connection cancel called for connection: ${connectionId}`);
            
            try {
                await prisma.device.update({
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
            
            try {
                await cleanupConnection(connectionId, device.id);
                logger.debug(`Cleanup completed for connection: ${connectionId}`);
            } catch (error) {
                logger.error(`Error during connection cleanup:`, error);
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
};

/**
 * Clean up all resources when a device connection is closed
 */
async function cleanupConnection(connectionId: string, deviceId: string): Promise<void> {
    if (!connectionId) {
        logger.warn('No connection ID provided for cleanup');
        return;
    }

    logger.debug(`Starting cleanup for connection: ${connectionId}`);
    
    try {
        // Remove SSE connection
        logger.debug(`Removing SSE connection: ${connectionId}`);
        sseManager.removeConnection(connectionId);
        
        // Unregister from connection manager
        logger.debug(`Unregistering connection from ConnectionManager: ${connectionId}`);
        await ConnectionManager.unregisterConnection(connectionId);
        
        // Update device connection status in DB if deviceId is provided
        if (deviceId) {
            try {
                await prisma.device.update({
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
            
            // Remove device subscription
            const deviceSubscriptionKey = `subscription:device:${deviceId}`;
            const connectionScope = `subscriber:connection:${connectionId}`;
            
            logger.debug(`Removing subscription: ${deviceSubscriptionKey} -> ${connectionScope}`);
            try {
                await subscriptionRegistry.removeSubscription(deviceSubscriptionKey, connectionScope);
                logger.debug(`Successfully removed subscription for device ${deviceId}`);
            } catch (subError) {
                logger.error(`Error removing subscription for device ${deviceId}:`, subError);
                // Continue with cleanup even if subscription removal fails
            }
        } else {
            logger.warn('No device ID provided for cleanup');
        }
        
        logger.info(`Successfully cleaned up connection: ${connectionId}`);
    } catch (error) {
        logger.error(`Error during cleanup of connection ${connectionId}:`, error);
        throw error; // Rethrow to ensure the error is logged by the caller
    }
}
