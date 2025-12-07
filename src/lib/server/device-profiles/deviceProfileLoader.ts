import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createDeviceProfileTableOptions } from './deviceProfileTableOptions';

/**
 * Load device profile list data
 * Per structural standard: load{Resource}List pattern
 */
export async function loadDeviceProfileList(
    locals: any,
    url: URL,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
    }
) {
    try {
        // Get user's account memberships for filtering
        let accountIds: string[] = [];
        if (options?.checkOwnership && options?.userId) {
            const userAccountMemberships = await locals.prisma.accountMembership.findMany({
                where: { userId: options.userId },
                select: { accountId: true }
            });
            accountIds = userAccountMemberships.map(m => m.accountId);
        }

        // Create table options with optional ownership filtering
        const tableOptions = options?.checkOwnership
            ? createDeviceProfileTableOptions({
                checkOwnership: true,
                userId: options.userId,
                accountId: options.accountId
            })
            : createDeviceProfileTableOptions(); // Admin can see all profiles

        // Add account filtering to baseWhere if ownership check is enabled
        if (options?.checkOwnership && accountIds.length > 0) {
            tableOptions.baseWhere = {
                ...tableOptions.baseWhere,
                accountId: { in: accountIds }
            };
        }

        // Handle status filter manually (isActive field)
        const statusesParam = url.searchParams.get('statuses');
        if (statusesParam) {
            const statuses = statusesParam.split(',').filter(Boolean);
            const statusConditions: any[] = [];
            
            if (statuses.includes('active')) {
                statusConditions.push({ isActive: true });
            }
            if (statuses.includes('inactive')) {
                statusConditions.push({ isActive: false });
            }
            
            if (statusConditions.length > 0) {
                // Merge with existing baseWhere
                const existingWhere = tableOptions.baseWhere || {};
                tableOptions.baseWhere = {
                    ...existingWhere,
                    AND: [
                        ...(existingWhere.AND || []),
                        { OR: statusConditions }
                    ]
                };
            }
        }

        // Fetch table data with the appropriate options
        const result = await fetchTableData(locals, url, tableOptions);
        
        return {
            profiles: result.records,
            meta: result.meta
        };
    } catch (e) {
        logger.error(`Error loading device profiles: ${JSON.stringify(e)}`);
        throw error(500, 'Failed to load device profiles');
    }
}

/**
 * Load device profile detail data
 * Per structural standard: load{Resource}Detail pattern
 */
export async function loadDeviceProfileDetail(
    locals: any,
    profileId: string,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
    }
) {
    try {
        // Get profile details with settings and assignments
        const profile = await locals.prisma.deviceProfile.findUnique({
            where: { id: profileId },
            include: {
                settings: {
                    orderBy: { order: 'asc' }
                },
                assignments: {
                    include: {
                        device: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                deviceType: true,
                                status: true
                            }
                        }
                    }
                },
                account: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!profile) {
            throw error(404, 'Profile not found');
        }

        // Check ownership if needed
        if (options?.checkOwnership && options?.userId) {
            const hasAccess = await locals.prisma.accountMembership.findFirst({
                where: {
                    accountId: profile.accountId,
                    userId: options.userId
                }
            });

            if (!hasAccess) {
                throw error(403, 'Access denied');
            }
        }

        return {
            profile
        };
    } catch (err) {
        logger.error(`Error loading device profile details: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof Error && 'status' in err) {
            throw err;
        }
        throw error(500, 'Failed to load device profile details');
    }
}

