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
            'Connection': 'keep-alive'
        }
    });
};

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
        
        // Get sender information
        const sender = auth.authMethod === 'apiKey' ? auth.userInfo : {
            email: auth.user.email,
            name: auth.user.name
        };
        
        // Handle string messages directly as content
        let parsedData = data;
        let content: string | undefined;

        if (typeof data === 'string') {
            content = data;
            parsedData = { content: data };
        } else if (typeof data === 'object' && data !== null) {
            content = data.content;
            if (!content && typeof data.data === 'string') {
                content = data.data;
            }
        }

        // Format the message with event name and metadata
        const messageData = {
            event,
            content,
            data: parsedData,
            sender,
            timestamp: new Date().toISOString()
        };
        
        // Broadcast using the custom event name
        sseManager.broadcast('message', messageData);
        
        // Log the broadcast with user info
        logger.debug('SSE message broadcast', { 
            event, 
            authMethod: auth.authMethod, 
            userIdentifier: auth.authMethod === 'session' ? auth.user.email : `api-key-user-${auth.userId}`,
            sender
        });
        
        return json({ success: true });
    } catch (error) {
        logger.error('Error broadcasting SSE message', { 
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            timestamp: new Date().toISOString()
        });
        
        // Return detailed error information in development
        const errorResponse = {
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack,
                name: error.name
            } : null
        };
        
        return json(errorResponse, { status: 400 });
    }
};
