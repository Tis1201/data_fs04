/**
 * Unified Bundle Device Selector API (v2)
 * 
 * This endpoint provides device selection for bundles.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/bundles/[id]/components/device-select
 * Get devices available for adding to bundle (excludes already added)
 * 
 * Query params:
 * - page: page number
 * - per_page: items per page
 * - search: search term
 * - status: filter by status
 * - tag: filter by tag name
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
		
		// Get already-added devices
		const existing = await prisma.bundleDevice.findMany({
			where: { bundleId },
			select: { deviceId: true }
		});
		const excludeIds = existing.map(e => e.deviceId);
		
		// Parse query params
		const url = event.url;
		const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
		const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') || '10')));
		const search = url.searchParams.get('search')?.trim() || '';
		const status = url.searchParams.get('status');
		const tag = url.searchParams.get('tag');
		
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
				{ description: { contains: search, mode: 'insensitive' } },
				{ id: { contains: search, mode: 'insensitive' } }
			];
		}
		
		// Status filter
		if (status) {
			where.status = status;
		}
		
		// Tag filter
		if (tag) {
			where.tags = {
				some: { name: tag }
			};
		}
		
		const skip = (page - 1) * perPage;
		
		const [total, devices] = await Promise.all([
			prisma.device.count({ where }),
			prisma.device.findMany({
				where,
				skip,
				take: perPage,
				orderBy: { name: 'asc' },
				select: {
					id: true,
					name: true,
					status: true,
					model: true,
					description: true,
					connected: true,
					lastUsedAt: true
				}
			})
		]);
		
		return successResponse(
			{
				devices,
				meta: {
					current_page: page,
					per_page: perPage,
					total,
					last_page: Math.max(1, Math.ceil(total / perPage))
				}
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.view' }
);

