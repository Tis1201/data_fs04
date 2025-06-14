import type { RequestEvent } from '@sveltejs/kit';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { createSSEStream } from './sseStream';
import { logger } from '$lib/server/logger';
import { 
    ResponseStatus,
    ResponseCategory,
    createErrorResponse,
    toResponse
} from '$lib/shared/response_format';

/**
 * Options for creating an SSE handler
 */
export interface SSERouteOptions<T = unknown> {
    /**
     * Authenticate the request and return the necessary data for the connection
     */
    authenticate: (locals: App.Locals, request: Request) => Promise<{
        connectionMeta: Omit<ConnectionMeta, 'id' | 'connectedAt'>;
        device: { id: string };
        [key: string]: any;
    }>;
    
    /**
     * Called when a connection is established
     */
    onConnect?: (params: {
        connectionId: string;
        device: { id: string };
        locals: App.Locals;
        event: RequestEvent;
    }) => Promise<void> | void;
    
    /**
     * Called when a connection is closed
     */
    onDisconnect?: (params: {
        connectionId: string;
        device: { id: string };
        locals: App.Locals;
        event: RequestEvent;
    }) => Promise<void> | void;
    
    /**
     * Whether to update the device's connected status in the database
     * @default true
     */
    updateDeviceStatus?: boolean;
}

/**
 * Creates a reusable SSE route handler with standardized error handling and connection management
 */
export function createSSEHandler<T = unknown>(options: SSERouteOptions<T>) {
    return async (event: RequestEvent) => {
        const { locals, request } = event;
        
        try {
            // Authenticate and get connection data
            const { connectionMeta, device, ...additionalData } = await options.authenticate(locals, request);
            
            // Create the full connection metadata with all required properties
            const fullConnectionMeta: ConnectionMeta = {
                userInfo: connectionMeta.userInfo,
                nodeId: connectionMeta.nodeId,
                protocol: connectionMeta.protocol,
                deviceId: connectionMeta.deviceId,
                connectedAt: Date.now(),
            };
            
            // Create the SSE stream using our low-level implementation
            const stream = createSSEStream({
                connectionMeta: fullConnectionMeta,
                device,
                locals,
                onConnectionEstablished: async (connectionId) => {
                    if (options.updateDeviceStatus !== false) {
                        try {
                            await locals.prisma.device.update({
                                where: { id: device.id },
                                data: { connected: true, connectedAt: new Date() }
                            });
                            logger.info(`Device ${device.id} connection established`);
                        } catch (error) {
                            logger.error(`Failed to update device ${device.id} status on connect: ${error}`);
                        }
                    }
                    
                    if (options.onConnect) {
                        await options.onConnect({
                            connectionId,
                            device,
                            locals,
                            event
                        });
                    }
                },
                onConnectionClosed: async (connectionId) => {
                    if (options.updateDeviceStatus !== false) {
                        try {
                            await locals.prisma.device.update({
                                where: { id: device.id },
                                data: { connected: false, disconnectedAt: new Date() }
                            });
                            logger.info(`Device ${device.id} connection closed`);
                        } catch (error) {
                            logger.error(`Failed to update device ${device.id} status on disconnect: ${error}`);
                        }
                    }
                    
                    if (options.onDisconnect) {
                        await options.onDisconnect({
                            connectionId,
                            device,
                            locals,
                            event
                        });
                    }
                },
                ...additionalData
            });
            
            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });
            
        } catch (error) {
            logger.error(`Error in SSE handler: ${error}`);
            
            if (error instanceof Response) {
                return error;
            }
            
            // Create a standardized error response
            const errorResponse = createErrorResponse({
                error: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                status: ResponseStatus.SERVER_ERROR,
                category: ResponseCategory.DEVICE,
                details: `Error establishing SSE connection: ${error}`,
                meta: { deviceId: device?.id }
            });
            
            return toResponse(errorResponse);
        }
    };
}