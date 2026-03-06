import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
    getBulkDeviceInformationByDeviceIds,
    getMultipleDeviceInformation,
    type DeviceInformation
} from '$lib/server/clickhouse/client';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
    const session = await locals.auth.validate();
    if (!session?.user) {
        throw redirect(302, '/auth/login');
    }

    // Get user data
    const user = await locals.prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            systemRole: true,
            primaryAccountId: true
        }
    });

    if (!user) {
        throw redirect(302, '/auth/login');
    }

    // Use current account (switch-account aware), fallback to cookie then primary
    const currentAccountId =
        (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
        cookies.get('current_account_id') ??
        user.primaryAccountId;
    const accountId = currentAccountId;

    // Build device filter based on account or user
    const deviceFilter = accountId ? { accountId } : { createdBy: user.id };

    // Get selected year from URL params or default to current year
    const currentYear = new Date().getFullYear();
    const yearParam = url.searchParams.get('year');
    const selectedYear = yearParam ? parseInt(yearParam) : currentYear;

    // Validate year is reasonable (last 10 years to current year)
    const validYear = selectedYear >= currentYear - 10 && selectedYear <= currentYear
        ? selectedYear
        : currentYear;

    const startOfYear = new Date(validYear, 0, 1);
    const endOfYear = new Date(validYear, 11, 31, 23, 59, 59);

    // Fetch dashboard statistics
    const [
        totalDevices,
        connectedDevices,
        offlineDevices,
        devicesByOS,
        recentDeviceActions,
        // Get devices with their connection status for detailed stats + Critical Issues (ClickHouse)
        devicesWithStatus
    ] = await Promise.all([
        // Total devices count
        locals.prisma.device.count({
            where: deviceFilter
        }),

        // Connected devices (online)
        locals.prisma.device.count({
            where: {
                ...deviceFilter,
                connected: true
            }
        }),

        // Offline devices (not connected)
        locals.prisma.device.count({
            where: {
                ...deviceFilter,
                connected: false
            }
        }),

        // Devices grouped by OS type
        locals.prisma.device.groupBy({
            by: ['deviceType'],
            where: deviceFilter,
            _count: {
                id: true
            }
        }),

        // Recent device action logs (for Recent Events section)
        locals.prisma.deviceActionLog.findMany({
            where: {
                device: deviceFilter
            },
            orderBy: { initiatedAt: 'desc' },
            take: 10,
            select: {
                id: true,
                actionType: true,
                status: true,
                message: true,
                initiatedAt: true,
                completedAt: true,
                device: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        }),

        // Get all devices with their status for detailed breakdown
        locals.prisma.device.findMany({
            where: deviceFilter,
            select: {
                id: true,
                name: true,
                deviceType: true,
                connected: true,
                connectedAt: true,
                disconnectedAt: true,
                status: true,
                macAddress: true,
                lanMac: true,
                wifiMac: true
            }
        })
    ]);

    // Calculate health metrics from actual device data
    const healthyDevices = connectedDevices;

    // Critical Issues from ClickHouse (device metrics) - same thresholds as device list page
    // Thresholds: CPU/Memory/Storage >= 80% = critical; >= 60% = warning; Network: signal_strength_dbm < -75 = weak
    const CRITICAL_CPU_THRESHOLD = 80;
    const CRITICAL_MEMORY_THRESHOLD = 80;
    const CRITICAL_STORAGE_THRESHOLD = 80;
    const WEAK_NETWORK_SIGNAL_DBM = -75;

    const WARNING_CPU_THRESHOLD = 60;
    const WARNING_MEMORY_THRESHOLD = 60;
    const WARNING_STORAGE_THRESHOLD = 60;
    const WARNING_NETWORK_SIGNAL_DBM = -65;

    let criticalIssuesCount = 0;
    let cpuLoadCount = 0;
    let memoryCount = 0;
    let storageCount = 0;
    let networkCount = 0;

    let cpuWarningCount = 0;
    let memoryWarningCount = 0;
    let storageWarningCount = 0;
    let networkWarningCount = 0;

    const devicesWithCriticalIssue = new Set<string>();

    try {
        const macAddresses = devicesWithStatus
            .map((d) => d.macAddress || d.lanMac || d.wifiMac)
            .filter((mac): mac is string => Boolean(mac));
        const deviceIds = devicesWithStatus.map((d: { id: string }) => d.id);

        const [byMacResult, byDeviceIdResult] = await Promise.all([
            macAddresses.length > 0 ? getMultipleDeviceInformation(macAddresses) : Promise.resolve(new Map<string, DeviceInformation>()),
            deviceIds.length > 0 ? getBulkDeviceInformationByDeviceIds(deviceIds) : Promise.resolve(new Map<string, DeviceInformation>())
        ]);

        for (const device of devicesWithStatus) {
            const deviceId = (device as { id: string }).id;
            const macAddr = (device as { macAddress?: string; lanMac?: string; wifiMac?: string }).macAddress || (device as { lanMac?: string }).lanMac || (device as { wifiMac?: string }).wifiMac;
            const info = (byDeviceIdResult.get(deviceId) ??
                (macAddr ? byMacResult.get(macAddr) : undefined)) as DeviceInformation | undefined;
            if (!info) continue;

            const cpuUsage = info.cpu_usage ?? 0;
            const ramUsage = info.ram_usage ?? 0;
            const diskUsage = info.disk_usage ?? 0;
            const signalStrength = info.signal_strength_dbm;

            if (cpuUsage >= CRITICAL_CPU_THRESHOLD) {
                cpuLoadCount++;
                devicesWithCriticalIssue.add(deviceId);
            } else if (cpuUsage >= WARNING_CPU_THRESHOLD) {
                cpuWarningCount++;
            }

            if (ramUsage >= CRITICAL_MEMORY_THRESHOLD) {
                memoryCount++;
                devicesWithCriticalIssue.add(deviceId);
            } else if (ramUsage >= WARNING_MEMORY_THRESHOLD) {
                memoryWarningCount++;
            }

            if (diskUsage >= CRITICAL_STORAGE_THRESHOLD) {
                storageCount++;
                devicesWithCriticalIssue.add(deviceId);
            } else if (diskUsage >= WARNING_STORAGE_THRESHOLD) {
                storageWarningCount++;
            }

            if (signalStrength != null) {
                if (signalStrength < WEAK_NETWORK_SIGNAL_DBM) {
                    networkCount++;
                    devicesWithCriticalIssue.add(deviceId);
                } else if (signalStrength < WARNING_NETWORK_SIGNAL_DBM) {
                    networkWarningCount++;
                }
            }
        }
        criticalIssuesCount = devicesWithCriticalIssue.size;
    } catch (err) {
        // If ClickHouse unavailable, counts stay at 0
    }

    // Warnings: devices that haven't been seen recently but are marked as connected
    const staleDevices = devicesWithStatus.filter(d => {
        if (!d.connected) return false;
        if (!d.connectedAt) return true; // Connected but never seen
        const hoursSinceConnect = (Date.now() - d.connectedAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceConnect > 24; // Connected but not seen in 24h
    });
    const warningsCount = staleDevices.length;

    console.log('[Dashboard Load] Metrics Summary:', {
        accountId,
        totalDevices,
        connectedDevices,
        offlineDevices,
        criticalIssuesCount,
        cpuLoadCount,
        memoryCount,
        storageCount,
        networkCount,
        warningsCount,
        cpuWarningCount,
        memoryWarningCount,
        storageWarningCount,
        networkWarningCount,
        staleDevices: staleDevices.map(d => d.id)
    });

    // Get monthly data for charts from action logs
    // Since we don't have detailed health metrics, we'll use action log data
    const getMonthlyActionData = async () => {
        const monthlyData: Record<string, number[]> = {
            cpuOverload: Array(12).fill(0),
            memoryCritical: Array(12).fill(0),
            storageLow: Array(12).fill(0),
            networkUnstable: Array(12).fill(0),
            updateFailed: Array(12).fill(0),
            offline: Array(12).fill(0)
        };

        // Get action logs by month
        const actionLogs = await locals.prisma.deviceActionLog.findMany({
            where: {
                device: deviceFilter,
                initiatedAt: {
                    gte: startOfYear,
                    lte: endOfYear
                },
                status: { in: ['failed', 'timeout'] }
            },
            select: {
                actionType: true,
                initiatedAt: true,
                status: true
            }
        });

        // Map action types to categories and count by month
        actionLogs.forEach(log => {
            const month = log.initiatedAt.getMonth();

            // Map action types to dashboard categories
            switch (log.actionType) {
                case 'firmware_update':
                case 'install':
                    monthlyData.updateFailed[month]++;
                    break;
                case 'ping':
                case 'status_check':
                    monthlyData.networkUnstable[month]++;
                    break;
                case 'config_update':
                    monthlyData.storageLow[month]++;
                    break;
                default:
                    // Count other failures as general issues
                    monthlyData.cpuOverload[month]++;
            }
        });

        // Get offline events by month (devices that disconnected)
        const devicesWithDisconnect = await locals.prisma.device.findMany({
            where: {
                ...deviceFilter,
                disconnectedAt: {
                    gte: startOfYear,
                    lte: endOfYear
                }
            },
            select: {
                disconnectedAt: true
            }
        });

        devicesWithDisconnect.forEach(d => {
            if (d.disconnectedAt) {
                const month = d.disconnectedAt.getMonth();
                monthlyData.offline[month]++;
            }
        });

        return monthlyData;
    };

    const issuesByCategory = await getMonthlyActionData();

    // Fleet health trends - based on connected/offline ratio over time
    // Since we don't have historical snapshots, we'll show current month data
    const fleetHealthTrends = {
        cpuOverload: issuesByCategory.cpuOverload,
        networkUnstable: issuesByCategory.networkUnstable,
        updateFailed: issuesByCategory.updateFailed,
        offline: issuesByCategory.offline
    };

    // Map device types to display names
    const osMapping: Record<string, string> = {
        'WINDOWS': 'Windows',
        'MACOS': 'MacOS',
        'LINUX': 'Linux',
        'WEBOS': 'WebOS',
        'TIZEN': 'Tizen',
        'ANDROID': 'Android',
        'IOS': 'iOS',
        'OTHER': 'Other',
        'sensor': 'Sensor',
        'gateway': 'Gateway',
        'camera': 'Camera'
    };

    // Default OS types to always show (matching Figma design)
    const defaultOSTypes = ['Windows', 'MacOS', 'Linux', 'WebOS', 'Other'];

    // Format devices by OS from database
    const dbDevicesByOS = devicesByOS.map(item => ({
        name: osMapping[item.deviceType || 'OTHER'] || item.deviceType || 'Other',
        count: item._count.id
    }));

    // Merge with default OS types to ensure all are shown
    const formattedDevicesByOS = defaultOSTypes.map(osName => {
        const found = dbDevicesByOS.find(item => item.name === osName);
        return {
            name: osName,
            count: found?.count || 0
        };
    });

    // Add any additional OS types from database that aren't in defaults
    dbDevicesByOS.forEach(item => {
        if (!defaultOSTypes.includes(item.name)) {
            formattedDevicesByOS.push(item);
        }
    });

    // Format recent events from device action logs
    const formattedRecentEvents = recentDeviceActions.map(event => ({
        id: event.id,
        deviceName: event.device?.name || 'Unknown Device',
        description: formatActionDescription(event.actionType, event.status, event.message),
        createdAt: event.initiatedAt.toISOString(),
        status: event.status
    }));

    // Calculate offline incidents in last 24 hours (devices currently offline that disconnected in last 24h)
    // Ensures "Last 24 hrs" count is consistent with offline total (TC-IOT-DB-0009)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const offlineIncidents = devicesWithStatus.filter(d =>
        !d.connected && d.disconnectedAt && d.disconnectedAt >= last24Hours
    ).length;

    // Calculate health percentage trend (connected vs total)
    const healthPercentage = totalDevices > 0
        ? Math.round((connectedDevices / totalDevices) * 100 * 10) / 10
        : 100;

    // Dashboard stats object
    const dashboardStats = {
        totalDevices,
        criticalIssues: {
            total: criticalIssuesCount,
            cpuLoad: cpuLoadCount,
            memory: memoryCount,
            storage: storageCount,
            network: networkCount
        },
        warnings: {
            total: cpuWarningCount + memoryWarningCount + storageWarningCount + networkWarningCount,
            cpu: cpuWarningCount,
            memory: memoryWarningCount,
            storage: storageWarningCount,
            network: networkWarningCount
        },
        healthy: {
            total: healthyDevices,
            trend: healthPercentage
        },
        offline: {
            total: offlineDevices,
            incidents: offlineIncidents,
            percentage: totalDevices > 0 ? Math.round((offlineDevices / totalDevices) * 100) : 0,
            trend: totalDevices > 0 ? Math.round((offlineDevices / totalDevices) * 100) : 0
        },
        issuesByCategory,
        fleetHealthTrends
    };

    return {
        user,
        dashboardStats,
        devicesByOS: formattedDevicesByOS,
        recentEvents: formattedRecentEvents,
        selectedYear: validYear
    };
};

/**
 * Format action description based on action type and status
 */
function formatActionDescription(actionType: string, status: string, message: string | null): string {
    if (message) {
        return message;
    }

    const actionMap: Record<string, string> = {
        'screenshot': 'Screenshot captured',
        'terminal': 'Terminal session',
        'remote_desktop': 'Remote desktop session',
        'install': 'App installation',
        'firmware_update': 'Firmware update',
        'restart': 'Device restart',
        'snapshot': 'Snapshot created',
        'ping': 'Connectivity check',
        'status_check': 'Status check',
        'config_update': 'Configuration update'
    };

    const statusMap: Record<string, string> = {
        'initiated': 'started',
        'in_progress': 'in progress',
        'success': 'completed',
        'failed': 'failed',
        'cancelled': 'cancelled',
        'timeout': 'timed out'
    };

    const actionText = actionMap[actionType] || actionType;
    const statusText = statusMap[status] || status;

    return `${actionText} ${statusText}`;
}
