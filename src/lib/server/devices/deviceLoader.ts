import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createDeviceTableOptions } from './deviceTableOptions';
import { isDeviceOnline, areDevicesOnline } from '$lib/server/device/devicePresence';
import { getMultipleDeviceInformation } from '$lib/server/clickhouse/client';

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
        const tableOptions = options?.checkOwnership
            ? createDeviceTableOptions({
                checkOwnership: true,
                userId: options.userId,
                accountId: options.accountId
            })
            : createDeviceTableOptions(); // No ownership filtering for admin

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
        const result = await fetchTableData(locals, url, tableOptions);

        // Fetch available tags for the filter
        const availableTags = await locals.prisma.deviceTag.findMany({
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Update online status from Redis (real-time presence tracking)
        const devicesWithRealTimeStatus = options?.includeRealTimeStatus !== false
            ? await Promise.all(
                result.records.map(async (device: any) => {
                    const isOnline = await isDeviceOnline(device.id);
                    return {
                        ...device,
                        connected: isOnline  // Override DB value with real-time Redis status
                    };
                })
            )
            : result.records;

        // Load device information from ClickHouse for all devices
        const macAddresses = devicesWithRealTimeStatus
            .map((d: any) => d.macAddress || d.lanMac || d.wifiMac)
            .filter(Boolean);
        const deviceInfoMap = await getMultipleDeviceInformation(macAddresses);

        // Calculate device statistics (admin only)
        let deviceStats = null;
        if (options?.includeStats) {
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
            const deviceIds = allDevices.map((d: { id: string; osVersion: string | null; deviceType: string | null }) => d.id);
            const onlineStatusMap = await areDevicesOnline(deviceIds);

            deviceStats = calculateDeviceStats(locals.prisma, allDevices, onlineStatusMap);
        }

        // Get user info for user routes
        const user = locals.auth?.user;
        const userAccountId = options?.checkOwnership
            ? (locals.currentAccount?.account?.id || 
               locals.auth?.currentAccount?.account?.id || 
               user?.primaryAccountId || 
               null)
            : null;

        return {
            devices: devicesWithRealTimeStatus,
            deviceInformation: Object.fromEntries(deviceInfoMap), // Convert Map to object for serialization
            availableTags,
            meta: result.meta,
            ...(deviceStats && { deviceStats }),
            ...(options?.checkOwnership && {
                userRole: user?.systemRole || 'MEMBER',
                accountId: userAccountId
            })
        };
    } catch (e) {
        logger.error(`Error loading devices: ${JSON.stringify(e)}`);
        throw error(500, 'Failed to load devices');
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

