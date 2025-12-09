/**
 * Unified Bundle App Removal API (v2)
 * 
 * This endpoint removes an app from a bundle.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * DELETE /api/v2/bundles/[id]/apps/[appId]
 * Remove an app from a bundle
 */
export const DELETE = unifiedEndpoint(
	async ({ context, params }) => {
		const { id: bundleId, appId } = params;
		
		// Get bundle and check access
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
		
		requireResourceAccess(context, {
			accountId: bundle.accountId || undefined,
			createdBy: bundle.createdBy
		});
		
		// Can only modify DRAFT bundles
		if (bundle.status !== 'DRAFT') {
			throw Object.assign(
				new Error('Can only remove apps from DRAFT bundles'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		
		// Check if bundle app exists
		const bundleApp = await prisma.bundleApp.findUnique({
			where: { id: appId }
		});
		
		if (!bundleApp) {
			throw Object.assign(
				new Error('Bundle app not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Verify that the bundle app belongs to the specified bundle
		if (bundleApp.bundleId !== bundleId) {
			throw Object.assign(
				new Error('Bundle app does not belong to this bundle'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		// Delete the bundle app
		await prisma.bundleApp.delete({
			where: { id: appId }
		});
		
		logger.info(`[Bundle Apps v2] Removed app from bundle: ${bundleId}, appId: ${appId}`, {
			requestId: context.requestId,
			userId: context.session.user.id
		});
		
		return successResponse(
			{ deleted: true, appId },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.edit' }
);

