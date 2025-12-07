import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base pin rule table options
 * Shared configuration for pin rule list tables
 */
const basePinRuleTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'pinRule',
    searchableFields: ['name', 'description', 'apps'],
    allowedFilters: ['ruleType', 'isActive'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    filterMappings: {
        ruleType: { field: 'ruleType', operator: 'in' },
        isActive: { 
            field: 'isActive', 
            operator: 'equals',
            valueTransformer: (value: string) => value === 'true'
        }
    },
    select: {
        id: true,
        ruleType: true,
        createdBy: true,
        accountId: true,
        name: true,
        description: true,
        apps: true,
        targetType: true,
        targetValue: true,
        priority: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        account: {
            select: {
                id: true,
                name: true
            }
        }
    }
};

/**
 * Create pin rule table options with role-based filtering
 * Per structural standard: create{Resource}TableOptions pattern
 *
 * @param options Configuration options for role-based filtering
 * @returns Table options with optional baseWhere for ownership filtering
 */
export function createPinRuleTableOptions(options?: {
    /**
     * Whether to filter pin rules by ownership
     * If true, will filter by account membership and rule type
     */
    checkOwnership?: boolean;
    /**
     * User ID for ownership filtering
     * Used to get account memberships and filter by createdBy
     */
    userId?: string;
    /**
     * Account ID for ownership filtering
     * Filters pin rules where accountId matches this accountId
     */
    accountId?: string;
}): TableDataOptions {
    const tableOptions: TableDataOptions = {
        ...basePinRuleTableOptions
    };

    // Add baseWhere for ownership filtering if needed
    if (options?.checkOwnership && options?.userId && options?.accountId) {
        // User routes: show user_default for their account, and user_custom created by them
        tableOptions.baseWhere = {
            OR: [
                { ruleType: 'user_default', accountId: options.accountId },
                { ruleType: 'user_custom', accountId: options.accountId, createdBy: options.userId }
            ]
        };
    } else if (!options?.checkOwnership) {
        // Admin routes: show admin_default and admin_custom
        tableOptions.baseWhere = {
            OR: [
                { ruleType: 'admin_default' },
                { ruleType: 'admin_custom' }
            ]
        };
    }

    return tableOptions;
}

/**
 * Default pin rule table options (admin filtering)
 * Used by admin routes that can see admin-level rules
 */
export const pinRuleTableOptions = createPinRuleTableOptions();

