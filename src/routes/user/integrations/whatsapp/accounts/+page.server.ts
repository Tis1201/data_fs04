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
                table_state: result.table_state
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

