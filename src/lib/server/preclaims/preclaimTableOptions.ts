import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base preclaim table options
 * Shared configuration for preclaim list tables
 */
const basePreclaimTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'preclaimSet',
    searchableFields: ['name', 'id', 'description'],
    allowedFilters: ['statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    filterMappings: {
        'statuses': { field: 'status', operator: 'in' }
    },
    include: {
        account: {
            select: {
                id: true,
                name: true
            }
        },
        _count: {
            select: {
                claims: true
            }
        }
    }
};

/**
 * Create preclaim table options with role-based filtering
 * Per structural standard: create{Resource}TableOptions pattern
 *
 * @param options Configuration options for role-based filtering
 * @returns Table options with optional baseWhere for ownership filtering
 */
export function createPreclaimTableOptions(options?: {
    /**
     * Whether to filter preclaims by ownership
     * If true, will filter by account membership or createdBy
     * Note: For user routes with enhanced Prisma, filtering is handled by ZenStack policies
     */
    checkOwnership?: boolean;
    /**
     * User ID for ownership filtering
     * Used to get account memberships or filter by createdBy
     */
    userId?: string;
    /**
     * Account ID for ownership filtering
     * Filters preclaims where accountId matches this accountId
     * OR where user is a member of the account
     */
    accountId?: string;
}): TableDataOptions {
    const tableOptions: TableDataOptions = {
        ...basePreclaimTableOptions
    };

    // For user routes: explicitly filter by current account so only preclaim sets
    // created by/for that account are shown (in addition to any ZenStack policies).
    if (options?.checkOwnership && options?.accountId) {
        tableOptions.baseWhere = { accountId: options.accountId };
    }

    return tableOptions;
}

/**
 * Default preclaim table options (no ownership filtering)
 * Used by admin routes that can see all preclaims
 */
export const preclaimTableOptions = basePreclaimTableOptions;

