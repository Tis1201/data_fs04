/**
 * Unified Bundle Device Tags Selector API (v2)
 * 
 * This endpoint provides device tag filtering for bundle device selection.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/bundles/[id]/device-tags
 * Get device tags for filtering bundle devices
 * 
 * Returns all available tags in the account that can be used to filter devices.
 */
export const GET = unifiedEndpoint(
	async ({ context, params }) => {
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
		
		// Get all tags in the account
		const isAdmin = context.session.user.systemRole === 'ADMIN';
		const where = isAdmin && !context.account?.id
			? {} // Admin with no accountId filter sees all
			: { accountId: context.account?.id }; // User or admin with accountId filter
		
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
	{ permission: 'bundle.view' }
);

