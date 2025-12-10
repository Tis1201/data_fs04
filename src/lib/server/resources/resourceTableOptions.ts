import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base resource table options
 * Shared configuration for resource list tables
 */
const baseResourceTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'resource',
    searchableFields: ['name', 'id', 'type', 'format', 'packageName'],
    allowedFilters: ['types', 'targets', 'formats'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    filterMappings: {
        'types': { field: 'type', operator: 'in' },
        'targets': { field: 'target', operator: 'in' },
        'formats': { field: 'format', operator: 'in' }
    },
    select: {
        id: true,
        name: true,
        description: true,
        type: true,
        target: true,
        version: true,
        versionCode: true,
        signature: true,
        releaseType: true,
        format: true,
        packageName: true,
        path: true,
        size: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
        accountId: true,
        account: {
            select: {
                id: true,
                name: true
            }
        } as any
    }
};

/**
 * Create resource table options
 * Per structural standard: create{Resource}TableOptions pattern
 *
 * @param options Configuration options (currently no ownership filtering for admin-only routes)
 * @returns Table options
 */
export function createResourceTableOptions(options?: {
    /**
     * Future: Whether to filter resources by ownership
     * Currently resources are admin-only, so this is not used
     */
    checkOwnership?: boolean;
}): TableDataOptions {
    const tableOptions: TableDataOptions = {
        ...baseResourceTableOptions
    };

    // No ownership filtering needed for admin-only routes
    // Future: Add baseWhere for ownership filtering if user routes are added

    return tableOptions;
}

/**
 * Default resource table options
 * Used by admin routes that can see all resources
 */
export const resourceTableOptions = baseResourceTableOptions;

