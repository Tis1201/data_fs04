import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';
import type { RequestHandler } from './$types';

// --- Helpers ---------------------------------------------------------------

type SystemRole = 'ADMIN' | 'USER' | string;

function computePrecedence(ruleType: string, systemRole: SystemRole): number {
  if (systemRole === 'ADMIN') {
    // Admin: admin_custom (2) > admin_default (1)
    return ruleType === 'admin_custom' ? 2 : ruleType === 'admin_default' ? 1 : 0;
  }
  // Non-admin: user_custom (3) > user_default (2) > admin_default (1)
  return ruleType === 'user_custom'
    ? 3
    : ruleType === 'user_default'
    ? 2
    : ruleType === 'admin_default'
    ? 1
    : 0;
}

function sortByPrecedenceThenCreatedAtDesc(systemRole: SystemRole) {
  return (a: any, b: any) => {
    const pa = computePrecedence(a.ruleType, systemRole);
    const pb = computePrecedence(b.ruleType, systemRole);
    if (pa !== pb) return pb - pa; // higher tier first
    // tie-breaker: createdAt DESC
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return db - da;
  };
}

function sortApps(apps: any[], sortBy: string, sortOrder: string) {
  return [...apps].sort((a, b) => {
    // Pinned first, then sort criterion
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    const dir = sortOrder === 'desc' ? -1 : 1;

    if (sortBy === 'name') {
      return a.app_name.localeCompare(b.app_name) * dir;
    } else if (sortBy === 'package_name') {
      return a.package_name.localeCompare(b.package_name) * dir;
    } else if (sortBy === 'app_type') {
      return a.app_type.localeCompare(b.app_type) * dir;
    }

    return 0;
  });
}

// --- Route -----------------------------------------------------------------

