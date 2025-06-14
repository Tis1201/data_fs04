import { logger } from '$lib/server/logger';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { BaseMessage, RoutingMessage } from '$lib/server/messaging/interfaces/message';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import { SSEMessageSchema, type SSEMessageInput, createSSEMessage } from '$lib/types/messages';

/**
 * SSE connection endpoint for web UI usage - accessible to both admin and regular users
 */
export const GET: RequestHandler = restrict(
    async ({ request, locals, auth }: any) => {

        // Create connection metadata
        const connectionMeta = {
            userInfo: auth.user,
            nodeId: 'web-node',
            protocol: 'sse',
            connectedAt: Date.now(),
        };

        let connectionId: string | undefined;

        // Create a readable stream for SSE
        const stream = new ReadableStream({
            async start(controller) {

                // Create the SSE connection
                const connection = new SSEConnection(connectionMeta, controller);

                // Register the connection
                ConnectionManager.registerConnection(connection);
                connectionId = connection.meta?.id;

                if (!connectionId) {
                    throw new Error('Failed to generate connection ID');
                }

                // Add subscription for user-specific messages
                // const userSubscriptionKey = `subscription:user:${userId}`;
                // const connectionScope = `subscriber:connection:${connectionId}`;

                // await subscriptionRegistry.addSubscription(userSubscriptionKey, connectionScope);
                // logger.debug(`User subscription added successfully: ${userSubscriptionKey}`);

                // Send initial connected event
                controller.enqueue(`event: connected\ndata: ${JSON.stringify({
                    connectionId,
                    timestamp: new Date().toISOString(),
                })}\n\n`);

                logger.info(`Web SSE connection established for user ${auth.user?.id}`);
            },

            async cancel() {

                if (!connectionId) {
                    throw new Error('Failed to get connection ID for removal');
                }

                // Remove the connection from the connection manager
                ConnectionManager.unregisterConnection(connectionId);

                // Remove any subscriptions for this connection
                // const connectionScope = `subscriber:connection:${clientId}`;
                // await subscriptionRegistry.removeSubscriptionsByScope(connectionScope);

                logger.info(`Web SSE connection closed for user ${auth.user?.id}`);
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
    },
    [SystemRole.ADMIN, SystemRole.USER] // Allow both admin and regular users
);



/**
 * POST handler for sending messages through SSE connections
 * Only accessible to admin users
 */
export const POST: RequestHandler = restrict(
    async ({ request, locals, auth }: any) => {
        try {
            // Read the request body only once
            const body = await request.json();
            
            // Log the received message
            logger.debug(`SSE message received: ${JSON.stringify(body)}`);
            
            // Validate the incoming message using the shared schema
            const messageResult = SSEMessageSchema.safeParse(body);
            
            if (!messageResult.success) {
                logger.error(`Invalid SSE message format: ${JSON.stringify(messageResult.error)}`);
                return json({ 
                    success: false, 
                    error: 'Invalid message format',
                    details: messageResult.error.format()
                }, { status: 400 });
            }
            
            const message = messageResult.data as BaseMessage;
            
            // Create a routing message for the publisher
            const routingMessage: RoutingMessage = {
                id: uuidv4(),
                type: message.type,
                scope: message.scope,
                payload: message.payload,
                // Preserve requestId if it exists in the incoming message
                requestId: message.requestId,
                userInfo: auth.user,
                protocol: 'sse',
                connectionId: '',  // Will be filled by the router
                systemGenerated: false,
                senderId: auth.user?.id,
                senderConnectionProtocol: 'sse',
                timestamp: message.timestamp || new Date().toISOString()
            };
            
            // Use the publisher to route and deliver the message
            await publisher.publish(routingMessage);

            //let's sleep simulate for 10 seconds
            
            // Only acknowledge receipt - the actual response will be sent via SSE
            return json({ 
                success: true, 
                requestId: routingMessage.requestId
            });
            
        } catch (error) {
            logger.error(`Error sending SSE message: ${error}`);
            return json({ 
                success: false, 
                error: 'Failed to send message',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER] // Only admin users can send messages
);