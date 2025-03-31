import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { setupClientEventListeners } from '$lib/server/whatsapp/utils';
import { logger } from '$lib/server/logger';
import { apiGuard } from '$lib/server/security/api-guard';

export const POST: RequestHandler = apiGuard(['ADMIN'], async ({ request, locals }) => {

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
                // Create a new WhatsApp client using the WhatsAppAccountManager
                const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient(phoneNumber, accountId);
                
                // Get the client instance
                const client = whatsAppAccountManager.getClient(clientId);
                if (!client) {
                    return json({ error: 'Failed to get WhatsApp client after creation' }, { status: 500 });
                }
                
                // Set up event listeners to forward events to WebSocket
                setupClientEventListeners(client, socket, clientId);
                
                logger.info(`WhatsApp client created with ID ${clientId}`);
                return json({ success: true, clientId });
            } catch (error) {
                logger.error('Failed to initialize WhatsApp client:', error);
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
                // Create a new WhatsApp client using the WhatsAppAccountManager
                const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient(phoneNumber, accountId);
                
                // Get the client instance
                const client = whatsAppAccountManager.getClient(clientId);
                if (!client) {
                    return json({ error: 'Failed to get WhatsApp client after creation' }, { status: 500 });
                }
                
                // Set up event listeners to forward events to WebSocket
                setupClientEventListeners(client, socket, clientId);
                
                logger.info(`WhatsApp client created with ID ${clientId}`);
                
                // Note: Pairing code generation is not directly available in WhatsAppAccountClient
                // Return a message indicating this limitation
                return json({ 
                    success: true, 
                    clientId, 
                    message: 'QR code will be sent via WebSocket. Pairing code generation not implemented in the new WhatsApp client.'
                });
            } catch (error) {
                logger.error('Failed to generate pairing code:', error);
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