// GET /api/devices/[id]/apps-with-pins - Get apps with pin status (single highest-tier rule)
export const GET: RequestHandler = restrict(
  async ({ params, url, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id: deviceId } = params;

      // Pagination & query params
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const search = url.searchParams.get('search') || '';
      const filter = url.searchParams.get('filter') || 'all'; // 'all' | 'pinned' | 'unpinned' | others for your CH source
      const sortBy = url.searchParams.get('sortBy') || 'name'; // 'name' | 'package_name' | 'app_type'
      const sortOrder = url.searchParams.get('sortOrder') || 'asc'; // 'asc' | 'desc'

      // Validate pagination
      if (page < 1 || limit < 1 || limit > 100) {
        return json(
          {
            success: false,
            error: 'Invalid pagination parameters',
            message: 'Page must be >= 1, limit must be between 1 and 100'
          },
          { status: 400 }
        );
      }

      // Device & access check
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
        return json(
          {
            success: false,
            error: 'Device not found',
            message: 'The requested device does not exist'
          },
          { status: 404 }
        );
      }

      const hasPermission =
        auth.user.systemRole === 'ADMIN' ||
        (device.account?.members && device.account.members.length > 0);

      if (!hasPermission) {
        return json(
          {
            success: false,
            error: 'Insufficient permissions',
            message: 'You do not have permission to view this device'
          },
          { status: 403 }
        );
      }

      // Fetch apps from ClickHouse (source does not know 'pinned'/'unpinned')
      // Check if ClickHouse is available first
      let appData: { apps: any[]; total: number; page: number; limit: number };
      
      if (!deviceAppService.isAvailable()) {
        logger.warn('[AppsWithPinsAPI] ClickHouse not available, returning empty list');
        appData = { apps: [], total: 0, page, limit };
      } else {
        const sourceFilter = filter === 'pinned' || filter === 'unpinned' ? 'all' : filter;
        appData = await deviceAppService.getDeviceApps(deviceId, page, limit, {
          search,
          filter: sourceFilter,
          sortBy,
          sortOrder
        });

        // Basic validation & diagnostic
        if (!appData || !Array.isArray(appData.apps)) {
          logger.error(`[AppsWithPinsAPI] Invalid app data:`, { appData, type: typeof appData });
          appData = { apps: [], total: 0, page, limit };
        }
      }

      try {
        logger.info(
          `[AppsWithPinsAPI] ClickHouse summary: ${JSON.stringify({
            deviceId,
            sourceFilter,
            page: appData.page,
            limit: appData.limit,
            total: appData.total,
            returned: appData.apps.length,
            sample: appData.apps.slice(0, 25).map((a: any) => ({
              package_name: a.package_name,
              app_name: a.app_name
            }))
          })}`
        );
      } catch {}

      // ---------------- Rule selection (SINGLE HIGHEST-TIER RULE ONLY) ----------------
      // Build applicable rules
      const systemRole: SystemRole = auth.user.systemRole;

      const applicableRules = await prisma.pinRule.findMany({
        where:
          systemRole === 'ADMIN'
            ? {
                isActive: true,
                OR: [{ ruleType: 'admin_default' }, { ruleType: 'admin_custom' }]
              }
            : {
                isActive: true,
                OR: [
                  { ruleType: 'admin_default' },
                  { ruleType: 'user_default', accountId: device.accountId },
                  { ruleType: 'user_custom', accountId: device.accountId, createdBy: auth.user.id }
                ]
              }
      });

      // Sort by precedence & createdAt DESC, then PICK ONLY THE FIRST ONE
      const sortedRules = applicableRules.sort(
        sortByPrecedenceThenCreatedAtDesc(systemRole)
      );

      const topRule = sortedRules[0] || null;

      logger.info(
        `[AppsWithPinsAPI] Selected top rule: ${
          topRule
            ? JSON.stringify({
                id: topRule.id,
                type: topRule.ruleType,
                name: topRule.name,
                createdAt: topRule.createdAt
              })
            : 'none'
        }`
      );

      // Build pin map ONLY from the selected top rule
      const pinStatusMap = new Map<string, any>();
      const topRuleApps: string[] = (topRule?.apps as string[]) || [];

      for (const pkg of topRuleApps) {
        if (typeof pkg === 'string' && pkg.length > 0 && !pinStatusMap.has(pkg)) {
          pinStatusMap.set(pkg, {
            isPinned: true,
            pinnedBy: topRule?.name,
            ruleType: topRule?.ruleType,
            pinnedAt: new Date().toISOString(),
            ruleId: topRule?.id,
            createdBy: topRule?.createdBy
          });
        }
      }

      // Combine CH apps with pin info (from single rule)
      const appsWithPins = appData.apps.map((app: any) => {
        const pinInfo = pinStatusMap.get(app.package_name) || null;
        return { ...app, isPinned: !!pinInfo, pinInfo };
      });

      // Sorting (pinned first, then criterion)
      const sortedApps = sortApps(appsWithPins, sortBy, sortOrder);

      // Optional filter to pinned only
      const isPinnedOnly = filter === 'pinned';
      const filteredApps = isPinnedOnly ? sortedApps.filter((a) => a.isPinned) : sortedApps;

      // Stats
      const totalPinned = appsWithPins.filter((a) => a.isPinned).length;
      const pinnedByUserCustom = appsWithPins.filter(
        (a) => a.pinInfo && a.pinInfo.ruleType === 'user_custom'
      ).length;
      const pinnedByRule = totalPinned - pinnedByUserCustom;
      const manualPins = pinnedByUserCustom; // keeping your previous naming

      try {
        logger.info(
          `[AppsWithPinsAPI] Result summary: ${JSON.stringify({
            deviceId,
            userId: auth.user.id,
            totalApps: appData.total,
            returnedApps: filteredApps.length,
            pinnedApps: totalPinned,
            appliedFilter: isPinnedOnly ? 'pinned' : filter,
            page: appData.page,
            limit: appData.limit,
            selectedRuleId: topRule?.id || null,
            selectedRuleType: topRule?.ruleType || null
          })}`
        );
      } catch {}

      const effectiveTotal = isPinnedOnly ? totalPinned : appData.total;
      const totalPages = Math.ceil(effectiveTotal / appData.limit);

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
            total: effectiveTotal,
            totalPages,
            hasNext: appData.page < totalPages,
            hasPrev: appData.page > 1
          },
          pinStats: {
            totalPinned,
            pinnedByRule,
            manualPins,
            pinRate:
              (isPinnedOnly ? filteredApps.length : appData.total) > 0
                ? (
                    (totalPinned / (isPinnedOnly ? filteredApps.length : appData.total)) *
                    100
                  ).toFixed(1)
                : '0.0'
          },
          rule: topRule
            ? {
                id: topRule.id,
                name: topRule.name,
                type: topRule.ruleType,
                createdAt: topRule.createdAt,
                appsCount: topRuleApps.length
              }
            : null,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Failed to retrieve apps with pin status', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });

      return json(
        {
          success: false,
          error: 'Failed to retrieve apps with pin status',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  },
  ['ADMIN', 'USER']
);
