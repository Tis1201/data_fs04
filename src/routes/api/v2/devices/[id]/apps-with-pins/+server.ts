import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';
import { logger } from '$lib/server/logger';

type SystemRole = 'ADMIN' | 'USER' | string;

function computePrecedence(ruleType: string, systemRole: SystemRole): number {
	if (systemRole === 'ADMIN') {
		return ruleType === 'admin_custom' ? 2 : ruleType === 'admin_default' ? 1 : 0;
	}
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
		if (pa !== pb) return pb - pa;
		const da = new Date(a.createdAt).getTime();
		const db = new Date(b.createdAt).getTime();
		return db - da;
	};
}

function sortApps(apps: any[], sortBy: string, sortOrder: string) {
	return [...apps].sort((a, b) => {
		if (a.isPinned && !b.isPinned) return -1;
		if (!a.isPinned && b.isPinned) return 1;
		const dir = sortOrder === 'desc' ? -1 : 1;
		if (sortBy === 'name') return (a.app_name || '').localeCompare(b.app_name || '') * dir;
		if (sortBy === 'package' || sortBy === 'package_name') return (a.package_name || '').localeCompare(b.package_name || '') * dir;
		if (sortBy === 'app_type') return (a.app_type || '').localeCompare(b.app_type || '') * dir;
		if (sortBy === 'version') return (a.version || '').localeCompare(b.version || '') * dir;
		if (sortBy === 'size') return ((a.size_bytes ?? 0) - (b.size_bytes ?? 0)) * dir;
		if (sortBy === 'modified') {
			const ta = new Date(a.created_at || a.last_modified || 0).getTime();
			const tb = new Date(b.created_at || b.last_modified || 0).getTime();
			return (ta - tb) * dir;
		}
		return 0;
	});
}

export const GET = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		const url = event.url;

		// Pagination & query params
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '10');
		const search = url.searchParams.get('search') || '';
		const filter = url.searchParams.get('filter') || 'all';
		const sortBy = url.searchParams.get('sortBy') || 'name';
		const sortOrder = url.searchParams.get('sortOrder') || 'asc';

		if (page < 1 || limit < 1 || limit > 100) {
			throw Object.assign(new Error('Invalid pagination parameters'), { status: 400, code: ErrorCodes.INVALID_INPUT });
		}

		// Device & access check
		const device = await context.prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				name: true,
				status: true,
				accountId: true,
				createdBy: true
			}
		});

		if (!device) {
			throw Object.assign(new Error('Device not found'), { status: 404, code: ErrorCodes.NOT_FOUND });
		}

		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});

		// Fetch apps from ClickHouse (source does not know pinned/unpinned)
		// Check if ClickHouse is available first
		let appData: { apps: any[]; total: number; page: number; limit: number };
		
		if (!deviceAppService.isAvailable()) {
			logger.warn('[AppsWithPinsV2] ClickHouse not available, returning empty list');
			appData = { apps: [], total: 0, page, limit };
		} else {
			try {
				const sourceFilter = filter === 'pinned' || filter === 'unpinned' ? 'all' : filter;
				appData = await deviceAppService.getDeviceApps(deviceId, page, limit, {
					search,
					filter: sourceFilter,
					sortBy,
					sortOrder
				});

				if (!appData || !Array.isArray(appData.apps)) {
					logger.error(`[AppsWithPinsV2] Invalid app data`, { appData });
					appData = { apps: [], total: 0, page, limit };
				}
			} catch (e) {
				logger.error('[AppsWithPinsV2] Failed to get apps from ClickHouse', {
					error: e instanceof Error ? e.message : String(e),
					deviceId
				});
				appData = { apps: [], total: 0, page, limit };
			}
		}

		// Build applicable rules
		const systemRole: SystemRole = context.session.user.systemRole;
		const applicableRules = await context.prisma.pinRule.findMany({
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
								{ ruleType: 'user_custom', accountId: device.accountId, createdBy: context.session.user.id }
							]
					  }
		});

		const sortedRules = applicableRules.sort(sortByPrecedenceThenCreatedAtDesc(systemRole));
		const topRule = sortedRules[0] || null;
		const topRuleApps: string[] = (topRule?.apps as string[]) || [];

		const pinStatusMap = new Map<string, any>();
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

		const appsWithPins = appData.apps.map((app: any) => {
			const pinInfo = pinStatusMap.get(app.package_name) || null;
			return { ...app, isPinned: !!pinInfo, pinInfo };
		});

		const sortedApps = sortApps(appsWithPins, sortBy, sortOrder);
		const isPinnedOnly = filter === 'pinned';
		const filteredApps = isPinnedOnly ? sortedApps.filter((a) => a.isPinned) : sortedApps;

		const totalPinned = appsWithPins.filter((a) => a.isPinned).length;
		const pinnedByUserCustom = appsWithPins.filter((a) => a.pinInfo && a.pinInfo.ruleType === 'user_custom').length;
		const pinnedByRule = totalPinned - pinnedByUserCustom;
		const manualPins = pinnedByUserCustom;

		const effectiveTotal = isPinnedOnly ? totalPinned : appData.total;
		const totalPages = Math.ceil(effectiveTotal / appData.limit);

		return successResponse(
			{
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
			},
			{ requestId: context.requestId }
		);
	},
	{ skipPermission: true } // access enforced via requireResourceAccess above
);

