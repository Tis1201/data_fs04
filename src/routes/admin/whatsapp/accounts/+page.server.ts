import type { PageServerLoad } from './$types';
import { json } from '@sveltejs/kit';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { restrict } from '$lib/server/security/guards';

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
    ['ADMIN'] // Only allow admin role to access this route
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
    )
    
};

