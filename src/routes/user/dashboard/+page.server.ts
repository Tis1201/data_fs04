import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
    getBulkDeviceInformationByDeviceIds,
    getMultipleDeviceInformation,
    getMonthlyIssuesFromClickHouse,
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
        const clickhouseDeviceIds = devicesWithStatus.map((d: { id: string }) => d.id);

        const [byMacResult, byDeviceIdResult] = await Promise.all([
            macAddresses.length > 0 ? getMultipleDeviceInformation(macAddresses) : Promise.resolve(new Map<string, DeviceInformation>()),
            clickhouseDeviceIds.length > 0 ? getBulkDeviceInformationByDeviceIds(clickhouseDeviceIds) : Promise.resolve(new Map<string, DeviceInformation>())
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

    // Network Unstable (offline >70%): devices currently offline, disconnected >21 days ago (70% of 30 days)
    const OFFLINE_70_PCT_DAYS = 21;
    const offline70Cutoff = new Date(Date.now() - OFFLINE_70_PCT_DAYS * 24 * 60 * 60 * 1000);
    const offline70Devices = devicesWithStatus.filter(
        d => !d.connected && d.disconnectedAt && d.disconnectedAt <= offline70Cutoff
    );
    offline70Devices.forEach(d => devicesWithCriticalIssue.add((d as { id: string }).id));
    networkCount += offline70Devices.length;
    criticalIssuesCount = devicesWithCriticalIssue.size;

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

    // Get monthly data for charts: ClickHouse (actual metrics) + Prisma (updateFailed, offline, networkUnstable)
    // Update Failed: Bundle + manual app installs + firmware (DeviceActionLog + BundleInstallDevice)
    // Network Unstable: weak signal (ClickHouse) OR device offline >70% of month (disconnected early in month)
    const deviceIds = devicesWithStatus.map((d: { id: string }) => d.id);

    const [clickHouseIssues, actionLogs, devicesWithDisconnectInYear, allOfflineDevices, bundleInstallFailures] = await Promise.all([
        getMonthlyIssuesFromClickHouse(deviceIds, startOfYear, endOfYear),
        locals.prisma.deviceActionLog.findMany({
            where: {
                device: deviceFilter,
                initiatedAt: { gte: startOfYear, lte: endOfYear },
                status: { in: ['failed', 'timeout'] }
            },
            select: { actionType: true, initiatedAt: true }
        }),
        // For offline[] chart: devices that disconnected within the selected year
        locals.prisma.device.findMany({
            where: {
                ...deviceFilter,
                disconnectedAt: { gte: startOfYear, lte: endOfYear }
            },
            select: { disconnectedAt: true }
        }),
        // For networkUnstable >70%: all offline devices, including those disconnected before year start
        // (a device disconnected in Dec prior year is offline >70% of Jan)
        locals.prisma.device.findMany({
            where: {
                ...deviceFilter,
                connected: false,
                disconnectedAt: { not: null, lte: endOfYear }
            },
            select: { disconnectedAt: true }
        }),
        // Bundle install failures: BundleInstallDevice with status FAILED
        locals.prisma.bundleInstallDevice.findMany({
            where: {
                device: deviceFilter,
                status: 'FAILED',
                OR: [
                    { completedAt: { gte: startOfYear, lte: endOfYear } },
                    { completedAt: null, initiatedAt: { gte: startOfYear, lte: endOfYear } }
                ]
            },
            select: { completedAt: true, initiatedAt: true }
        })
    ]);

    // Update Failed: firmware_update, install, install_app, bundle_install (action logs) + BundleInstallDevice FAILED
    const UPDATE_FAILED_ACTION_TYPES = ['firmware_update', 'install', 'install_app', 'bundle_install'];
    const updateFailed = Array(12).fill(0);
    actionLogs.forEach((log) => {
        if (UPDATE_FAILED_ACTION_TYPES.includes(log.actionType)) {
            updateFailed[log.initiatedAt.getMonth()]++;
        }
    });
    bundleInstallFailures.forEach((b) => {
        const date = b.completedAt ?? b.initiatedAt;
        updateFailed[date.getMonth()]++;
    });

    const offline = Array(12).fill(0);
    devicesWithDisconnectInYear.forEach((d) => {
        if (d.disconnectedAt) offline[d.disconnectedAt.getMonth()]++;
    });

    // Network Unstable: (1) weak WiFi signal from ClickHouse + (2) device offline >70% of month
    // (2) = devices that disconnected in first 30% of month (offline rest of month = >70%)
    const networkUnstableOffline70 = Array(12).fill(0);
    const OFFLINE_70_PCT_THRESHOLD = 0.7;
    allOfflineDevices.forEach((d) => {
        if (!d.disconnectedAt) return;
        const month = d.disconnectedAt.getMonth();
        const startOfMonth = new Date(validYear, month, 1);
        const endOfMonth = new Date(validYear, month + 1, 0, 23, 59, 59);
        const daysInMonth = (endOfMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24);
        const offlineDays = (endOfMonth.getTime() - d.disconnectedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (offlineDays / daysInMonth >= OFFLINE_70_PCT_THRESHOLD) {
            networkUnstableOffline70[month]++;
        }
    });
    const networkUnstable = Array(12)
        .fill(0)
        .map((_, i) => clickHouseIssues.networkUnstable[i] + networkUnstableOffline70[i]);

    const issuesByCategory = {
        cpuOverload: clickHouseIssues.cpuOverload,
        memoryCritical: clickHouseIssues.memoryCritical,
        storageLow: clickHouseIssues.storageLow,
        networkUnstable,
        updateFailed,
        offline
    };

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
        'install_app': 'App installation',
        'bundle_install': 'Bundle installation',
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
