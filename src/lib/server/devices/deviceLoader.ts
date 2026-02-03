import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createDeviceTableOptions } from './deviceTableOptions';
import { isDeviceOnline, areDevicesOnline } from '$lib/server/device/devicePresence';
import { getMultipleDeviceInformation, getBulkDeviceInformationByDeviceIds } from '$lib/server/clickhouse/client';

/**
 * Calculate device statistics grouped by OS
 */
function calculateDeviceStats(
    prisma: any,
    devices: Array<{ id: string; osVersion: string | null; deviceType: string | null }>,
    onlineStatusMap: Map<string, boolean>
) {
    const stats = {
        total: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 },
        online: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 },
        offline: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 }
    };

    for (const device of devices) {
        const isOnline = onlineStatusMap.get(device.id) || false;
        
        // Determine OS from osVersion field
        const osVersion = (device.osVersion || '').toLowerCase().trim();
        
        // Map OS to our categories based on osVersion
        let category: 'android' | 'linux' | 'windows' | 'apple' | null = null;
        
        if (osVersion) {
            // Apple/macOS/iOS detection (check first to avoid "darwin" matching "win")
            if (osVersion.includes('darwin') || 
                osVersion.includes('ios') || 
                osVersion.includes('macos') || 
                osVersion.includes('mac os') ||
                osVersion.includes('apple')) {
                category = 'apple';
            }
            // Android detection
            else if (osVersion.includes('android')) {
                category = 'android';
            }
            // Linux detection (various distributions)
            else if (osVersion.includes('linux') || 
                     osVersion.includes('ubuntu') || 
                     osVersion.includes('debian') || 
                     osVersion.includes('centos') || 
                     osVersion.includes('redhat') ||
                     osVersion.includes('rhel') ||
                     osVersion.includes('fedora') ||
                     osVersion.includes('arch') ||
                     osVersion.includes('suse')) {
                category = 'linux';
            }
            // Windows detection (more specific to avoid matching "darwin")
            else if (osVersion.includes('windows') || 
                     (osVersion.includes('win') && !osVersion.includes('darwin')) ||
                     osVersion.includes('nt ')) {
                category = 'windows';
            }
        }

        // Always count in total
        stats.total.total++;
        
        if (category) {
            stats.total[category]++;

            if (isOnline) {
                stats.online.total++;
                stats.online[category]++;
            } else {
                stats.offline.total++;
                stats.offline[category]++;
            }
        } else {
            // Count devices with unknown/missing OS in total only
            if (isOnline) {
                stats.online.total++;
            } else {
                stats.offline.total++;
            }
        }
    }

    return stats;
}

/**
 * Load device list data
 * Per structural standard: load{Resource}List pattern
 */
