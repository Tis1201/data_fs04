/**
 * Unified Device Tag Selector API (v2)
 * 
 * This endpoint provides tag selection for device tag assignments.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/devices/[id]/components/device-tag-select
 * Get tags available for assigning to device (excludes already assigned)
 * 
 * Query params:
 * - search: search term
 */
export const GET = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		
		// Get device and check access
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				tags: {
					select: { id: true }
				}
			}
		});
		
		if (!device) {
			throw Object.assign(
				new Error('Device not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});
		
		// Get already-assigned tag IDs
		const assignedTagIds = device.tags.map(t => t.id);
		
		// Parse query params
		const url = event.url;
		const search = url.searchParams.get('search')?.trim() || '';
		
		// Build where clause
		const where: any = {
			id: { notIn: assignedTagIds }
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
				{ description: { contains: search, mode: 'insensitive' } }
			];
		}
		
		const tags = await prisma.deviceTag.findMany({
			where,
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				description: true
			}
		});
		
		return successResponse(
			tags,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.view' }
);

