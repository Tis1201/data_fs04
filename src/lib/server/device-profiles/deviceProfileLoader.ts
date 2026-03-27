import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createDeviceProfileTableOptions } from './deviceProfileTableOptions';
import { areDevicesOnline } from '$lib/server/device/devicePresence';

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
        // Create table options with optional ownership filtering
        const tableOptions = options?.checkOwnership
            ? createDeviceProfileTableOptions({
                checkOwnership: true,
                userId: options.userId,
                accountId: options.accountId
            })
            : createDeviceProfileTableOptions(); // Admin can see all profiles

        // Add account filtering when ownership check is enabled
        if (options?.checkOwnership) {
            // When current account is set (user route), scope to that account only
            if (options.accountId) {
                tableOptions.baseWhere = {
                    ...tableOptions.baseWhere,
                    accountId: options.accountId
                };
            } else {
                // Fallback: scope to all accounts the user is a member of (e.g. admin or legacy)
                const userAccountMemberships = await locals.prisma.accountMembership.findMany({
                    where: { userId: options.userId ?? '' },
                    select: { accountId: true }
                });
                const accountIds = userAccountMemberships.map((m: { accountId: string }) => m.accountId);
                if (accountIds.length > 0) {
                    tableOptions.baseWhere = {
                        ...tableOptions.baseWhere,
                        accountId: { in: accountIds }
                    };
                }
            }
        }

        // Apply status filter (URL: statuses=active|inactive -> DB: isActive boolean)
        const statusesParam = url.searchParams.get('statuses');
        if (statusesParam) {
            const parts = statusesParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
            const statusConditions: Array<{ isActive: boolean }> = [];
            if (parts.includes('active')) statusConditions.push({ isActive: true });
            if (parts.includes('inactive')) statusConditions.push({ isActive: false });
            if (statusConditions.length > 0) {
                const existingWhere = tableOptions.baseWhere || {};
                tableOptions.baseWhere = {
                    AND: [
                        existingWhere,
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
        const errMsg = e instanceof Error ? e.message : String(e);
        const errStack = e instanceof Error ? e.stack : undefined;
        logger.error(`Error loading device profiles: ${errMsg}`, errStack ? { stack: errStack } : {});
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
                                status: true,
                                macAddress: true,
                                wifiMac: true,
                                lastUsedAt: true,
                                connected: true,
                                connectedAt: true,
                                disconnectedAt: true,
                                tags: {
                                    select: { id: true, name: true }
                                }
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
        if (options?.checkOwnership) {
            if (options.accountId) {
                if (profile.accountId !== options.accountId) {
                    throw error(403, 'Access denied');
                }
            } else if (options.userId) {
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
        }

        // Align `connected` with device list: Redis presence (same as loadDeviceList), not only Prisma.
        let profileOut = profile;
        if (profile.assignments?.length) {
            const deviceIds = [...new Set(profile.assignments.map((a) => a.device.id))];
            let onlineById: Map<string, boolean> | null = null;
            try {
                onlineById = await areDevicesOnline(deviceIds);
            } catch (presenceErr) {
                logger.warn(
                    `Device profile presence check failed, using DB connected: ${presenceErr instanceof Error ? presenceErr.message : String(presenceErr)}`
                );
            }
            const assignments = profile.assignments.map((a) => {
                const d = a.device;
                const connected =
                    onlineById != null ? (onlineById.get(d.id) ?? (d.connected ?? false)) : (d.connected ?? false);
                return {
                    ...a,
                    device: {
                        ...d,
                        connected,
                        connectedAt:
                            d.connectedAt instanceof Date ? d.connectedAt.toISOString() : d.connectedAt,
                        disconnectedAt:
                            d.disconnectedAt instanceof Date ? d.disconnectedAt.toISOString() : d.disconnectedAt
                    }
                };
            });
            profileOut = { ...profile, assignments };
        }

        return {
            profile: profileOut
        };
    } catch (err) {
        logger.error(`Error loading device profile details: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof Error && 'status' in err) {
            throw err;
        }
        throw error(500, 'Failed to load device profile details');
    }
}