export async function loadDeviceList(
    locals: any,
    url: URL,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
        includeStats?: boolean; // Admin only - include device statistics
        includeRealTimeStatus?: boolean; // Include real-time online status
    }
) {
    try {
        // Create table options with optional ownership filtering
        let tableOptions;
        try {
            tableOptions = options?.checkOwnership
                ? createDeviceTableOptions({
                    checkOwnership: true,
                    userId: options.userId,
                    accountId: options.accountId
                })
                : createDeviceTableOptions(); // No ownership filtering for admin
        } catch (err) {
            logger.error(`Failed to create device table options: ${err}`);
            throw err;
        }

        // Handle tags filtering from URL
        const filteredTagIds = url.searchParams.get("tags");
        if (filteredTagIds) {
            const tagIds = filteredTagIds.includes(',') 
                ? filteredTagIds.split(',').filter(Boolean) 
                : [filteredTagIds];
            
            // Merge with existing baseWhere if it exists
            const existingBaseWhere = tableOptions.baseWhere || {};
            tableOptions.baseWhere = {
                ...existingBaseWhere,
                tags: {
                    some: {
                        id: {
                            in: tagIds
                        }
                    }
                }
            };
        }

        // Fetch table data with the appropriate options
        let result;
        try {
            result = await fetchTableData(locals, url, tableOptions);
        } catch (err) {
            logger.error(`Failed to fetch table data: ${err}`);
            throw err;
        }

        // Fetch available tags for the filter
        // Wrap in try-catch to allow page to load even if tags query fails
        let availableTags = [];
        try {
            availableTags = await locals.prisma.deviceTag.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
        } catch (err) {
            logger.warn(`Failed to load available tags: ${err}`);
            // Continue with empty tags array - page can still load
            availableTags = [];
        }

        // Fetch available device profiles for the Edit Device modal
        // Wrap in try-catch to allow page to load even if profiles query fails
        let availableProfiles = [];
        try {
            // Get user's account memberships for filtering if ownership check is enabled
            let accountIds: string[] = [];
            if (options?.checkOwnership && options?.userId) {
                const userAccountMemberships = await locals.prisma.accountMembership.findMany({
                    where: { userId: options.userId },
                    select: { accountId: true }
                });
                accountIds = userAccountMemberships.map((m: { accountId: string }) => m.accountId);
            }

            const profileWhere: any = {};
            if (options?.checkOwnership && accountIds.length > 0) {
                profileWhere.accountId = { in: accountIds };
            }

            availableProfiles = await locals.prisma.deviceProfile.findMany({
                where: profileWhere,
                select: {
                    id: true,
                    name: true,
                    description: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
        } catch (err) {
            logger.warn(`Failed to load available profiles: ${err}`);
            // Continue with empty profiles array - page can still load
            availableProfiles = [];
        }

        // Update online status from Redis (real-time presence tracking)
        // Wrap in try-catch to allow page to load even if Redis is unavailable
        let devicesWithRealTimeStatus = result.records;
        if (options?.includeRealTimeStatus !== false) {
            try {
                devicesWithRealTimeStatus = await Promise.all(
                    result.records.map(async (device: any) => {
                        try {
                            const isOnline = await isDeviceOnline(device.id);
                            // Convert Date objects to ISO strings for serialization
                            const serializedDevice = {
                                ...device,
                                connected: isOnline,  // Override DB value with real-time Redis status
                                // Convert Date objects to ISO strings for SvelteKit serialization
                                createdAt: device.createdAt instanceof Date ? device.createdAt.toISOString() : device.createdAt,
                                updatedAt: device.updatedAt instanceof Date ? device.updatedAt.toISOString() : device.updatedAt,
                                connectedAt: device.connectedAt instanceof Date ? device.connectedAt.toISOString() : device.connectedAt,
                                disconnectedAt: device.disconnectedAt instanceof Date ? device.disconnectedAt.toISOString() : device.disconnectedAt
                            };
                            return serializedDevice;
                        } catch (err) {
                            // If Redis check fails, use DB value but still serialize dates
                            logger.warn(`Failed to check online status for device ${device.id}: ${err}`);
                            return {
                                ...device,
                                createdAt: device.createdAt instanceof Date ? device.createdAt.toISOString() : device.createdAt,
                                updatedAt: device.updatedAt instanceof Date ? device.updatedAt.toISOString() : device.updatedAt,
                                connectedAt: device.connectedAt instanceof Date ? device.connectedAt.toISOString() : device.connectedAt,
                                disconnectedAt: device.disconnectedAt instanceof Date ? device.disconnectedAt.toISOString() : device.disconnectedAt
                            };
                        }
                    })
                );
            } catch (err) {
                // If Redis is completely unavailable, use DB values but serialize dates
                logger.warn(`Failed to load real-time status from Redis: ${err}`);
                devicesWithRealTimeStatus = result.records.map((device: any) => ({
                    ...device,
                    createdAt: device.createdAt instanceof Date ? device.createdAt.toISOString() : device.createdAt,
                    updatedAt: device.updatedAt instanceof Date ? device.updatedAt.toISOString() : device.updatedAt,
                    connectedAt: device.connectedAt instanceof Date ? device.connectedAt.toISOString() : device.connectedAt,
                    disconnectedAt: device.disconnectedAt instanceof Date ? device.disconnectedAt.toISOString() : device.disconnectedAt
                }));
            }
        } else {
            // Even if not using real-time status, still serialize dates
            devicesWithRealTimeStatus = result.records.map((device: any) => ({
                ...device,
                createdAt: device.createdAt instanceof Date ? device.createdAt.toISOString() : device.createdAt,
                updatedAt: device.updatedAt instanceof Date ? device.updatedAt.toISOString() : device.updatedAt,
                connectedAt: device.connectedAt instanceof Date ? device.connectedAt.toISOString() : device.connectedAt,
                disconnectedAt: device.disconnectedAt instanceof Date ? device.disconnectedAt.toISOString() : device.disconnectedAt
            }));
        }

        // Load device information from ClickHouse: run both lookups in parallel to cut wall-clock time
        const macAddresses = devicesWithRealTimeStatus
            .map((d: any) => d.macAddress || d.lanMac || d.wifiMac)
            .filter(Boolean);
        const allDeviceIds = devicesWithRealTimeStatus.map((d: any) => d.id);

        const [byMacResult, byDeviceIdResult] = await Promise.all([
            macAddresses.length > 0
                ? getMultipleDeviceInformation(macAddresses).catch((err) => {
                    logger.warn(`Failed to load device information from ClickHouse (by MAC): ${err}`);
                    return new Map<string, any>();
                })
                : Promise.resolve(new Map<string, any>()),
            allDeviceIds.length > 0
                ? getBulkDeviceInformationByDeviceIds(allDeviceIds).catch((err) => {
                    logger.warn(`Failed to load device information by device_id: ${err}`);
                    return new Map<string, any>();
                })
                : Promise.resolve(new Map<string, any>())
        ]);

        const deviceInfoMap = byMacResult;
        const deviceInfoByDeviceIdMap = byDeviceIdResult;

        // Calculate device statistics (admin only)
        // Wrap in try-catch to allow page to load even if stats calculation fails
        let deviceStats = null;
        if (options?.includeStats) {
            try {
                // Fetch all devices for statistics (with ownership filter if needed)
                const statsWhere: any = {};
                if (options.checkOwnership && options.userId) {
                    statsWhere.OR = [
                        { createdBy: options.userId },
                        {
                            account: {
                                members: {
                                    some: {
                                        userId: options.userId
                                    }
                                }
                            }
                        }
                    ];
                }

                const allDevices = await locals.prisma.device.findMany({
                    where: statsWhere,
                    select: {
                        id: true,
                        osVersion: true,
                        deviceType: true
                    }
                });

                // Batch check online status for all devices
                // Wrap in try-catch in case Redis is unavailable
                let onlineStatusMap = new Map<string, boolean>();
                try {
                    const deviceIds = allDevices.map((d: { id: string; osVersion: string | null; deviceType: string | null }) => d.id);
                    onlineStatusMap = await areDevicesOnline(deviceIds);
                } catch (err) {
                    logger.warn(`Failed to load online status for stats: ${err}`);
                    // Use empty map - all devices will be marked as offline in stats
                }

                deviceStats = calculateDeviceStats(locals.prisma, allDevices, onlineStatusMap);
            } catch (err) {
                logger.warn(`Failed to calculate device statistics: ${err}`);
                // Continue without stats - page can still load
            }
        }

        // Get user info for user routes
        const user = locals.auth?.user;
        const userAccountId = options?.checkOwnership
            ? (locals.currentAccount?.account?.id || 
               locals.auth?.currentAccount?.account?.id || 
               user?.primaryAccountId || 
               null)
            : null;

        // Safely convert Maps to objects for serialization
        let deviceInformationObject: Record<string, any> = {};
        let deviceInformationByDeviceIdObject: Record<string, any> = {};
        try {
            if (deviceInfoMap && deviceInfoMap.size > 0) {
                deviceInformationObject = Object.fromEntries(deviceInfoMap);
            }
            if (deviceInfoByDeviceIdMap && deviceInfoByDeviceIdMap.size > 0) {
                deviceInformationByDeviceIdObject = Object.fromEntries(deviceInfoByDeviceIdMap);
            }
        } catch (err) {
            logger.warn(`Failed to convert deviceInfo maps to object: ${err}`);
        }

        // Post-filter devices based on connection status after real-time Redis update
        // This ensures the filter works on actual real-time status, not stale DB values
        let filteredDevices = devicesWithRealTimeStatus;
        const connectedFilter = url.searchParams.get('connected');
        if (connectedFilter) {
            const connectedValues = connectedFilter.includes(',')
                ? connectedFilter.split(',').filter(Boolean)
                : [connectedFilter];

            const hasOnline = connectedValues.some(v => v.toLowerCase() === 'online');
            const hasOffline = connectedValues.some(v => v.toLowerCase() === 'offline');

            // Only filter if not both (both = show all, no filter needed)
            if (hasOnline && !hasOffline) {
                // Show only online devices
                filteredDevices = devicesWithRealTimeStatus.filter((d: any) => d.connected === true);
                logger.info(`Filtered devices: showing only online (${filteredDevices.length}/${devicesWithRealTimeStatus.length})`);
            } else if (hasOffline && !hasOnline) {
                // Show only offline devices
                filteredDevices = devicesWithRealTimeStatus.filter((d: any) => d.connected === false);
                logger.info(`Filtered devices: showing only offline (${filteredDevices.length}/${devicesWithRealTimeStatus.length})`);
            }
        }

        // Ensure all required fields are present with safe defaults
        const returnData = {
            devices: Array.isArray(filteredDevices) ? filteredDevices : [],
            deviceInformation: deviceInformationObject,
            deviceInformationByDeviceId: deviceInformationByDeviceIdObject,
            availableTags: Array.isArray(availableTags) ? availableTags : [],
            availableProfiles: Array.isArray(availableProfiles) ? availableProfiles : [],
            meta: result?.meta || {
                pagination: { 
                    page: 1, 
                    per_page: 10, 
                    total: 0, 
                    total_pages: 0,
                    total_records: 0
                },
                sort: { 
                    field: 'createdAt', 
                    order: 'desc' 
                },
                filters: {}
            },
            ...(deviceStats && { deviceStats }),
            ...(options?.checkOwnership && {
                userRole: user?.systemRole || 'MEMBER',
                accountId: userAccountId
            })
        };

        logger.info('Returning device list data', {
            deviceCount: returnData.devices.length,
            tagCount: returnData.availableTags.length,
            profileCount: returnData.availableProfiles.length,
            hasDeviceInfo: Object.keys(returnData.deviceInformation).length > 0,
            hasStats: !!deviceStats
        });

        return returnData;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        const errorStack = e instanceof Error ? e.stack : undefined;
        const errorName = e instanceof Error ? e.name : 'Unknown';
        
        logger.error(`Error loading devices: ${errorName}: ${errorMessage}`, {
            error: e,
            stack: errorStack,
            options: {
                checkOwnership: options?.checkOwnership,
                userId: options?.userId,
                accountId: options?.accountId,
                includeStats: options?.includeStats,
                includeRealTimeStatus: options?.includeRealTimeStatus
            },
            url: url.toString()
        });
        
        // If it's already a SvelteKit error, re-throw it
        if (e && typeof e === 'object' && 'status' in e) {
            throw e;
        }
        
        throw error(500, `Failed to load devices: ${errorMessage}`);
    }
}

/**
 * Load device detail data
 * Per structural standard: load{Resource}Detail pattern
 * 
 * Note: Device detail loading is already centralized in deviceDetailLoader.ts
 * This function is a wrapper for consistency with other resources
 */
export async function loadDeviceDetail(
    locals: any,
    deviceId: string,
    deviceEditSchema: any,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
        verboseLogging?: boolean;
    }
) {
    // Import the existing device detail loader
    const { loadDeviceDetail: existingLoader } = await import('$lib/server/device/deviceDetailLoader');
    
    return await existingLoader(
        locals.prisma,
        deviceId,
        deviceEditSchema,
        {
            checkOwnership: options?.checkOwnership || false,
            userId: options?.userId,
            accountId: options?.accountId,
            verboseLogging: options?.verboseLogging || false
        }
    );
}

