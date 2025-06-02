import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { SystemRole } from '$lib/types/roles';

// Define table options for Factory Tokens
const table_options = {
    modelName: 'factoryToken',
    // Updated searchableFields to match actual fields in the FactoryToken model
    searchableFields: ['name', 'hardwareModel', 'firmwareVersion', 'batchNumber'],
    allowedFilters: ['isUsed', 'hardwareModels'],
    defaultSortField: 'issuedAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'isUsed': { 
            field: 'isUsed', 
            operator: 'equals',
            valueTransformer: (value: string) => value === 'true' // Convert string 'true' to boolean true
        },
        'hardwareModels': { field: 'hardwareModel', operator: 'in' }
    }
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends  }: any) => {
        // Add a dependency key for invalidation
        depends('app:factoryTokens');
        
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        return {
            factoryTokens: result.records,
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
    
};
