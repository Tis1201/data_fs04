import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData, formatPagination } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createDeviceTableOptions } from './deviceTableOptions';
import { areDevicesOnline } from '$lib/server/device/devicePresence';
import { getMultipleDeviceInformation, getBulkDeviceInformationByDeviceIds } from '$lib/server/clickhouse/client';

/** Max rows to load when filtering Online/Offline using live Redis (then filter + paginate in memory). */
const LIVE_CONNECTION_FETCH_CAP = 10_000;

/**
 * When the URL requests only Online or only Offline, Prisma's `connected` column is often stale vs Redis.
 * Return which live filter to apply after presence, or null if no exclusive connection filter.
 */
function getExclusiveLiveConnectionFilter(url: URL): 'online' | 'offline' | null {
    const raw = url.searchParams.get('connected');
    if (!raw?.trim()) return null;
    const values = raw.includes(',') ? raw.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean) : [raw.trim().toLowerCase()];
    const hasOnline = values.some((v) => v === 'online');
    const hasOffline = values.some((v) => v === 'offline');
    if (hasOnline && !hasOffline) return 'online';
    if (hasOffline && !hasOnline) return 'offline';
    return null;
}

function serializeDeviceDates(device: any) {
    return {
        ...device,
        createdAt: device.createdAt instanceof Date ? device.createdAt.toISOString() : device.createdAt,
        updatedAt: device.updatedAt instanceof Date ? device.updatedAt.toISOString() : device.updatedAt,
        connectedAt: device.connectedAt instanceof Date ? device.connectedAt.toISOString() : device.connectedAt,
        disconnectedAt: device.disconnectedAt instanceof Date ? device.disconnectedAt.toISOString() : device.disconnectedAt
    };
}

type OsCategory = 'android' | 'linux' | 'windows' | 'apple';

/**
 * Resolve normalised OS category. Prefers `deviceType` (already normalised by the device client)
 * then falls back to `osVersion` string matching for legacy rows that have no `deviceType`.
 */
function resolveOsCategory(deviceType: string | null, osVersion: string | null): OsCategory | null {
    const dt = deviceType?.toLowerCase().trim() ?? '';
    if (dt === 'darwin' || dt === 'macos' || dt === 'apple' || dt === 'ios') return 'apple';
    if (dt === 'android') return 'android';
    if (dt === 'linux') return 'linux';
    if (dt === 'windows') return 'windows';

    // Fallback: raw osVersion string (covers older devices that never set deviceType)
    const ov = osVersion?.toLowerCase().trim() ?? '';
    if (!ov) return null;
    if (ov.includes('darwin') || ov.includes('ios') || ov.includes('macos') || ov.includes('mac os') || ov.includes('apple')) return 'apple';
    if (ov.includes('android')) return 'android';
    if (ov.includes('linux') || ov.includes('ubuntu') || ov.includes('debian') || ov.includes('centos') ||
        ov.includes('redhat') || ov.includes('rhel') || ov.includes('fedora') || ov.includes('arch') || ov.includes('suse')) return 'linux';
    if (ov.includes('windows') || (ov.includes('win') && !ov.includes('darwin')) || ov.includes('nt ')) return 'windows';
    return null;
}

/**
 * Calculate device statistics grouped by OS
 */
