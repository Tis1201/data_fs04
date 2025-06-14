import { logger } from '$lib/server/logger';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import type { RequestHandler } from '@sveltejs/kit';

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
