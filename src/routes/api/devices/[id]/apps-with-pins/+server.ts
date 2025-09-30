import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';
import type { RequestHandler } from './$types';

// GET /api/devices/[id]/apps-with-pins - Get apps with pin status (combined data)
export const GET = restrict(
  async ({ params, url, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id: deviceId } = params;
      
      // Get pagination parameters from query string
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const search = url.searchParams.get('search') || '';
      const filter = url.searchParams.get('filter') || 'all';
      const sortBy = url.searchParams.get('sortBy') || 'name';
      const sortOrder = url.searchParams.get('sortOrder') || 'asc';
      
      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        return json({
          success: false,
          error: 'Invalid pagination parameters',
          message: 'Page must be >= 1, limit must be between 1 and 100'
        }, { status: 400 });
      }

      // Check if device exists and user has access
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          account: {
            select: {
              members: {
                where: { userId: auth.user.id },
                select: { role: true }
              }
            }
          }
        }
      });
      
      if (!device) {
        return json({
          success: false,
          error: 'Device not found',
          message: 'The requested device does not exist'
        }, { status: 404 });
      }
      
      // Check if user has permission to view this device
      const hasPermission = 
        auth.user.systemRole === 'ADMIN' ||
        device.account?.members?.[0]?.role === 'ADMIN' ||
        device.account?.members?.[0]?.role === 'MEMBER';
      
      if (!hasPermission) {
        return json({
          success: false,
          error: 'Insufficient permissions',
          message: 'You do not have permission to view this device'
        }, { status: 403 });
      }

      // Get raw app data from ClickHouse
      // IMPORTANT: the source does not understand 'pinned'/'unpinned' – fetch all, then filter after merge
      const sourceFilter = (filter === 'pinned' || filter === 'unpinned') ? 'all' : filter;
      const appData = await deviceAppService.getDeviceApps(deviceId, page, limit, {
        search,
        filter: sourceFilter,
        sortBy,
        sortOrder
      });

      // ClickHouse fetch summary
      try {
        const chSummary = {
          deviceId,
          sourceFilter,
          page: appData.page,
          limit: appData.limit,
          total: appData.total,
          returned: Array.isArray(appData.apps) ? appData.apps.length : 0,
          sample: Array.isArray(appData.apps) ? appData.apps.slice(0, 25).map((a: any) => ({ package_name: a.package_name, app_name: a.app_name })) : []
        };
        logger.info(`[AppsWithPinsAPI] ClickHouse fetch summary: ${JSON.stringify(chSummary)}`);
      } catch {}
      
      if (!appData || !Array.isArray(appData.apps)) {
        logger.error(`[AppsWithPinsAPI] Invalid app data:`, { appData, type: typeof appData });
        throw new Error(`DeviceAppService returned invalid data: ${typeof appData}`);
      }

      // Get current manual/device-specific pins (if any)
      const pinnedApps = await prisma.deviceAppPin.findMany({
        where: { deviceId },
        include: { 
          rule: { 
            select: { 
              id: true,
              name: true, 
              ruleType: true, 
              createdBy: true,
              createdByUser: {
                select: {
                  name: true,
                  email: true
                }
              }
            } 
          } 
        }
      });

      // Create pin status map
      const pinStatusMap = new Map();
      pinnedApps.forEach(pin => {
        pinStatusMap.set(pin.packageName, {
          isPinned: true,
          pinnedBy: pin.rule?.name || 'Manual',
          ruleType: pin.rule?.ruleType || 'manual',
          pinnedAt: pin.pinnedAt,
          ruleId: pin.rule?.id,
          createdBy: pin.rule?.createdBy,
          createdByUser: pin.rule?.createdByUser
        });
      });

      // Fetch applicable rules (hierarchy): admin_default (global) and account_default for this device's account
      const applicableRules = await prisma.pinRule.findMany({
        where: {
          isActive: true,
          OR: [
            { ruleType: 'admin_default' },
            { ruleType: 'account_default', accountId: device.accountId }
          ]
        },
        orderBy: { priority: 'asc' }
      });

      // Build a quick lookup set of rule-defined package names
      const rulePinnedPackages = new Set<string>();
      for (const rule of applicableRules) {
        for (const pkg of (rule as any).apps || []) {
          if (typeof pkg === 'string' && pkg.length > 0) {
            rulePinnedPackages.add(pkg);
          }
        }
      }

      // Build a set of device app package names for intersection check
      const devicePackages = new Set<string>(appData.apps.map((a: any) => a.package_name));

      // Compute intersection for debugging
      const matchedRulePackages: string[] = [];
      rulePinnedPackages.forEach((pkg) => {
        if (devicePackages.has(pkg)) matchedRulePackages.push(pkg);
      });

      try {
        const debugPayload = {
          deviceId,
          filter,
          sortBy,
          sortOrder,
          page,
          limit,
          deviceAccountId: device.accountId,
          userId: auth.user.id,
          userRole: auth.user.systemRole,
          applicableRulesCount: applicableRules.length,
          applicableRules: applicableRules.map(r => ({ id: r.id, type: r.ruleType, name: r.name, priority: r.priority, apps: (r as any).apps || [] })),
          deviceAppsCount: appData.total,
          devicePackagesSample: appData.apps.slice(0, 25).map((a: any) => a.package_name),
          rulePinnedPackagesCount: rulePinnedPackages.size,
          rulePinnedPackages: Array.from(rulePinnedPackages),
          matchedRulePackagesCount: matchedRulePackages.length,
          matchedRulePackages
        };
        logger.info(`[AppsWithPinsAPI] Debug rules and matches: ${JSON.stringify(debugPayload)}`);
      } catch (e) {
        logger.error('[AppsWithPinsAPI] Failed to stringify debug payload', { error: e instanceof Error ? e.message : String(e) });
      }

      // Combine raw app data with pin status from manual/device pins and rule-defined pins
      const appsWithPins = appData.apps.map(app => {
        const byManual = pinStatusMap.get(app.package_name) || null;
        const byRule = rulePinnedPackages.has(app.package_name)
          ? {
              isPinned: true,
              pinnedBy: (applicableRules.find(r => (r as any).apps?.includes(app.package_name))?.name) || 'Rule',
              ruleType: (applicableRules.find(r => (r as any).apps?.includes(app.package_name))?.ruleType) || 'admin_default',
              pinnedAt: new Date().toISOString()
            }
          : null;

        const pinInfo = byManual || byRule;
        return {
          ...app,
          isPinned: !!pinInfo,
          pinInfo: pinInfo
        };
      });

      // Log final pin results breakdown
      try {
        const pinnedPackages = appsWithPins.filter((a: any) => a.isPinned).map((a: any) => a.package_name);
        const breakdown = {
          totalAfterMerge: appsWithPins.length,
          pinnedCount: pinnedPackages.length,
          pinnedPackages: pinnedPackages.slice(0, 50),
        };
        logger.info(`[AppsWithPinsAPI] Merge result breakdown: ${JSON.stringify(breakdown)}`);
      } catch {}

      // Sort by pin status (pinned first) then by the original sort criteria
      const sortedApps = appsWithPins.sort((a, b) => {
        // First sort by pin status
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        // Then sort by the requested criteria
        if (sortBy === 'name') {
          return sortOrder === 'asc' 
            ? a.app_name.localeCompare(b.app_name)
            : b.app_name.localeCompare(a.app_name);
        } else if (sortBy === 'package_name') {
          return sortOrder === 'asc'
            ? a.package_name.localeCompare(b.package_name)
            : b.package_name.localeCompare(a.package_name);
        } else if (sortBy === 'app_type') {
          return sortOrder === 'asc'
            ? a.app_type.localeCompare(b.app_type)
            : b.app_type.localeCompare(a.app_type);
        }
        
        return 0;
      });

      // Optionally filter to only pinned apps
      const isPinnedOnly = filter === 'pinned';
      const filteredApps = isPinnedOnly
        ? sortedApps.filter((a: any) => a.isPinned)
        : sortedApps;

      // Calculate pin statistics
      const totalPinned = appsWithPins.filter((a: any) => a.isPinned).length;
      const pinnedByRule = appsWithPins.filter((a: any) => a.pinInfo && a.pinInfo.ruleType && a.pinInfo.ruleType !== 'manual').length;
      const manualPins = totalPinned - pinnedByRule;

      logger.info(`[AppsWithPinsAPI] Result summary: ${JSON.stringify({
        deviceId,
        userId: auth.user.id,
        totalApps: appData.total,
        returnedApps: filteredApps.length,
        pinnedApps: totalPinned,
        appliedFilter: isPinnedOnly ? 'pinned' : filter,
        page: appData.page,
        limit: appData.limit
      })}`);

      return json({
        success: true,
        data: {
          deviceId,
          device: {
            id: device.id,
            name: device.name,
            status: device.status,
            accountId: device.accountId
          },
          apps: filteredApps,
          pagination: {
            page: appData.page,
            limit: appData.limit,
            total: isPinnedOnly ? totalPinned : appData.total,
            totalPages: Math.ceil((isPinnedOnly ? totalPinned : appData.total) / appData.limit),
            hasNext: appData.page < Math.ceil((isPinnedOnly ? totalPinned : appData.total) / appData.limit),
            hasPrev: appData.page > 1
          },
          pinStats: {
            totalPinned,
            pinnedByRule,
            manualPins,
            pinRate: (isPinnedOnly ? filteredApps.length : appData.total) > 0 
              ? (totalPinned / (isPinnedOnly ? filteredApps.length : appData.total) * 100).toFixed(1) 
              : '0.0'
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to retrieve apps with pin status', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });

      return json({
        success: false,
        error: 'Failed to retrieve apps with pin status',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER']
);
