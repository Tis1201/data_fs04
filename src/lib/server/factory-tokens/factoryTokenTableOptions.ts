/**
 * Factory token table options
 * Centralized configuration for factory token list tables
 */

import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base table options for factory tokens
 */
export const baseFactoryTokenTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'factoryToken',
    // Updated searchableFields to match actual fields in the FactoryToken model
    searchableFields: ['name', 'hardwareModel', 'firmwareVersion', 'batchNumber'],
    allowedFilters: ['isUsed', 'hardwareModels'],
    defaultSortField: 'issuedAt',
    defaultSortOrder: 'desc',
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

/**
 * Create factory token table options
 * Factory tokens are admin-only, so no ownership filtering needed
 */
export function createFactoryTokenTableOptions(): TableDataOptions {
    return baseFactoryTokenTableOptions as TableDataOptions;
}

