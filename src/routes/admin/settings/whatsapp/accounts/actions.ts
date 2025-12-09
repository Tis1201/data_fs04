import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
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
            
            // Not implemented in this build
            return fail(501, { error: 'WhatsApp QR code generation is not available.' });
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
            
            // Not implemented in this build
            return fail(501, { error: 'WhatsApp pairing code generation is not available.' });
        } catch (error) {
            logger.error('Error in requestPairingCode action:', { error });
            return fail(500, { error: 'An unexpected error occurred' });
        }
    }
};
