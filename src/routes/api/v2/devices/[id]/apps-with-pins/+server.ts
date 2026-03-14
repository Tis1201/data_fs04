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
		if (sortBy === 'name' || sortBy === 'app') return (a.app_name || '').localeCompare(b.app_name || '') * dir;
		if (sortBy === 'package' || sortBy === 'package_name') return (a.package_name || '').localeCompare(b.package_name || '') * dir;
		if (sortBy === 'app_type') return (a.app_type || '').localeCompare(b.app_type || '') * dir;
		if (sortBy === 'version') return (a.version || '').localeCompare(b.version || '') * dir;
		if (sortBy === 'size') return ((a.size_bytes ?? 0) - (b.size_bytes ?? 0)) * dir;
		if (sortBy === 'modified' || sortBy === 'installed') {
			const ta = new Date(a.last_modified || a.created_at || 0).getTime();
			const tb = new Date(b.last_modified || b.created_at || 0).getTime();
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
		const search = (url.searchParams.get('search') || '').trim();
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

		// Build applicable rules FIRST so we can pass pinnedPackages to getDeviceApps (TC-RDM-APR-0118)
		// Exclude draft rules and apply targetType/targetValue (specific devices) filter
		const systemRole: SystemRole = context.session.user.systemRole;
		const roleWhere =
			systemRole === 'ADMIN'
				? {
						isActive: true,
						isDraft: false,
						OR: [{ ruleType: 'admin_default' }, { ruleType: 'admin_custom' }]
				  }
				: {
						isActive: true,
						isDraft: false,
						OR: [
							{ ruleType: 'admin_default' },
							{ ruleType: 'user_default', accountId: device.accountId },
							{ ruleType: 'user_custom', accountId: device.accountId, createdBy: context.session.user.id }
						]
				  };

		const allApplicableRules = await context.prisma.pinRule.findMany({
			where: roleWhere,
			select: { id: true, ruleType: true, name: true, apps: true, targetType: true, targetValue: true, createdAt: true, createdBy: true }
		});

		// Filter by device target:
		// - 'all' applies to all devices
		// - 'specific' (from Pin Rules UI "Apply To → Specific Devices") and 'devices' (from manual Pin/Unpin API) apply when deviceId is in targetValue
		const applicableRules = allApplicableRules.filter((r) => {
			const targetType = r.targetType || 'all';
			if (targetType === 'all') return true;
			if ((targetType === 'specific' || targetType === 'devices') && Array.isArray(r.targetValue)) {
				return r.targetValue.includes(deviceId);
			}
			return false;
		});

		const sortedRules = applicableRules.sort(sortByPrecedenceThenCreatedAtDesc(systemRole));
		const topRule = sortedRules[0] || null;
		// Merge apps from ALL applicable rules (per PIN_APP_DATA.md: apply all matching rules)
		// For each package, use pinInfo from the first (highest precedence) rule that contains it
		const topRuleAppsSet = new Set<string>();
		for (const r of sortedRules) {
			const apps = (r.apps as string[]) || [];
			for (const pkg of apps) {
				if (typeof pkg === 'string' && pkg.length > 0) topRuleAppsSet.add(pkg);
			}
		}
		const topRuleApps: string[] = Array.from(topRuleAppsSet);

		// Fetch apps from ClickHouse - pass pinnedPackages so pinned apps appear first on page 1 (TC-RDM-APR-0118)
		// Use larger limit to fetch enough for merge + in-memory pagination when we add pin-rule placeholders
		const CH_FETCH_LIMIT = 500;
		let appData: { apps: any[]; total: number; page: number; limit: number };

		if (!deviceAppService.isAvailable()) {
			logger.warn('[AppsWithPinsV2] ClickHouse not available, returning empty list');
			appData = { apps: [], total: 0, page, limit };
		} else {
			try {
				const sourceFilter = filter === 'pinned' || filter === 'unpinned' ? 'all' : filter;
				// For page > 1 with placeholders, we need offset override - computed after we know placeholder count
				appData = await deviceAppService.getDeviceApps(
					deviceId,
					1,
					CH_FETCH_LIMIT,
					{
						search,
						filter: sourceFilter,
						sortBy,
						sortOrder,
						pinnedPackages: topRuleApps
					}
				);

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

		const pinStatusMap = new Map<string, any>();
		// TC-RDM-APR-0118: Case-insensitive lookup (rule may have different casing than ClickHouse/device report)
		// For merged rules: assign pinInfo from the first (highest precedence) rule that contains each package
		const pinStatusMapByLower = new Map<string, any>();
		for (const r of sortedRules) {
			const apps = (r.apps as string[]) || [];
			for (const pkg of apps) {
				if (typeof pkg !== 'string' || pkg.length === 0) continue;
				const keyLower = pkg.toLowerCase();
				if (!pinStatusMap.has(pkg) && !pinStatusMapByLower.has(keyLower)) {
					const pinInfo = {
						isPinned: true,
						pinnedBy: r.name,
						ruleType: r.ruleType,
						pinnedAt: new Date().toISOString(),
						ruleId: r.id,
						createdBy: r.createdBy
					};
					pinStatusMap.set(pkg, pinInfo);
					pinStatusMapByLower.set(keyLower, pinInfo);
				}
			}
		}

		// Add apps from pin rule that are NOT yet installed (so they appear in list for "Install" action)
		// Case-insensitive: device report (CH) may have different casing than rule
		const installedPackageLower = new Set(appData.apps.map((a: any) => (a.package_name || '').toLowerCase()));
		const pinnedNotInstalled = topRuleApps.filter(
			(p: string) => typeof p === 'string' && p.length > 0 && !installedPackageLower.has(p.toLowerCase())
		);

		let placeholders: any[] = [];
		if (pinnedNotInstalled.length > 0) {
			const pkgToName = new Map<string, string>();
			if (device.accountId) {
				const resources = await context.prisma.resource.findMany({
					where: {
						accountId: device.accountId,
						packageName: { in: pinnedNotInstalled }
					},
					select: { packageName: true, name: true }
				});
				for (const r of resources) {
					if (r.packageName && !pkgToName.has(r.packageName)) {
						pkgToName.set(r.packageName, r.name || r.packageName);
					}
				}
			}
			// When searching, only include placeholders that match the search term
			const searchLower = search ? search.toLowerCase() : '';
			const includePlaceholder = (pkg: string) => {
				if (!searchLower) return true;
				const name = (pkgToName.get(pkg) || pkg).toLowerCase();
				const pkgLower = pkg.toLowerCase();
				return name.includes(searchLower) || pkgLower.includes(searchLower);
			};
			placeholders = pinnedNotInstalled.filter(includePlaceholder).map((pkg: string) => {
				const pinInfo = pinStatusMap.get(pkg);
				return {
					device_id: deviceId,
					package_name: pkg,
					app_name: pkgToName.get(pkg) || pkg,
					version: '-',
					app_type: 'Normal',
					metadata: '{}',
					created_at: null,
					last_modified: null,
					size_bytes: 0,
					isPinned: true,
					pinInfo,
					is_system_app: false,
					isInstalled: false
				};
			});
		}

		const appsWithPins = appData.apps.map((app: any) => {
			const pinInfo =
				pinStatusMap.get(app.package_name) ||
				pinStatusMapByLower.get((app.package_name || '').toLowerCase()) ||
				null;
			return { ...app, isPinned: !!pinInfo, pinInfo, isInstalled: true };
		});

		const mergedApps = [...placeholders, ...appsWithPins];
		const sortedApps = sortApps(mergedApps, sortBy, sortOrder);
		const isPinnedOnly = filter === 'pinned';
		const filteredApps = isPinnedOnly ? sortedApps.filter((a) => a.isPinned) : sortedApps;

		// In-memory pagination after merge
		const effectiveTotal = filteredApps.length;
		const totalPages = Math.ceil(effectiveTotal / limit);
		const paginatedApps = filteredApps.slice((page - 1) * limit, page * limit);

		const totalPinned = mergedApps.filter((a) => a.isPinned).length;
		const pinnedByUserCustom = mergedApps.filter((a) => a.pinInfo && a.pinInfo.ruleType === 'user_custom').length;
		const pinnedByRule = totalPinned - pinnedByUserCustom;
		const manualPins = pinnedByUserCustom;

		return successResponse(
			{
				deviceId,
				device: {
					id: device.id,
					name: device.name,
					status: device.status,
					accountId: device.accountId
				},
				apps: paginatedApps,
				pagination: {
					page,
					limit,
					total: effectiveTotal,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1
				},
				pinStats: {
					totalPinned,
					pinnedByRule,
					manualPins,
					pinRate:
						mergedApps.length > 0
							? ((totalPinned / mergedApps.length) * 100).toFixed(1)
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

