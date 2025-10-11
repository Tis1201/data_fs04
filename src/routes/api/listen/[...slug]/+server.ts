import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { logger } from '$lib/server/logger';
import { v4 as uuidv4 } from 'uuid';
import { validateApiAuth, extractApiKey } from '$lib/server/auth/api-auth';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';

// SSE connection endpoint - accessible to external applications with proper authentication
export const GET: RequestHandler = async ({ params, locals }) => {

    const slug = params.slug as string;


    logger.debug(`SSE connection request ${slug}`);

    //throw error if slug is empty?
    if (!slug) {
        logger.warn(`Slug is empty`);
        return json({ error: 'No slug provided' }, { status: 400 });
    }

    const prisma = locals.prisma;

    logger.debug(`prisma: ${prisma}`)

    //Find listener by postfix
    const listener = await prisma.listenerEndpoint.findFirst({
        where: {
            postfix: slug
        }
    });

    if (!listener) {
        logger.warn(`Listener not found for slug: ${slug}`);
        return json({ error: 'Listener not found' }, { status: 404 });
    }

    logger.debug(`Listener found: ${JSON.stringify(listener)}`);

    const userId = listener.userId;

    const userInfo = await userInfoByUserId(userId);

    if (!userInfo) {
        logger.warn(`User not found for userId: ${userId}`);
        return json({ error: 'User not found' }, { status: 404 });
    }

    logger.debug(`User found: ${JSON.stringify(userInfo)}`);

    //Get the list of webhooks and whatsapp accounts for this listener
    const webhooks = await prisma.listenerWebhookEndpoint.findMany({
        where: {
            listenerId: listener.id
        }
    });

    const whatsappAccounts = await prisma.listenerWhatsAppAccount.findMany({
        where: {
            listenerId: listener.id
        },
        include: {
            whatsappAccount: {
                select: {
                    client_id: true
                }
            }
        }
    });

    logger.debug(`Webhooks found: ${JSON.stringify(webhooks)}`);
    logger.debug(`WhatsApp accounts found: ${JSON.stringify(whatsappAccounts)}`);

    // Create a readable stream for SSE
    const meta: ConnectionMeta = {
        userInfo: userInfo,
        nodeId: 'listener',
        protocol: 'sse',
        connectedAt: Date.now(),
        route: `api/listen/${params.slug}`
    };

    const stream = new ReadableStream({
        start(controller) {

            //Create SSEConnection and add to ConnectionManager
            const connection = new SSEConnection(meta, controller);
            ConnectionManager.registerConnection(connection);

            logger.debug(`SSE connection established: ${meta.id}`);

            for (const webhook of webhooks) {
                subscriptionRegistry.addSubscription(`subscription:webhook:${webhook.webhookEndpointId}`, `subscriber:connection:${meta.id}`);
            }

            for (const whatsappAccount of whatsappAccounts) {
                // Use the client_id for subscription instead of the database ID to match the WhatsAppAccountManager registration
                subscriptionRegistry.addSubscription(`subscription:whatsapp:${whatsappAccount.whatsappAccount.client_id}`, `subscriber:connection:${meta.id}`);
            }

        },

        cancel() {
            // Clean up when the connection is closed
            logger.debug('SSE connection closed', meta);
            ConnectionManager.unregisterConnection(meta.id!);

            for (const webhook of webhooks) {
               
                subscriptionRegistry.removeSubscription(`subscription:webhook:${ webhook.webhookEndpointId}`, `subscriber:connection:${meta.id}`);
            }

            for (const whatsappAccount of whatsappAccounts) {
                // Use the client_id for unsubscription to match the subscription
                subscriptionRegistry.removeSubscription(`subscription:whatsapp:${whatsappAccount.whatsappAccount.client_id}`, `subscriber:connection:${meta.id}`);
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


