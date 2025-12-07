import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base bundle table options
 * Shared configuration for bundle list tables
 */
const baseBundleTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
  modelName: 'bundle',
  searchableFields: ['name', 'description', 'version', 'os'],
  allowedFilters: ['status', 'os'],
  defaultSortField: 'createdAt',
  defaultSortOrder: 'desc' as const,
  defaultPerPage: 10,
  filterMappings: {
    status: { field: 'status', operator: 'equals' },
    os: { field: 'os', operator: 'equals' }
  }
};

/**
 * Create bundle table options with role-based filtering
 * Per structural standard: create{Resource}TableOptions pattern
 * 
 * @param options Configuration options for role-based filtering
 * @returns Table options with optional baseWhere for ownership filtering
 */
export function createBundleTableOptions(options?: {
  /**
   * Whether to filter bundles by ownership
   * If true, will filter by createdBy or accountId
   */
  checkOwnership?: boolean;
  /**
   * User ID for ownership filtering
   * Filters bundles where createdBy matches this userId
   */
  userId?: string;
  /**
   * Account ID for ownership filtering
   * Filters bundles where accountId matches this accountId
   * OR where user is a member of the account
   */
  accountId?: string;
}): TableDataOptions {
  const tableOptions: TableDataOptions = {
    ...baseBundleTableOptions
  };

  // Add baseWhere for ownership filtering if needed
  if (options?.checkOwnership) {
    const whereConditions: any[] = [];

    // Filter by user ownership (createdBy)
    if (options.userId) {
      whereConditions.push({
        createdBy: options.userId
      });
    }

    // Filter by account membership
    // Note: This assumes bundles can be accessed if user is a member of the bundle's account
    // The actual access control is handled by Zenstack policies, but we can add a baseWhere
    // to optimize queries for user routes
    if (options.accountId) {
      whereConditions.push({
        accountId: options.accountId
      });
    }

    // If we have any conditions, add baseWhere
    if (whereConditions.length > 0) {
      tableOptions.baseWhere = {
        OR: whereConditions
      };
    }
  }

  return tableOptions;
}

/**
 * Default bundle table options (no ownership filtering)
 * Used by admin routes that can see all bundles
 */
export const bundleTableOptions = baseBundleTableOptions;

