/**
 * Unified Resource Firmware API (v2)
 * 
 * This endpoint lists firmware resources (filtered by type=FIRMWARE).
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';

/**
 * GET /api/v2/resources/firmware
 * List firmware resources
 * 
 * Query params:
 * - page: page number
 * - pageSize: items per page
 * 
 * - Admin: sees all firmware resources
 * - User: sees only firmware resources in their account
 */
export const GET = unifiedEndpoint(
	async ({ context, event }) => {
		const url = event.url;
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = Math.min(
			parseInt(url.searchParams.get('pageSize') || '20'),
			100
		);
		const isAdmin = context.session.user.systemRole === 'ADMIN';

		// Build where clause - admins see all, users see only their own
		const whereClause: any = {
			type: 'FIRMWARE'
		};

		// Non-admins can only see firmware they created
		if (!isAdmin) {
			whereClause.createdBy = context.session.user.id;
		}

		const skip = (page - 1) * pageSize;

		const [items, total] = await Promise.all([
			context.prisma.resource.findMany({
				where: whereClause,
				skip,
				take: pageSize,
				select: {
					id: true,
					name: true,
					description: true,
					packageName: true,
					format: true,
					version: true,
					releaseType: true,
					size: true,
					createdAt: true,
					updatedAt: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			}),
			context.prisma.resource.count({
				where: whereClause
			})
		]);

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

