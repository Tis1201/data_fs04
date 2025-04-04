import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GlobalThisWSS, type ExtendedGlobal } from '$lib/server/websocket/WebSocketUtils';
import { restrict } from '$lib/server/security/guards';
import { validateAndGetUserId } from '$lib/server/security/auth-utils';
import { eventRouter, EventType } from '$lib/server/event';
import { logger } from '$lib/server/logger';
import { EventDestination, EventScope, type EventData } from '$lib/server/event/EventRouter';

// Restrict to admin users only
const handler = restrict(async ({ request, locals }) => {
    try {
        const body = await request.json();
        const { message, type = 'broadcast' } = body;

        if (!message) {
            return json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        // Get user ID in one step - validates auth and gets ID
        const userId = await validateAndGetUserId(locals);
        
        // Send the message to the user
        eventRouter.route_private_ws(userId, message);

        return json({ 
            success: true, 
            message: 'Message broadcasted successfully',
            clientCount: wss.clients.size
        });
    } catch (error) {
        logger.error('Error broadcasting message:', error);
        return json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: error instanceof Error ? error.status : 500 });
    }
}, ['ADMIN']);

export const POST = handler satisfies RequestHandler;
