/**
 * Unified Bundle Publish API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/bundles/[id]/publish
 * - /api/user/iot/bundles/[id]/publish
 * 
 * Publishes a bundle and creates deployment waves.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { publishBundleCore } from '$lib/server/bundles/bundlePublisher';

/**
 * POST /api/v2/bundles/[id]/publish
 * Publish a bundle and create waves
 * 
 * - Validates bundle is in DRAFT status
 * - Creates deployment waves
 * - Starts first wave automatically
 */
export const POST = unifiedEndpoint(
	async ({ context, params }) => {
		const bundleId = params.id;
		
		// Check if bundle exists and user has access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				status: true
			}
		});
		
		if (!bundle) {
			throw Object.assign(
				new Error('Bundle not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Check ownership (fix null -> undefined conversion)
		requireResourceAccess(context, {
			accountId: bundle.accountId ?? undefined,
			createdBy: bundle.createdBy
		});
		
		// Call the core publish logic (shared with scheduler)
		const result = await publishBundleCore(
			prisma,
			bundleId,
			context.session.user.id
		);
		
		if (result.status !== 200) {
			throw Object.assign(
				new Error(result.body.error || 'Publish failed'),
				{ status: result.status, code: ErrorCodes.OPERATION_FAILED }
			);
		}
		
		return successResponse(
			result.body,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.publish' }
);

