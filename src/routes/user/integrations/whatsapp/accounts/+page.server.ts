import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { logger } from '$lib/server/logger';
import WebSocket from 'ws';

// Define table options for WhatsApp accounts
const table_options = {
    modelName: 'whatsAppAccount',
    searchableFields: ['phoneNumber', 'description', 'name'],
    allowedFilters: ['statuses'],
    defaultSortField: 'phoneNumber',
    defaultSortOrder: 'asc' as const,
    defaultPerPage: 10
};

// WhatsApp message form removed as requested

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, auth }) => {
        try {
            // Get the current user's account ID
            const accountId = auth.user?.currentAccountId;
            
            if (!accountId) {
                logger.warn('User has no current account ID');
                
                return {
                    accounts: [],
                    meta: {
                        pagination: {
                            page: 1,
                            per_page: 10,
                            total_records: 0,
                            total_pages: 0
                        },
                        sort: {
                            field: 'createdAt',
                            order: 'desc'
                        }
                    }
                };
            }
            
            // Use the reusable fetchTableData function with our table options
            // Add a filter for the current account
            const result = await fetchTableData(locals, url, {
                ...table_options,
                additionalWhere: {
                    accountId
                }
            });
            
            return {
                accounts: result.records,
                table_state: result.table_state
            };
        } catch (error) {
            logger.error(`Error loading WhatsApp accounts: ${JSON.stringify(error)}`);
            
            return {
                accounts: [],
                table_state: {
                    pagination: {
                        page: 1,
                        per_page: 10,
                        total_records: 0,
                        total_pages: 0
                    },
                    sort: {
                        field: 'createdAt',
                        order: 'desc'
                    }
                }
            };
        }
    },
    ['USER', 'ADMIN'] // Allow both user and admin roles to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Request QR Code
     ******************************************************************************************/
    requestQRCode: restrict(
        async ({ request, locals, auth }) => {
            try {
                const formData = await request.formData();
                const phoneNumber = formData.get('phoneNumber')?.toString();
                const accountId = formData.get('accountId')?.toString();

                if (!phoneNumber || !accountId) {
                    return fail(400, { error: 'Phone number and account ID are required' });
                }

                // Verify user has access to this account
                const account = await locals.prisma.whatsAppAccount.findUnique({
                    where: {
                        id: accountId,
                        accountId: auth.user?.currentAccountId
                    }
                });

                if (!account) {
                    logger.warn(`User attempted to access unauthorized WhatsApp account: ${accountId}`);
                    return fail(403, { error: 'You do not have access to this WhatsApp account' });
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
                    
                    // The QR code will be sent via WebSocket
                    logger.info(`WhatsApp client created with ID ${clientId}`);
                    
                    // Return success with the client ID
                    return { success: true, clientId };
                } catch (error) {
                    logger.error(`Failed to initialize WhatsApp client: ${JSON.stringify(error)}`);
                    return fail(500, { error: 'Failed to initialize WhatsApp client' });
                }
            } catch (error) {
                logger.error(`Error in requestQRCode action: ${JSON.stringify(error)}`);
                return fail(500, { error: 'An unexpected error occurred' });
            }
        },
        ['USER', 'ADMIN'] // Allow both user and admin roles
    )
};