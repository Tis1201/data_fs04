/**
 * Unified Resources API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/resources
 * - /api/user/resources
 * - /api/admin/iot/resources
 * - /api/user/resources
 * 
 * Works for both admin and user roles with appropriate permission checks.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { resourceVisibilityOrForAccount, unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';

/**
 * GET /api/v2/resources
 * List resources (paginated, filterable)
 * 
 * Query params:
 * - type: filter by resource type (APP, FIRMWARE, FILE)
 * - page: page number
 * - pageSize: items per page
 * 
 * - Admin: sees all resources
 * - User: sees resources owned by their account plus admin-shared catalog
 */
export const GET: RequestHandler = unifiedEndpoint(
	async ({ context, event }) => {
		const url = event.url;
		const typeFilter = url.searchParams.get('type');
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = Math.min(
			parseInt(url.searchParams.get('pageSize') || '20'),
			100
		);
		const isAdmin = context.session.user.systemRole === 'ADMIN';

		const typePart = typeFilter ? { type: typeFilter } : {};
		let whereClause: Record<string, unknown>;

		if (isAdmin) {
			whereClause = typePart;
		} else if (context.account?.id) {
			const aid = context.account.id;
			whereClause = {
				...typePart,
				OR: resourceVisibilityOrForAccount(aid)
			};
		} else {
			whereClause = {
				...typePart,
				createdBy: context.session.user.id
			};
		}

		const skip = (page - 1) * pageSize;

		const [rows, total] = await Promise.all([
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
					updatedAt: true,
					accountId: true,
					shareScope: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			}),
			context.prisma.resource.count({
				where: whereClause
			})
		]);

		const items = rows.map((row: (typeof rows)[number]) => {
			let access: 'admin' | 'owner' | 'shared_read';
			if (isAdmin) {
				access = 'admin';
			} else if (!context.account?.id) {
				// List is scoped to createdBy only — viewer owns these rows
				access = 'owner';
			} else if (row.accountId === context.account.id) {
				access = 'owner';
			} else {
				access = 'shared_read';
			}
			const { shareScope: _s, ...rest } = row;
			return { ...rest, access };
		});

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

