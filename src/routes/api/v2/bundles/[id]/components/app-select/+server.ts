/**
 * Unified Bundle App Selector API (v2)
 * 
 * This endpoint provides resource selection for bundle apps.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/bundles/[id]/components/app-select
 * Get resources available for adding to bundle (excludes already added)
 * 
 * Query params:
 * - page: page number
 * - per_page: items per page (default: 5)
 * - search: search term
 * - types: comma-separated types (APP, FIRMWARE, FILE)
 * - formats: comma-separated formats (apk, zip, etc.)
 * - targets: comma-separated targets (user, system)
 */
export const GET = unifiedEndpoint(
	async ({ context, params, event }) => {
		const bundleId = params.id;
		
		// Get bundle and check access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: {
				id: true,
				accountId: true,
				createdBy: true
			}
		});
		
		if (!bundle) {
			throw Object.assign(
				new Error('Bundle not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		requireResourceAccess(context, {
			accountId: bundle.accountId || undefined,
			createdBy: bundle.createdBy
		});
		
		// Get already-added resources
		const existing = await prisma.bundleApp.findMany({
			where: { bundleId },
			select: { resourceId: true }
		});
		const excludeIds = existing.map(e => e.resourceId);
		
		// Parse query params
		const url = event.url;
		const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
		const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') || '5')));
		const search = url.searchParams.get('search')?.trim() || '';
		const types = url.searchParams.get('types')?.split(',').filter(Boolean);
		const formats = url.searchParams.get('formats')?.split(',').filter(Boolean);
		const targets = url.searchParams.get('targets')?.split(',').filter(Boolean);
		
		// Build where clause
		const where: any = {
			id: { notIn: excludeIds }
		};
		
		// Account filtering
		const isAdmin = context.session.user.systemRole === 'ADMIN';
		if (!isAdmin) {
			where.accountId = context.account?.id;
		}
		
		// Search filter
		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ packageName: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } }
			];
		}
		
		// Type filter
		if (types && types.length > 0) {
			where.type = { in: types };
		}
		
		// Format filter
		if (formats && formats.length > 0) {
			where.format = { in: formats };
		}
		
		// Target filter
		if (targets && targets.length > 0) {
			where.target = { in: targets };
		}
		
		const skip = (page - 1) * perPage;
		
		const [total, resources] = await Promise.all([
			prisma.resource.count({ where }),
			prisma.resource.findMany({
				where,
				skip,
				take: perPage,
				orderBy: { name: 'asc' },
				select: {
					id: true,
					name: true,
					type: true,
					format: true,
					version: true,
					packageName: true,
					target: true,
					size: true,
					description: true
				}
			})
		]);
		
		return successResponse(
			{
				resources,
				meta: {
					total,
					last_page: Math.max(1, Math.ceil(total / perPage)),
					pagination: {
						page,
						per_page: perPage,
						total_records: total,
						total_pages: Math.max(1, Math.ceil(total / perPage))
					}
				}
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.view' }
);

