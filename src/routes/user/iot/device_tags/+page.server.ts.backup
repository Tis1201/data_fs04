import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { SystemRole } from '$lib/types/roles';

// Define table options for Factory Tokens
const table_options = {
    modelName: 'deviceTag',
    // Updated searchableFields to match actual fields in the FactoryToken model
    searchableFields: ['name'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends  }: any) => {
        depends('app:deviceTags');
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        return {
            deviceTags: result.records,
            meta: result.meta
        };
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    
};
