import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { initWhatsAppClient, generatePairingCode, getWhatsAppClient } from '$lib/server/bailey/client';

export const POST: RequestHandler = async ({ request, locals }) => {
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'Not authorized' }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { action, phoneNumber, accountId } = body;

        // Initialize WhatsApp client based on the requested action
        if (action === 'requestQR') {
            // Get the WebSocket connection for this client
            if (!locals.wss) {
                return json({ error: 'WebSocket server not available' }, { status: 500 });
            }
            
            // Find the WebSocket connection for this client
            const socket = Array.from(locals.wss.clients).find(client => {
                // In a real implementation, you'd match the client by session ID or user ID
                // For now, we'll just use the first available socket
                return client.readyState === 1; // OPEN
            });
            
            if (!socket) {
                return json({ error: 'No active WebSocket connection found' }, { status: 400 });
            }
            
            // Initialize a new WhatsApp client
            try {
                const clientId = await initWhatsAppClient(phoneNumber, accountId, socket);
                return json({ success: true, clientId });
            } catch (error) {
                console.error('Failed to initialize WhatsApp client:', error);
                return json({ error: 'Failed to initialize WhatsApp client' }, { status: 500 });
            }
        } else if (action === 'requestPairingCode') {
            // Get the WebSocket connection for this client
            if (!locals.wss) {
                return json({ error: 'WebSocket server not available' }, { status: 500 });
            }
            
            // Find the WebSocket connection for this client
            const socket = Array.from(locals.wss.clients).find(client => {
                // In a real implementation, you'd match the client by session ID or user ID
                // For now, we'll just use the first available socket
                return client.readyState === 1; // OPEN
            });
            
            if (!socket) {
                return json({ error: 'No active WebSocket connection found' }, { status: 400 });
            }
            
            // Initialize a new WhatsApp client and generate pairing code
            try {
                const clientId = await initWhatsAppClient(phoneNumber, accountId, socket);
                const pairingCode = await generatePairingCode(clientId, phoneNumber);
                
                if (!pairingCode) {
                    return json({ error: 'Failed to generate pairing code' }, { status: 500 });
                }
                
                return json({ success: true, clientId, pairingCode });
            } catch (error) {
                console.error('Failed to generate pairing code:', error);
                return json({ error: 'Failed to generate pairing code' }, { status: 500 });
            }
        } else {
            // No valid action specified
            return json({ error: 'Invalid action specified' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error processing WhatsApp authentication request:', error);
        return json({ error: 'Failed to process request' }, { status: 500 });
    }
};
