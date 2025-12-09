/**
 * Unified Resource Apps API (v2)
 * 
 * This endpoint lists app resources with unique packageNames (grouped).
 * Works for both admin and user roles with appropriate permission checks.
 * 
 * Matches the behavior of /api/apps/available for backward compatibility.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * GET /api/v2/resources/apps
 * List app resources (grouped by packageName)
 * 
 * Query params:
 * - page: page number
 * - pageSize: items per page
 * - search: search term (searches packageName and name)
 * - excludePackages: comma-separated list of package names to exclude (for pin rule editing)
 * 
 * - Admin: sees all app resources
 * - User: sees only app resources they created (createdBy)
 * 
 * Returns:
 * - Unique packageNames (deduplicated)
 * - App name for each packageName
 */
export const GET: RequestHandler = unifiedEndpoint(
	async ({ context, event }) => {
		const url = event.url;
		const search = url.searchParams.get('search') || '';
		const excludePackagesParam = url.searchParams.get('excludePackages') || '';
		const excludePackages = excludePackagesParam ? excludePackagesParam.split(',').filter(Boolean) : [];
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = Math.min(
			parseInt(url.searchParams.get('pageSize') || '20'),
			100 // Max page size
		);

		// Determine if user is admin
		const isAdmin = context.session.user.systemRole === 'ADMIN';

		// Build where clause - admins see all apps, users see only their own
		const whereClause: any = {
			packageName: { not: null }
		};

		// Exclude already selected packages (for pin rule editing)
		if (excludePackages.length > 0) {
			whereClause.packageName = {
				...whereClause.packageName,
				notIn: excludePackages
			};
		}

		// Add search filter if provided
		if (search) {
			whereClause.OR = [
				{ packageName: { contains: search, mode: 'insensitive' } },
				{ name: { contains: search, mode: 'insensitive' } }
			];
		}

		// Non-admins can only see apps they created
		if (!isAdmin) {
			whereClause.createdBy = context.session.user.id;
		}

		// Get unique packageNames with groupBy
		const uniquePackages = await context.prisma.resource.groupBy({
			by: ['packageName'],
			where: whereClause,
			orderBy: {
				packageName: 'asc'
			},
			_count: {
				packageName: true
			}
		});

		const total = uniquePackages.length;
		const offset = (page - 1) * pageSize;
		const paginatedPackages = uniquePackages.slice(offset, offset + pageSize);

	// For each unique packageName, get one representative resource to get the name
	const packageNames = paginatedPackages.map((p: any) => p.packageName).filter(Boolean);
	
	// Build where clause for second query - don't reapply excludePackages filter
	// (already filtered in groupBy above)
	const detailsWhereClause: any = {
		packageName: { in: packageNames }
	};
	
	// Add search filter if provided
	if (search) {
		detailsWhereClause.OR = [
			{ packageName: { contains: search, mode: 'insensitive' } },
			{ name: { contains: search, mode: 'insensitive' } }
		];
	}
	
	// Non-admins can only see apps they created
	if (!isAdmin) {
		detailsWhereClause.createdBy = context.session.user.id;
	}
	
	const resourceDetails = await context.prisma.resource.findMany({
		where: detailsWhereClause,
		distinct: ['packageName'],
		select: {
			id: true,
			packageName: true,
			name: true,
			format: true,
			version: true,
			releaseType: true,
			createdAt: true
		},
		orderBy: {
			packageName: 'asc'
		}
	});

		const items = resourceDetails.map((r: any) => ({
			id: r.id,
			packageName: r.packageName,
			name: r.name ?? r.packageName,
			format: r.format,
			version: r.version,
			releaseType: r.releaseType,
			createdAt: r.createdAt
		}));

		return {
			success: true,
			data: {
				items,
				total,
				page,
				pageSize,
				totalPages: Math.ceil(total / pageSize)
			},
			meta: {
				timestamp: new Date().toISOString(),
				requestId: context.requestId
			}
		};
	}
	// No specific permission needed - filters by createdBy for users
	// Admin sees all, user sees only their own uploaded resources
);

