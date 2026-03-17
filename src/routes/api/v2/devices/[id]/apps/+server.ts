/**
 * Unified Device Apps API (v2)
 * 
 * This endpoint provides device app listing.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, paginatedResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';
import { logger } from '$lib/server/logger';

/**
 * GET /api/v2/devices/[id]/apps
 * Get apps installed on device
 * 
 * Query params:
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 20, max: 100)
 * - search: filter by package_name or app_name (partial match, case-insensitive)
 * - filter: app_type filter (e.g. 'all', 'system', 'user')
 * - sortBy: name | package | version | size | modified (default: name)
 * - sortOrder: asc | desc (default: asc)
 */
export const GET = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		const url = event.url;
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = Math.min(
			parseInt(url.searchParams.get('pageSize') || '20'),
			100
		);
		const search = url.searchParams.get('search') || '';
		const filter = url.searchParams.get('filter') || 'all';
		const sortBy = url.searchParams.get('sortBy') || 'name';
		const sortOrder = url.searchParams.get('sortOrder') || 'asc';
		
		// Get device and check access
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				macAddress: true
			}
		});
		
		if (!device) {
			throw Object.assign(
				new Error('Device not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Check access
		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});
		
		// Check if ClickHouse is available
		if (!deviceAppService.isAvailable()) {
			logger.warn('[DeviceAppsAPI] ClickHouse not available, returning empty list');
			return paginatedResponse(
				[],
				0,
				page,
				pageSize,
				{ requestId: context.requestId, warning: 'App data service unavailable' }
			);
		}

		let pinnedPackages: string[] = [];
		try {
			const systemRole = context.session?.user?.systemRole ?? 'USER';
			const roleWhere =
				systemRole === 'ADMIN'
					? { isActive: true, isDraft: false, OR: [{ ruleType: 'admin_default' }, { ruleType: 'admin_custom' }] }
					: {
							isActive: true,
							isDraft: false,
							OR: [
								{ ruleType: 'admin_default' },
								{ ruleType: 'user_default', accountId: device.accountId },
								{ ruleType: 'user_custom', accountId: device.accountId, createdBy: context.session?.user?.id ?? '' }
							]
					  };
			const applicableRules = await context.prisma.pinRule.findMany({
				where: roleWhere,
				select: { apps: true, targetType: true, targetValue: true, ruleType: true, createdAt: true }
			});
			const rulesForDevice = applicableRules.filter((r) => {
				const targetType = r.targetType || 'all';
				if (targetType === 'all') return true;
				if ((targetType === 'specific' || targetType === 'devices') && Array.isArray(r.targetValue)) {
					return r.targetValue.includes(deviceId);
				}
				return false;
			});
			// TC-RDM-APR-0133: Sort by precedence and build pinnedPackages in rule-priority order
			const precedence = (rt: string) =>
				systemRole === 'ADMIN'
					? rt === 'admin_custom' ? 2 : rt === 'admin_default' ? 1 : 0
					: rt === 'user_custom' ? 3 : rt === 'user_default' ? 2 : rt === 'admin_default' ? 1 : 0;
			const sortedRules = [...rulesForDevice].sort((a, b) => {
				const pa = precedence((a as any).ruleType);
				const pb = precedence((b as any).ruleType);
				if (pa !== pb) return pb - pa;
				return new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime();
			});
			const seenLower = new Set<string>();
			for (const r of sortedRules) {
				const apps = ((r.apps as string[]) || []).slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
				for (const pkg of apps) {
					if (typeof pkg !== 'string' || pkg.length === 0) continue;
					const key = pkg.toLowerCase();
					if (seenLower.has(key)) continue;
					seenLower.add(key);
					pinnedPackages.push(pkg);
				}
			}
		} catch (e) {
			logger.warn('[DeviceAppsAPI] Failed to fetch pin rules for ordering, continuing without pin prioritization', {
				error: e instanceof Error ? e.message : String(e),
				deviceId
			});
		}
		
		// Get apps from ClickHouse (with search/filter/sort from query params)
		try {
			const result = await deviceAppService.getDeviceApps(deviceId, page, pageSize, {
				search,
				filter,
				sortBy,
				sortOrder,
				pinnedPackages
			});
			
			return paginatedResponse(
				result.apps,
				result.total,
				page,
				pageSize,
				{ requestId: context.requestId }
			);
		} catch (e) {
			logger.error('[DeviceAppsAPI] Failed to get apps from ClickHouse', {
				error: e instanceof Error ? e.message : String(e),
				deviceId
			});
			
			// Return empty list instead of error to allow page to load
			return paginatedResponse(
				[],
				0,
				page,
				pageSize,
				{ requestId: context.requestId, warning: 'Failed to load app data' }
			);
		}
	},
	{ skipPermission: true } // Access enforced via requireResourceAccess
);

