import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GlobalThisWSS, type ExtendedGlobal } from '$lib/server/webSocketUtils';
import { handleWebRTCMessage } from '$lib/server/webrtcSignalingUtils';

/**
 * Handle WebRTC signaling via HTTP POST
 * This API provides an alternative method for WebRTC signaling when WebSocket is not preferred or available
 */
export const POST = (async ({ request }) => {
    try {
        const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
        if (!wss) {
            return json({ success: false, error: 'WebSocket server not initialized' }, { status: 503 });
        }

        const body = await request.json();
        
        // Validate message has required fields
        if (!body.type || !body.sender) {
            return json({ 
                success: false, 
                error: 'Invalid message format. Required fields: type, sender' 
            }, { status: 400 });
        }

        // Find the sender's websocket connection
        const senderSocket = Array.from(wss.clients).find(
            client => client.socketId === body.sender && client.readyState === 1
        );

        if (!senderSocket) {
            return json({ 
                success: false, 
                error: 'Sender not connected via WebSocket'
            }, { status: 404 });
        }

        // Process the WebRTC message
        handleWebRTCMessage(body, senderSocket, wss);

        return json({ 
            success: true, 
            message: 'Signal processed successfully'
        });
    } catch (error) {
        console.error('Error processing WebRTC signal:', error);
        return json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}) satisfies RequestHandler;
