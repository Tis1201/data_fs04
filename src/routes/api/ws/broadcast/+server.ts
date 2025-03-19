import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GlobalThisWSS, type ExtendedGlobal } from '$lib/server/webSocketUtils';

export const POST = (async ({ request }) => {
    try {
        const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
        if (!wss) {
            return json({ success: false, error: 'WebSocket server not initialized' }, { status: 503 });
        }

        const body = await request.json();
        const { message, type = 'broadcast' } = body;

        if (!message) {
            return json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        // Broadcast the message to all connected clients
        wss.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(JSON.stringify({
                    type,
                    data: {
                        message,
                        timestamp: new Date().toISOString()
                    }
                }));
            }
        });

        return json({ 
            success: true, 
            message: 'Message broadcasted successfully',
            clientCount: wss.clients.size
        });
    } catch (error) {
        console.error('Error broadcasting message:', error);
        return json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}) satisfies RequestHandler;
