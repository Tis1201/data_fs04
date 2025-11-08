import { logger } from '$lib/server/logger';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { MessageDispatcher } from '$lib/server/messaging/core/dispatcher';
import { publisher } from '$lib/server/messaging/core/publisher';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { handleApiError } from '$lib/server/errors/errorHandlers';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { BaseMessage, RoutingMessage } from '$lib/server/messaging/interfaces/message';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { SSEMessageSchema, type SSEMessageInput, createSSEMessage } from '$lib/types/messages';

/**
 * SSE connection endpoint for web UI usage - accessible to both admin and regular users
 */
export const GET: RequestHandler = restrict(
    async ({ request, locals, auth }: any) => {

        // Create connection metadata
        const connectionMeta = {
            userInfo: auth.user,
            nodeId: 'web',
            protocol: 'sse',
            connectedAt: Date.now(),
        };

        // DEBUG: Log web SSE connection
        logger.info(`[DEBUG] Web SSE connection established via /api/sse`, {
            userId: auth.user?.id,
            nodeId: 'web',
            protocol: 'sse'
        });

        let connection: SSEConnection | undefined;

        // Create a readable stream for SSE
        const stream = new ReadableStream({
            async start(controller) {

                // Create the SSE connection
                connection = new SSEConnection(connectionMeta, controller);

                // Register the connection
                ConnectionManager.registerConnection(connection);
                const connectionId = connection.meta?.id;

                if (!connectionId) {
                    throw new Error('Failed to generate connection ID');
                }

                // Add subscription for user-specific messages
                // const userSubscriptionKey = `subscription:user:${userId}`;
                // const connectionScope = `subscriber:connection:${connectionId}`;

                // await subscriptionRegistry.addSubscription(userSubscriptionKey, connectionScope);
                // logger.debug(`User subscription added successfully: ${userSubscriptionKey}`);

                // Register this connection to receive device updates for this user's devices
                try {
                    const userId = auth.user?.id;
                    if (userId) {
                        const urlObj = new URL(request.url);
                        const deviceIdFromQuery = urlObj.searchParams.get('deviceId');
                        const currentDeviceId = deviceIdFromQuery || request.headers.get('x-device-id') || undefined;
                        if (currentDeviceId) {
                            // Correct order: key = channel, scope = subscriber
                            await subscriptionRegistry.addSubscription(`subscription:device:${currentDeviceId}`, `subscriber:connection:${connectionId}`);
                            logger.debug(`Subscribed connection ${connectionId} to subscription:device:${currentDeviceId}`);
                        }
                    }
                } catch (e) {
                    logger.warn(`Failed to auto-subscribe connection to device channel: ${String(e)}`);
                }

                // Send initial connected event
                controller.enqueue(`event: connected\ndata: ${JSON.stringify({
                    connectionId,
                    timestamp: new Date().toISOString(),
                })}\n\n`);

                logger.info(`[SSE] Web SSE connection established for user ${auth.user?.id} with connectionId ${connectionId}`);
            },

            async cancel() {
                // IMPORTANT: Let SSEConnection handle its own cleanup
                // This includes: stopping pings, closing controller, removing subscriptions, unregistering
                if (connection) {
                    logger.info(`[SSE] Connection closing for user ${auth.user?.id}, triggering cleanup`);
                    await connection.close();
                    logger.info(`[SSE] Connection ${connection.meta.id} cleanup complete`);
                } else {
                    logger.warn(`[SSE] Connection close requested but connection object not found`);
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
            const auth           = await locals.auth.validate();
            const currentAccount = auth?.currentAccount;
            
            logger.debug(`SSE message received, using currentAccount: ${JSON.stringify(currentAccount)}`);

            // Read the request body only once
            const body = await request.json();
            
            // Log the received message with focus on connectionId
            logger.debug(`SSE message received: ${JSON.stringify(body)}`);
            logger.debug(`SSE message senderConnectionId from UI: ${body.senderConnectionId || 'NOT SET'}`);
            
            // Check if senderConnectionId matches any active connection
            const userConnections = await ConnectionManager.getConnectionsByUser(auth.user.id);
            // Filter out any undefined/null connections and connections without meta (cleanup issue in ConnectionManager)
            const validConnections = userConnections.filter(conn => conn != null && conn.meta != null);
            logger.debug(`[SSE] User ${auth.user.id} has ${validConnections.length} active connections (total: ${userConnections.length})`);
            validConnections.forEach(conn => {
                logger.debug(`[SSE] - Connection: ${conn.id}, protocol: ${conn.meta?.protocol || 'unknown'}, connectedAt: ${conn.meta?.connectedAt ? new Date(conn.meta.connectedAt).toISOString() : 'unknown'}`);
            });
            
            // Also check if the connection exists directly (not filtered)
            const directConnection = ConnectionManager.getConnection(body.senderConnectionId);
            if (directConnection) {
                logger.debug(`[SSE] ✓ Direct connection lookup found: ${body.senderConnectionId}, protocol: ${directConnection.meta?.protocol || 'unknown'}`);
            } else {
                logger.warn(`[SSE] ⚠️ Direct connection lookup failed for: ${body.senderConnectionId}`);
            }
            
            const matchingConn = validConnections.find(c => c && c.id === body.senderConnectionId);
            if (!matchingConn) {
                logger.warn(`[SSE] ⚠️ senderConnectionId ${body.senderConnectionId} not found in active connections!`);
            } else {
                logger.debug(`[SSE] ✓ senderConnectionId ${body.senderConnectionId} matches active connection`);
            }
            
            // Validate the incoming message using the shared schema
            const messageResult = SSEMessageSchema.safeParse(body);
            
            if (!messageResult.success) {
                logger.error(`Invalid SSE message format: ${JSON.stringify(messageResult.error)}`);
                return handleApiError({
                    error: new Error('Invalid message format'),
                    defaultMessage: 'Invalid message format',
                    action: 'SSE message validation',
                    status: 400
                });
            }
            
            const message = messageResult.data as BaseMessage;
            
            // Find the SSE connection for this user instead of generating a new one
            let connectionId = message.senderConnectionId;
            
            if (!connectionId) {
                // Find the SSE connection for this user
                const userConnections = await ConnectionManager.getConnectionsByUser(auth.user.id);
                // Filter out any undefined/null connections and connections without meta
                const validUserConnections = userConnections.filter(conn => conn != null && conn.meta != null);
                const sseConnection = validUserConnections.find(conn => 
                    conn.meta?.protocol === 'sse' && 
                    conn.meta?.userInfo?.id === auth.user.id
                );
                
                if (sseConnection) {
                    connectionId = sseConnection.id;
                    logger.debug(`[SSE] Found existing SSE connection: ${connectionId}`);
                } else {
                    // Fallback to generating a new one if no SSE connection found
                    connectionId = `sse-${uuidv4()}`;
                    logger.warn(`[SSE] No existing SSE connection found for user ${auth.user.id}, generated new ID: ${connectionId}`);
                }
            }
            
            // Determine if this is a WhatsApp message
            const isWhatsAppMessage = message.type === 'whatsapp';
            const isDeviceMessage   = message.type === 'device';
            
            // Create a routing message for the publisher (will be used for non-WhatsApp messages)
            const routingMessage: RoutingMessage = {
                id: uuidv4(),
                type: message.type,
                scope: message.scope,
                payload: message.payload,
                requestId: message.requestId,
                userInfo: auth.user,
                currentAccount: currentAccount,
                protocol: 'sse',
                connectionId: '',  // Will be filled by the router
                systemGenerated: false,
                senderId: auth.user?.id,
                senderConnectionId: connectionId,
                senderAccountId: currentAccount?.id,
                senderConnectionProtocol: 'sse',
                timestamp: message.timestamp || new Date().toISOString()
            };
            
            // Create an InMessage object similar to how WSConnection does it
            const inMessage = {
                type: message.type,
                scope: message.scope,
                payload: message.payload,
                userInfo: {
                    ...auth.user,
                    currentAccount: currentAccount
                },
                protocol: 'sse',
                connectionId: connectionId,
                requestId: message.requestId,
                accountId: currentAccount?.accountId
            };
            
            // Log the message being processed
            logger.info(`[SSE] Processing message: type=${inMessage.type}, action=${inMessage.payload?.action}`);
            
            if (isWhatsAppMessage || isDeviceMessage) {
                // For WhatsApp messages, directly dispatch to the handler
                await MessageDispatcher.dispatch(inMessage);
                // The WhatsApp handler will publish responses via the publisher
            } 
            else {
                // For other message types, use the publisher as before
                await publisher.publish(routingMessage);
            }
            
            // Return success response
            return json({
                success: true,
                message: 'Message received and processed successfully',
                requestId: routingMessage.requestId
            });
            
        } catch (error) {
            // Single standardized error handler for all errors
            return handleApiError({
                error,
                defaultMessage: 'Failed to process SSE message',
                action: 'SSE message handling'
            });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER] // Only admin users can send messages
);
