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
    // When current account is set, scope to that account only (switch-account aware)
    if (options.accountId) {
      tableOptions.baseWhere = { accountId: options.accountId };
    } else if (options.userId) {
      // Fallback: filter by user-created bundles when no account context
      tableOptions.baseWhere = { createdBy: options.userId };
    }
  }

  return tableOptions;
}

/**
 * Default bundle table options (no ownership filtering)
 * Used by admin routes that can see all bundles
 */
export const bundleTableOptions = baseBundleTableOptions;

