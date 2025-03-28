// Process webhooks with valid postfixes from the database
import { json } from '@sveltejs/kit';
import { sseManager } from '$lib/server/sse';
import { logger } from '$lib/server/logger';

export const POST = async ({ request, params, locals }) => {
    const { prisma } = locals;
    // Extract the postfix from the URL path
    const postfix = params.slug;
    
    if (!postfix) {
        logger.warn('Webhook request received without postfix');
        return json({ error: 'Invalid webhook endpoint' }, { status: 404 });
    }
    
    // Check if the webhook endpoint exists in the database
    const webhookEndpoint = await prisma.WebhookEndPoint.findFirst({
        where: {
            postfix,
            status: 'ACTIVE' // Only process webhooks for active endpoints
        }
    });
    
    if (!webhookEndpoint) {
        logger.warn('Webhook request received with invalid postfix', { postfix });
        return json({ error: 'Invalid webhook endpoint' }, { status: 404 });
    }

    try {
        // Get URL parameters
        const params = new URL(request.url).searchParams;
        const paramsObj = Object.fromEntries(params);
        
        // Try to parse the request body as JSON
        let body = {};
        try {
            const contentType = request.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                body = await request.json();
            }
        } catch (error) {
            // If body parsing fails, continue with empty body
            logger.debug('Failed to parse webhook request body', { error });
        }
        
        // Prepare webhook data to broadcast
        const webhookData = {
            timestamp: new Date().toISOString(),
            params: paramsObj,
            body,
            path: new URL(request.url).pathname,
            method: request.method,
            webhookId: webhookEndpoint.id,
            webhookName: webhookEndpoint.name
        };
        
        // Update the lastUsedAt timestamp for the webhook
        await prisma.WebhookEndPoint.update({
            where: { id: webhookEndpoint.id },
            data: { lastUsedAt: new Date() }
        });
        
        // Log webhook data
        logger.info('Webhook received', { webhookData });
        
        // Broadcast webhook data to all SSE clients
        sseManager.broadcast('webhook', webhookData);
        
        // Return a 200 response
        return json({ message: 'Webhook received successfully' }, { status: 200 });
    } catch (error) {
        logger.error('Error processing webhook', { error });
        return json({ error: 'Failed to process webhook' }, { status: 500 });
    }
};
