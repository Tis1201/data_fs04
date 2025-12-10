import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base device table options
 * Shared configuration for device list tables
 */
const baseDeviceTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'device',
    searchableFields: ['name', 'id', 'hardwareId', 'macAddress', 'wifiMac', 'lanMac', 'osVersion'],
    allowedFilters: ['types', 'statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    filterMappings: {
        'types': { field: 'deviceType', operator: 'in' },
        'statuses': { field: 'status', operator: 'in' }
    },
    include: {
        tags: {
            select: {
                id: true,
                name: true
            }
        }
    }
};

/**
 * Create device table options with role-based filtering
 * Per structural standard: create{Resource}TableOptions pattern
 * 
 * @param options Configuration options for role-based filtering
 * @returns Table options with optional baseWhere for ownership filtering
 */
export function createDeviceTableOptions(options?: {
    /**
     * Whether to filter devices by ownership
     * If true, will filter by createdBy or account membership
     */
    checkOwnership?: boolean;
    /**
     * User ID for ownership filtering
     * Filters devices where createdBy matches this userId
     */
    userId?: string;
    /**
     * Account ID for ownership filtering
     * Filters devices where user is a member of the device's account
     */
    accountId?: string;
}): TableDataOptions {
    const tableOptions: TableDataOptions = {
        ...baseDeviceTableOptions
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
        if (options.userId) {
            whereConditions.push({
                account: {
                    members: {
                        some: {
                            userId: options.userId
                        }
                    }
                }
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
 * Default device table options (no ownership filtering)
 * Used by admin routes that can see all devices
 */
export const deviceTableOptions = baseDeviceTableOptions;

