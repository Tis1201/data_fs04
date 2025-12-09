/**
 * Unified Bundle Detail API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/bundles/[id]
 * - /api/user/iot/bundles/[id]
 * 
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { initializeStateManager, getStateManager } from '$lib/server/state/stateManagerFactory';
import { logger } from '$lib/server/logger';

/**
 * DELETE /api/v2/bundles/[id]
 * Delete a bundle
 * 
 * - Validates bundle can be deleted (not in progress)
 * - Cleans up related data and state
 */
export const DELETE = unifiedEndpoint(
	async ({ context, params }) => {
		const bundleId = params.id;
		
		// Fetch bundle
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
		
		// Check ownership
		requireResourceAccess(context, {
			accountId: bundle.accountId || undefined,
			createdBy: bundle.createdBy
		});
		
		// If bundle is PUBLISHED or IN_PROGRESS, recompute status from waves
		if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
			const waves = await prisma.bundleWave.findMany({
				where: { bundleId },
				select: { status: true }
			});
			
			if (Array.isArray(waves) && waves.length > 0) {
				const anyInProgress = waves.some((w: any) => 
					w.status === 'IN_PROGRESS' || w.status === 'PENDING'
				);
				
				if (anyInProgress) {
					throw Object.assign(
						new Error('Cannot delete a published or in-progress bundle'),
						{ status: 409, code: ErrorCodes.CONFLICT }
					);
				}
				
				const anyFailed = waves.some((w: any) => w.status === 'FAILED');
				const allDone = waves.every((w: any) => 
					['COMPLETED', 'FAILED'].includes(w.status)
				);
				const newStatus = allDone ? (anyFailed ? 'FAILED' : 'COMPLETED') : bundle.status;
				
				if (newStatus !== bundle.status) {
					await prisma.bundle.update({
						where: { id: bundleId },
						data: { status: newStatus }
					});
				}
			} else {
				// No waves; still treat as not deletable if status not DRAFT
				throw Object.assign(
					new Error('Cannot delete a published or in-progress bundle'),
					{ status: 409, code: ErrorCodes.CONFLICT }
				);
			}
		}
		
		// Delete in an interactive transaction in correct order
		await prisma.$transaction(async (tx) => {
			await tx.bundleDeviceProgress.deleteMany({ where: { bundleId } });
			await tx.bundleWave.deleteMany({ where: { bundleId } });
			await tx.bundleDevice.deleteMany({ where: { bundleId } });
			await tx.bundleApp.deleteMany({ where: { bundleId } });
			await tx.bundle.delete({ where: { id: bundleId } });
		});
		
		// Clean up bundle state from state manager (admin feature)
		if (context.session.user.systemRole === 'ADMIN') {
			try {
				await initializeStateManager();
				const stateManager = getStateManager();
				await stateManager.deleteBundleState(bundleId);
			} catch (error) {
				// State cleanup is not critical for bundle deletion
				logger.warn('Failed to clean up bundle state', {
					requestId: context.requestId,
					bundleId,
					error: (error as Error).message
				});
			}
		}
		
		return successResponse(
			{ deleted: true },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.delete' }
);

