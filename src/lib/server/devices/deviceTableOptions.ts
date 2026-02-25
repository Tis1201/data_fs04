import type { TableDataOptions } from '$lib/components/ui_components_sveltekit/table/utils/server/tableDataService';

/**
 * Base device table options
 * Shared configuration for device list tables
 */
const baseDeviceTableOptions: Omit<TableDataOptions, 'baseWhere'> = {
    modelName: 'device',
    searchableFields: ['name', 'id', 'hardwareId', 'macAddress', 'wifiMac', 'lanMac', 'osVersion', 'deviceType'],
    searchableRelations: { tags: 'name' },
    // Device Listing (User/Admin) filters (aligned with Figma + UI)
    // - deviceType: Android/Linux/Windows/macOS (Operating System column)
    // - connected: Online/Offline (boolean)
    // - statuses: Active/Inactive (device activation status)
    allowedFilters: ['types', 'statuses', 'osVersions', 'connected', 'deviceType'],
    // Figma listing shows default sort by Device Name
    defaultSortField: 'name',
    defaultSortOrder: 'asc' as const,
    defaultPerPage: 10,
    filterMappings: {
        'types': { field: 'deviceType', operator: 'in' },
        'statuses': { field: 'status', operator: 'in' },
        'osVersions': { field: 'osVersion', operator: 'in' },
        // deviceType filter (Operating System column)
        'deviceType': { field: 'deviceType', operator: 'in' },
        // 'connected' is a boolean column on Device; UI uses Online/Offline, so accept either.
        'connected': {
            field: 'connected',
            operator: 'equals',
            valueTransformer: (value: string) => {
                const v = String(value).toLowerCase();
                if (v === 'online') return true;
                if (v === 'offline') return false;
                if (v === 'true') return true;
                if (v === 'false') return false;
                return value;
            }
        }
    },
    include: {
        tags: {
            select: {
                id: true,
                name: true
            }
        }
    },
    // Note: When using include, Prisma automatically includes all scalar fields
    // So profileId and all config fields (kioskLockMode, displayResolution, etc.) 
    // will be automatically included in the result
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
        // When current account is set (e.g. user route after switch account), scope to that account only
        if (options.accountId) {
            tableOptions.baseWhere = {
                accountId: options.accountId
            };
        } else {
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

            if (whereConditions.length > 0) {
                tableOptions.baseWhere = {
                    OR: whereConditions
                };
            }
        }
    }

    return tableOptions;
}

/**
 * Default device table options (no ownership filtering)
 * Used by admin routes that can see all devices
 */
export const deviceTableOptions = baseDeviceTableOptions;

