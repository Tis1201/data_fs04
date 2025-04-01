import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { initWhatsAppClient, generatePairingCode, getWhatsAppClient } from '$lib/server/bailey/client';
import { logger } from '$lib/server/logger';

export const actions: Actions = {
    requestQRCode: async ({ request, locals }) => {
        // Ensure user is authenticated and has admin role
        const auth = await locals.auth.validate();
        if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
            return fail(403, { error: 'Not authorized' });
        }

        try {
            const formData = await request.formData();
            const phoneNumber = formData.get('phoneNumber')?.toString();
            const accountId = formData.get('accountId')?.toString();

            if (!phoneNumber || !accountId) {
                return fail(400, { error: 'Phone number and account ID are required' });
            }

            // Get the WebSocket connection for this client
            if (!locals.wss) {
                return fail(500, { error: 'WebSocket server not available' });
            }
            
            // Find the WebSocket connection for this client
            const socket = Array.from(locals.wss.clients).find(client => {
                // In a real implementation, you'd match the client by session ID or user ID
                // For now, we'll just use the first available socket
                return client.readyState === 1; // OPEN
            });
            
            if (!socket) {
                return fail(400, { error: 'No active WebSocket connection found' });
            }
            
            // Initialize a new WhatsApp client
            try {
                const clientId = await initWhatsAppClient(phoneNumber, accountId, socket);
                return { success: true, clientId };
            } catch (error) {
                logger.error('Failed to initialize WhatsApp client:', { error });
                return fail(500, { error: 'Failed to initialize WhatsApp client' });
            }
        } catch (error) {
            logger.error('Error in requestQRCode action:', { error });
            return fail(500, { error: 'An unexpected error occurred' });
        }
    },

    requestPairingCode: async ({ request, locals }) => {
        // Ensure user is authenticated and has admin role
        const auth = await locals.auth.validate();
        if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
            return fail(403, { error: 'Not authorized' });
        }

        try {
            const formData = await request.formData();
            const phoneNumber = formData.get('phoneNumber')?.toString();
            const accountId = formData.get('accountId')?.toString();

            if (!phoneNumber || !accountId) {
                return fail(400, { error: 'Phone number and account ID are required' });
            }

            // Get the WebSocket connection for this client
            if (!locals.wss) {
                return fail(500, { error: 'WebSocket server not available' });
            }
            
            // Find the WebSocket connection for this client
            const socket = Array.from(locals.wss.clients).find(client => {
                // In a real implementation, you'd match the client by session ID or user ID
                // For now, we'll just use the first available socket
                return client.readyState === 1; // OPEN
            });
            
            if (!socket) {
                return fail(400, { error: 'No active WebSocket connection found' });
            }
            
            // Get the WhatsApp client
            const client = await getWhatsAppClient(accountId);
            if (!client) {
                return fail(404, { error: 'WhatsApp client not found' });
            }
            
            // Generate a pairing code
            try {
                const code = await generatePairingCode(client.id, phoneNumber);
                return { success: true, code };
            } catch (error) {
                logger.error('Failed to generate pairing code:', { error });
                return fail(500, { error: 'Failed to generate pairing code' });
            }
        } catch (error) {
            logger.error('Error in requestPairingCode action:', { error });
            return fail(500, { error: 'An unexpected error occurred' });
        }
    }
};
