import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { logger } from '$lib/server/logger';
import { handleApiError } from '$lib/server/errors/errorHandlers';

// Define table options for WhatsApp accounts
const table_options = {
    modelName: 'whatsAppAccount', // This should match the exact model name in Prisma schema
    searchableFields: ['phoneNumber', 'description', 'name'],
    allowedFilters: ['client_status', 'connectionStatuses', 'status'],
    defaultSortField: 'phoneNumber',
    defaultSortOrder: 'asc' as const,
    defaultPerPage: 10,
    filterMappings: {
        'connectionStatuses': {
            field: 'client_status',
            operator: 'in'
        },
        'status': {
            field: 'status',
            operator: 'in'
        }
    }
};

// WhatsApp message form removed as requested

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, auth }: any) => {
        try {
            // Get the current user's account ID from auth.currentAccount
            const accountId = auth.currentAccount?.account?.id;
            
            if (!accountId) {
                // If no account ID is found, this is an error condition
                throw error(403, 'No account selected. Please select an account first.');
            }
            
            logger.debug(`Using account ID: ${accountId}`);
            
            // Let Zenstack's row-level security handle access control
            logger.debug('Fetching WhatsApp accounts with Zenstack row-level security');
            
            // Use fetchTableData function with our table options
            // Zenstack will automatically filter based on the current user's permissions
            const result = await fetchTableData(locals, url, {
                ...table_options
            });
            
            logger.debug(`Found ${result.records.length} WhatsApp accounts`);
            
            return {
                accounts: result.records,
                meta: result.meta
            };
        } catch (err) {
            // Use the standardized API error handler
            // If getCurrentAccountId failed, we'll just pass the error as is
            return handleApiError({
                error: err,
                prisma: locals.prisma,
                // Don't try to get account ID if that's what caused the error
                accountId: err.message?.includes('account') ? undefined : auth.currentAccount?.account?.id,
                defaultMessage: 'Failed to load WhatsApp accounts',
                action: 'loading WhatsApp accounts'
            });
        }
    },
    ['USER', 'ADMIN'] // Allow both user and admin roles to access this route
) satisfies PageServerLoad;


export const actions = restrict(
    {
        // Action name must match what's being called from the client (delete)
        delete: async ({ request, locals, auth }) => {
            const form = await request.formData();
            const id = form.get('id')?.toString();
            
            if (!id) {
                logger.warn('Delete action called without an ID');
                return fail(400, { 
                    success: false, 
                    message: 'WhatsApp account ID is required' 
                });
            }
            
            try {
                // Get the current user's account ID from auth.currentAccount
                const accountId = auth.currentAccount?.account?.id;
                
                if (!accountId) {
                    logger.warn('Delete action called without a selected account');
                    return fail(403, { 
                        success: false, 
                        message: 'No account selected. Please select an account first.' 
                    });
                }
                
                logger.debug(`Deleting WhatsApp account ${id} for account ${accountId}`);
                
                // First check if the account exists and belongs to the user's account
                const whatsAppAccount = await locals.prisma.whatsAppAccount.findFirst({
                    where: {
                        id,
                        accountId
                    }
                });
                
                if (!whatsAppAccount) {
                    logger.warn(`WhatsApp account ${id} not found or not accessible by account ${accountId}`);
                    return fail(404, { 
                        success: false, 
                        message: 'WhatsApp account not found or you do not have permission to delete it' 
                    });
                }
                
                // Disconnect the client if it's connected
                try {
                    await whatsAppAccountManager.cleanupClient(id);
                    logger.debug(`WhatsApp client for account ${id} disconnected successfully`);
                } catch (cleanupErr) {
                    // Log the error but continue with deletion
                    logger.error(`Error disconnecting WhatsApp client for account ${id}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
                    if (cleanupErr instanceof Error && cleanupErr.stack) {
                        logger.debug(`Stack trace: ${cleanupErr.stack}`);
                    }
                }
                
                // Delete the WhatsApp account
                await locals.prisma.whatsAppAccount.delete({
                    where: { id }
                });
                
                logger.debug(`WhatsApp account ${id} deleted successfully`);
                
                return { 
                    success: true, 
                    message: 'WhatsApp account deleted successfully' 
                };
            } catch (err) {
                // Log the error with detailed information
                logger.error(`Error deleting WhatsApp account: ${err instanceof Error ? err.message : String(err)}`);
                if (err instanceof Error && err.stack) {
                    logger.debug(`Stack trace: ${err.stack}`);
                }
                
                // Determine if this is an access policy violation
                let errorMessage = 'Failed to delete WhatsApp account';
                let statusCode = 500;
                
                if (err && typeof err === 'object') {
                    // Check for Prisma/Zenstack specific error codes
                    if ('code' in err) {
                        const prismaErr = err as { code: string };
                        if (prismaErr.code === 'P2025') {
                            errorMessage = 'WhatsApp account not found';
                            statusCode = 404;
                        } else if (prismaErr.code === 'P2003') {
                            errorMessage = 'Cannot delete this WhatsApp account because it is referenced by other records';
                            statusCode = 400;
                        }
                    }
                    
                    // Check for HTTP errors from SvelteKit
                    if ('status' in err) {
                        const httpErr = err as { status: number };
                        statusCode = httpErr.status || statusCode;
                    }
                }
                
                return fail(statusCode, { 
                    success: false, 
                    message: errorMessage,
                    code: err && typeof err === 'object' && 'code' in err ? (err as any).code : undefined
                });
            }
        }
    },
    ['USER', 'ADMIN'] // Allow both user and admin roles to access these actions
) satisfies Actions;
