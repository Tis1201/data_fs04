import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sseManager } from '$lib/server/sse';
import { logger } from '$lib/server/logger';
import { v4 as uuidv4 } from 'uuid';
import { validateApiAuth, extractApiKey } from '$lib/server/auth/api-auth';

// SSE connection endpoint - accessible to external applications with proper authentication
export const GET: RequestHandler = async ({ request, cookies, locals }) => {
    // Check for API key in request headers
    const apiKey = extractApiKey(request);
    
    // Validate authentication (either session or API key)
    const auth = await validateApiAuth(cookies, true, apiKey);
    if (!auth.valid) {
        return auth.response;
    }

    // Create a unique ID for this client
    const clientId = uuidv4();
    const authMethod = auth.authMethod;
    const userIdentifier = authMethod === 'session' ? auth.user.email : `api-key-user-${auth.userId}`;
    
    // Create a readable stream for SSE
    const stream = new ReadableStream({
        start(controller) {
            logger.debug('SSE connection established', { clientId, authMethod, userIdentifier });
            
            // Add this client to the SSE manager
            sseManager.addClient(clientId, controller);
            
            // Send initial connected event
            controller.enqueue(`event: connected\ndata: ${JSON.stringify({ 
                clientId, 
                timestamp: new Date().toISOString(),
                authMethod
            })}\n\n`);
        },
        cancel() {
            // Clean up when the connection is closed
            logger.debug('SSE connection closed', { clientId, authMethod, userIdentifier });
            sseManager.removeClient(clientId);
        }
    });

    // Return the SSE response
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
        }
    });
};

// Broadcast message endpoint - requires authentication
export const POST: RequestHandler = async ({ request, cookies }) => {
    // Check for API key in request headers
    const apiKey = extractApiKey(request);
    
    // Validate authentication (require admin role)
    const auth = await validateApiAuth(cookies, true, apiKey);
    if (!auth.valid) {
        return auth.response;
    }
    
    try {
        const body = await request.json();
        const { event, data } = body;
        
        if (!event) {
            return json({ error: 'Event name is required' }, { status: 400 });
        }
        
        sseManager.broadcast(event, data || {});
        
        // Log the broadcast with user info based on auth method
        const authMethod = auth.authMethod;
        const userIdentifier = authMethod === 'session' ? auth.user.email : `api-key-user-${auth.userId}`;
        logger.debug('SSE message broadcast', { event, authMethod, userIdentifier });
        
        return json({ success: true });
    } catch (error) {
        logger.error('Error broadcasting SSE message', { error });
        return json({ error: 'Invalid request' }, { status: 400 });
    }
};
