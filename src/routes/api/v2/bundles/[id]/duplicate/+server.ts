/**
 * Unified Bundle Duplication API (v2)
 * 
 * This endpoint duplicates a bundle with all its apps and devices.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/bundles/[id]/duplicate
 * Duplicate a bundle
 * 
 * Request body (optional):
 * {
 *   "name": "Custom name for duplicate"
 * }
 */
export const POST = unifiedEndpoint(
	async ({ context, params, event }) => {
		const { id: bundleId } = params;
		const body = await event.request.json().catch(() => ({}));
		const customName = body.name;
		
		// Get the original bundle with all its relationships
		const originalBundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			include: {
				apps: {
					include: {
						resource: true
					},
					orderBy: {
						order: 'asc'
					}
				},
				devices: {
					orderBy: {
						createdAt: 'asc'
					}
				}
			}
		});
		
		if (!originalBundle) {
			throw Object.assign(
				new Error('Bundle not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Check access to original bundle
		requireResourceAccess(context, {
			accountId: originalBundle.accountId || undefined,
			createdBy: originalBundle.createdBy
		});
		
		// Create the new bundle with DRAFT status
		const newBundle = await prisma.bundle.create({
			data: {
				name: customName || `${originalBundle.name} (Copy)`,
				description: originalBundle.description 
					? `${originalBundle.description} (Copy)` 
					: 'Copy of existing bundle',
				os: originalBundle.os,
				reboot: originalBundle.reboot,
				autoOpen: originalBundle.autoOpen,
				forceUpdate: originalBundle.forceUpdate,
				status: 'DRAFT',
				version: originalBundle.version,
				waveSize: originalBundle.waveSize,
				scheduledAt: null, // Reset scheduling
				scheduledAtTimezone: null,
				scheduledAtStartIfMissed: false,
				createdBy: context.session.user.id,
				updatedBy: context.session.user.id,
				accountId: context.session.user.systemRole === 'ADMIN' ? originalBundle.accountId : context.account?.id
			}
		});
		
		// Copy all apps from the original bundle
		const appPromises = originalBundle.apps.map((app) =>
			prisma.bundleApp.create({
				data: {
					bundleId: newBundle.id,
					resourceId: app.resourceId,
					order: app.order,
					autoOpen: app.autoOpen,
					createdBy: context.session.user.id,
					updatedBy: context.session.user.id
				}
			})
		);
		
		// Copy all devices sequentially with small delays to preserve order
		for (let i = 0; i < originalBundle.devices.length; i++) {
			const bundleDevice = originalBundle.devices[i];
			await prisma.bundleDevice.create({
				data: {
					bundleId: newBundle.id,
					deviceId: bundleDevice.deviceId,
					createdBy: context.session.user.id,
					updatedBy: context.session.user.id
				}
			});
			
			// Add a small delay (1ms) between each device creation to ensure different timestamps
			if (i < originalBundle.devices.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1));
			}
		}
		
		// Execute app copy operations
		await Promise.all(appPromises);
		
		logger.info(`[Bundle Duplicate v2] Bundle ${bundleId} duplicated to ${newBundle.id}`, {
			requestId: context.requestId,
			userId: context.session.user.id,
			originalBundleId: bundleId,
			newBundleId: newBundle.id
		});
		
		return successResponse(
			{
				id: newBundle.id,
				name: newBundle.name,
				appsCount: originalBundle.apps.length,
				devicesCount: originalBundle.devices.length,
				message: 'Bundle duplicated successfully'
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.create' }
);