function calculateDeviceStats(
    devices: Array<{ id: string; osVersion: string | null; deviceType: string | null }>,
    onlineStatusMap: Map<string, boolean>
) {
    const stats = {
        total: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 },
        online: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 },
        offline: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 }
    };

    for (const device of devices) {
        const isOnline = onlineStatusMap.get(device.id) ?? false;
        const category = resolveOsCategory(device.deviceType, device.osVersion);

        stats.total.total++;
        if (category) stats.total[category]++;

        const bucket = isOnline ? stats.online : stats.offline;
        bucket.total++;
        if (category) bucket[category]++;
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
        includeDeviceInformation?: boolean; // Include ClickHouse device info (CPU/MEM/DSK, OS from heartbeats)
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

        // Exclusive Online/Offline filter must use live Redis, not Prisma `connected` (often stale vs presence).
        // Omit `connected` from the SQL query, fetch up to LIVE_CONNECTION_FETCH_CAP, then filter + paginate in memory.
        const liveConnectionMode = getExclusiveLiveConnectionFilter(url);
        const tableFetchUrl = new URL(url.href);
        if (liveConnectionMode) {
            tableFetchUrl.searchParams.delete('connected');
            tableFetchUrl.searchParams.set('page', '1');
            tableFetchUrl.searchParams.set('per_page', String(LIVE_CONNECTION_FETCH_CAP));
        }

        // Fetch table data with the appropriate options
        let result;
        try {
            result = await fetchTableData(locals, tableFetchUrl, tableOptions);
        } catch (err) {
            logger.error(`Failed to fetch table data: ${err}`);
            throw err;
        }

        if (liveConnectionMode && result.records.length >= LIVE_CONNECTION_FETCH_CAP) {
            logger.warn(
                `[loadDeviceList] Live connection filter hit fetch cap (${LIVE_CONNECTION_FETCH_CAP}); results may be incomplete`
            );
        }

        // Resolve account IDs needed for profile filter (ownership mode without explicit accountId)
        let profileAccountIds: string[] = [];
        if (options?.checkOwnership && options?.userId && !options?.accountId) {
            try {
                const memberships = await locals.prisma.accountMembership.findMany({
                    where: { userId: options.userId },
                    select: { accountId: true }
                });
                profileAccountIds = memberships.map((m: { accountId: string }) => m.accountId);
            } catch (err) {
                logger.warn(`Failed to load account memberships for profile filter: ${err}`);
            }
        }

        // Build profile filter
        const profileAccountFilter = options?.checkOwnership
            ? (options.accountId
                ? { accountId: options.accountId }
                : profileAccountIds.length > 0 ? { accountId: { in: profileAccountIds } } : {})
            : {};
        const profileWhere: any = {
            OR: [
                { isActive: true, level: 'GLOBAL', ...profileAccountFilter },
                { isActive: true, level: 'DEVICE', ...profileAccountFilter }
            ]
        };

        // Fetch tags and profiles in parallel — both are independent of each other and of the main query
        const tagWhereClause = options?.accountId ? { accountId: options.accountId } : {};
        const [availableTags, availableProfiles] = await Promise.all([
            locals.prisma.deviceTag
                .findMany({ where: tagWhereClause, select: { id: true, name: true }, orderBy: { name: 'asc' } })
                .catch((err: unknown) => { logger.warn(`Failed to load available tags: ${err}`); return []; }),
            locals.prisma.deviceProfile
                .findMany({
                    where: profileWhere,
                    select: { id: true, name: true, description: true, level: true, deviceId: true },
                    orderBy: { name: 'asc' }
                })
                .catch((err: unknown) => { logger.warn(`Failed to load available profiles: ${err}`); return []; })
        ]);

        // Update online status from Redis (real-time presence). Batch EXISTS for performance.
        let devicesWithRealTimeStatus = result.records;
        if (options?.includeRealTimeStatus !== false) {
            try {
                const ids = result.records.map((d: any) => d.id);
                const onlineMap = ids.length > 0 ? await areDevicesOnline(ids) : new Map<string, boolean>();
                devicesWithRealTimeStatus = result.records.map((device: any) =>
                    serializeDeviceDates({
                        ...device,
                        connected: onlineMap.get(device.id) ?? false
                    })
                );
            } catch (err) {
                logger.warn(`Failed to load real-time status from Redis: ${err}`);
                devicesWithRealTimeStatus = result.records.map((device: any) => serializeDeviceDates({ ...device }));
            }
        } else {
            devicesWithRealTimeStatus = result.records.map((device: any) => serializeDeviceDates({ ...device }));
        }

        // Apply live Online/Offline filter after Redis, then paginate (exclusive filter only — see liveConnectionMode).
        let afterConnection = devicesWithRealTimeStatus;
        if (liveConnectionMode === 'online') {
            afterConnection = devicesWithRealTimeStatus.filter((d: any) => d.connected === true);
        } else if (liveConnectionMode === 'offline') {
            afterConnection = devicesWithRealTimeStatus.filter((d: any) => d.connected === false);
        }

        let filteredDevices: any[];
        let liveMeta = result.meta;
        if (liveConnectionMode) {
            const page = Number(url.searchParams.get('page')) || 1;
            const perPage = Number(url.searchParams.get('per_page')) || 10;
            // Use the sort/order from the original URL (the tableFetchUrl kept all params except connected/page/per_page)
            const sortField = url.searchParams.get('sort') || 'name';
            const sortOrder = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';
            const dir = sortOrder === 'asc' ? 1 : -1;

            // Sort in memory by the requested field.
            // `connected` sort in exclusive filter mode is a no-op (all records share the same value),
            // so fall through to sort by `name` as the stable default.
            const effectiveSortField = sortField === 'connected' ? 'name' : sortField;
            const sorted = [...afterConnection].sort((a: any, b: any) => {
                const av = a[effectiveSortField] ?? '';
                const bv = b[effectiveSortField] ?? '';
                // Dates: compare as numbers; strings: localeCompare; booleans/numbers: subtraction
                if (av instanceof Date || bv instanceof Date) {
                    return dir * (new Date(av).getTime() - new Date(bv).getTime());
                }
                if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv);
                if (typeof av === 'boolean' && typeof bv === 'boolean') return dir * (Number(av) - Number(bv));
                return dir * String(av).localeCompare(String(bv));
            });

            const total = sorted.length;
            const start = (page - 1) * perPage;
            filteredDevices = sorted.slice(start, start + perPage);

            // Build new meta object — do not mutate the result returned by fetchTableData
            liveMeta = {
                ...result.meta,
                pagination: formatPagination(page, perPage, total)
            };

            logger.info(
                `[loadDeviceList] Live connection filter (${liveConnectionMode}): sort=${effectiveSortField} ${sortOrder}, page ${page}, showing ${filteredDevices.length}/${total} after Redis`
            );
        } else {
            filteredDevices = afterConnection;
        }

        // Load device information from ClickHouse (optional) for the rows returned to the client only.
        let deviceInfoMap = new Map<string, any>();
        let deviceInfoByDeviceIdMap = new Map<string, any>();
        if (options?.includeDeviceInformation !== false) {
            const macAddresses = filteredDevices.map((d: any) => d.macAddress || d.lanMac || d.wifiMac).filter(Boolean);
            const allDeviceIds = filteredDevices.map((d: any) => d.id);

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

            deviceInfoMap = byMacResult;
            deviceInfoByDeviceIdMap = byDeviceIdResult;
        }

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

                deviceStats = calculateDeviceStats(allDevices, onlineStatusMap);
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

        // Ensure all required fields are present with safe defaults
        const returnData = {
            devices: Array.isArray(filteredDevices) ? filteredDevices : [],
            deviceInformation: deviceInformationObject,
            deviceInformationByDeviceId: deviceInformationByDeviceIdObject,
            availableTags: Array.isArray(availableTags) ? availableTags : [],
            availableProfiles: Array.isArray(availableProfiles) ? availableProfiles : [],
            meta: liveMeta || {
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

