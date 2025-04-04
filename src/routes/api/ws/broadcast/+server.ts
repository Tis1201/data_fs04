import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GlobalThisWSS, type ExtendedGlobal } from '$lib/server/websocket/WebSocketUtils';
import { restrict } from '$lib/server/security/guards';
import { eventRouter, EventType } from '$lib/server/event';
import { logger } from '$lib/server/logger';
import { EventDestination, EventScope, type EventData } from '$lib/server/event/EventRouter';

// Restrict to admin users only
const handler = restrict(async ({ request, locals }) => {
    try {
        // Ensure auth is validated before proceeding
        const auth = await locals.auth.validate();
        
        const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
        
        if (!wss) {
            return json({ success: false, error: 'WebSocket server not initialized' }, { status: 503 });
        }

        const body = await request.json();
        const { message, type = 'broadcast' } = body;

        if (!message) {
            return json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        logger.debug(`Broadcasting message: ${message}, user: ${auth.user.id}`);

        const event_msg:EventData = {
            type: EventType.MESSAGE,
            destination: EventDestination.WEBSOCKET,
            scope: EventScope.USER,
            user_id: auth?.user?.id,
            payload: message,
            timestamp: Date.now()
        };

        logger.debug(`Routing event: ${JSON.stringify(event_msg)}`);

        eventRouter.route(event_msg);

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
