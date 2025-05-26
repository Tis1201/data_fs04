// Device listening endpoint with API key authentication
// - Handles device authentication and connection setup
// - Manages the lifecycle of device connections
// - Uses the SSE handler for low-level SSE communication

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../../$types';
import { logger } from '$lib/server/logger';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { auth_device } from '$lib/server/device/deviceAuth';
import { createSSEStream, type SSESteamOptions } from './handle_sse';

type AppLocals = App.Locals;

/**
 * Handles GET requests to establish an SSE connection for device communication
 * 
 * @param {Object} params - Route parameters
 * @param {AppLocals} locals - Application locals including Prisma client
 * @param {Request} request - The incoming request object
 * @returns {Promise<Response>} SSE response stream or error response
 * @throws {Response} Returns error response if authentication or connection fails
 */
export const GET: RequestHandler = async ({ params, locals, request }) => {
    try {
        // Authenticate device and get device info
        const { device, userInfo } = await auth_device(locals, request);
        
        // Define connection metadata
        const connectionMeta: ConnectionMeta = {
            userInfo: userInfo,
            nodeId: 'node-1',
            protocol: 'sse',
            deviceId: device.id,
            connectedAt: Date.now(),
        };

        // Create the SSE stream with connection management
        const stream = createSSEStream({
            connectionMeta,
            device,
            locals,
            onConnectionEstablished: async (connectionId: string) => {
                // Update device connection status in DB
                try {
                    await locals.prisma.device.update({
                        where: { id: device.id },
                        data: {
                            connected: true,
                            connectedAt: new Date()
                        }
                    });
                    logger.info(`Device ${device.id} connection established`);
                } catch (error) {
                    logger.error(`Failed to update device ${device.id} status on connect:`, error);
                }
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
                    logger.info(`Device ${device.id} connection closed`);
                } catch (error) {
                    logger.error(`Failed to update device ${device.id} status on disconnect:`, error);
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
