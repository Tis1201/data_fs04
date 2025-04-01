import type { PageServerLoad, Actions } from './$types';
import { json, fail } from '@sveltejs/kit';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import type { WhatsAppAccountClient } from '$lib/server/whatsapp/WhatsAppAccountClient';
import { logger } from '$lib/server/logger';
import WebSocket from 'ws';

// Define table options for WhatsApp accounts
const table_options = {
    modelName: 'whatsAppAccount',
    searchableFields: ['phoneNumber', 'description', 'name'],
    allowedFilters: ['roles', 'statuses'],
    defaultSortField: 'phoneNumber',
    defaultSortOrder: 'asc' as const,
    defaultPerPage: 10
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }) => {
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        return {
            accounts: result.records,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    deleteAccount: restrict(
        async ({ request, locals }) => {
            const data = await request.formData();
            const id = data.get('id')?.toString();
            
            if (!id) {
                return { success: false, error: 'Account ID is required' };
            }
            
            // Use the reusable deleteRecord function
            return deleteRecord(locals, 'whatsAppAccount', id);
        },
        ['ADMIN'] // Only allow admin role to delete accounts
    ),
    
    /*******************************************************************************************
     * Request QR Code
     ******************************************************************************************/
    requestQRCode: restrict(
        async ({ request, locals }) => {
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
                
                try {
                    // Use the WhatsAppAccountManager to create a client
                    const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient(phoneNumber, accountId);
                    
                    // Set up event forwarding to WebSocket
                    const client = whatsAppAccountManager.getClient(clientId);
                    if (!client) {
                        return fail(500, { error: 'Failed to get WhatsApp client after creation' });
                    }
                    
                    // Set up event listeners for the client
                    // setupClientEventListeners(client, socket, clientId);
                    
                    // The QR code will be sent via WebSocket
                    logger.info(`WhatsApp client created with ID ${clientId}`);
                    
                    // Return success with the client ID
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
        ['ADMIN'] // Only allow admin role to request QR code
    ),
    
    /*******************************************************************************************
     * Request Pairing Code
     ******************************************************************************************/
    requestPairingCode: restrict(
        async ({ request, locals }) => {
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
                const client = whatsAppAccountManager.getClient(accountId);
                if (!client) {
                    return fail(404, { error: 'WhatsApp client not found' });
                }
                
                // Generate a pairing code
                try {
                    // This functionality is not directly available in WhatsAppAccountClient
                    // You may need to implement it or use an alternative approach
                    return fail(501, { error: 'Pairing code generation not implemented in the new WhatsApp client' });
                    // When implemented, it would look like:
                    // const code = await client.generatePairingCode(phoneNumber);
                    // return { success: true, code };
                } catch (error) {
                    logger.error('Failed to generate pairing code:', { error });
                    return fail(500, { error: 'Failed to generate pairing code' });
                }
            } catch (error) {
                logger.error('Error in requestPairingCode action:', { error });
                return fail(500, { error: 'An unexpected error occurred' });
            }
        },
        ['ADMIN'] // Only allow admin role to request pairing code
    )
    
};
