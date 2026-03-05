import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base device tag table options
 * Shared configuration for device tag list tables
 */
const baseDeviceTagTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'deviceTag',
    searchableFields: ['name', 'description', 'id'],
    allowedFilters: [],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    include: {
        _count: {
            select: {
                devices: true
            }
        }
    },
    getOrderBy: (sortField: string, sortOrder: 'asc' | 'desc') => {
        if (sortField === 'devicesCount') {
            return { devices: { _count: sortOrder } };
        }
        return { [sortField]: sortOrder };
    }
};

/**
 * Create device tag table options with role-based filtering
 * Per structural standard: create{Resource}TableOptions pattern
 *
 * @param options Configuration options for role-based filtering
 * @returns Table options with optional baseWhere for ownership filtering
 */
export function createDeviceTagTableOptions(options?: {
    /**
     * Whether to filter device tags by ownership
     * If true, will filter by account membership
     */
    checkOwnership?: boolean;
    /**
     * User ID for ownership filtering
     * Used to get account memberships
     */
    userId?: string;
    /**
     * Account ID for ownership filtering
     * Filters device tags where accountId matches this accountId
     * OR where user is a member of the account
     */
    accountId?: string;
}): TableDataOptions {
    const tableOptions: TableDataOptions = {
        ...baseDeviceTagTableOptions
    };

    // Note: Ownership filtering is handled in the loader via accountIds array
    // This function is kept for consistency with other resources
    // The baseWhere will be set in the loader if needed

    return tableOptions;
}

/**
 * Default device tag table options (no ownership filtering)
 * Used by admin routes that can see all device tags
 */
export const deviceTagTableOptions = baseDeviceTagTableOptions;

