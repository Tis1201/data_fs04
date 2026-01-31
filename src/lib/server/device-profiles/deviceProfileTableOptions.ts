import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base device profile table options
 * Shared configuration for device profile list tables
 */
const baseDeviceProfileTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'deviceProfile',
    searchableFields: ['name', 'description', 'id'],
    allowedFilters: [] as string[], // statuses filter applied manually in loader (isActive boolean)
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    filterMappings: {},
    include: {
        account: {
            select: {
                id: true,
                name: true
            }
        },
        _count: {
            select: {
                assignments: true
            }
        }
    }
};

/**
 * Create device profile table options with role-based filtering
 * Per structural standard: create{Resource}TableOptions pattern
 *
 * @param options Configuration options for role-based filtering
 * @returns Table options with optional baseWhere for ownership filtering
 */
export function createDeviceProfileTableOptions(options?: {
    /**
     * Whether to filter device profiles by ownership
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
     * Filters device profiles where accountId matches this accountId
     * OR where user is a member of the account
     */
    accountId?: string;
}): TableDataOptions {
    const tableOptions: TableDataOptions = {
        ...baseDeviceProfileTableOptions
    };

    // Add baseWhere for ownership filtering if needed
    if (options?.checkOwnership) {
        // Device profiles are filtered by account membership
        // The actual filtering is done via accountIds array in the loader
        // But we can add level filter here
        tableOptions.baseWhere = {
            level: 'GLOBAL' // Only show global profiles, not device-level copies
        };
    } else {
        // Admin can see all profiles, but still filter to GLOBAL only
        tableOptions.baseWhere = {
            level: 'GLOBAL'
        };
    }

    return tableOptions;
}

/**
 * Default device profile table options (no ownership filtering)
 * Used by admin routes that can see all device profiles
 */
export const deviceProfileTableOptions = baseDeviceProfileTableOptions;

