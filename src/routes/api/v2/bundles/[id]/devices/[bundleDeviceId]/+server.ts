/**
 * Unified Bundle Device Removal API (v2)
 * 
 * This endpoint removes a device from a bundle.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * DELETE /api/v2/bundles/[id]/devices/[bundleDeviceId]
 * Remove a device from a bundle
 */
export const DELETE = unifiedEndpoint(
	async ({ context, params }) => {
		const { id: bundleId, bundleDeviceId } = params;
		
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
				new Error('Can only remove devices from DRAFT bundles'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		
		// Find the bundle device
		const bundleDevice = await prisma.bundleDevice.findUnique({
			where: { id: bundleDeviceId },
			select: { id: true, bundleId: true, deviceId: true }
		});
		
		if (!bundleDevice || bundleDevice.bundleId !== bundleId) {
			throw Object.assign(
				new Error('Device not found in bundle'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Delete
		await prisma.bundleDevice.delete({ 
			where: { id: bundleDeviceId } 
		});
		
		logger.info(`[Bundle Devices v2] Removed device from bundle: ${bundleId}, bundleDeviceId: ${bundleDeviceId}`, {
			requestId: context.requestId,
			userId: context.session.user.id
		});
		
		return successResponse(
			{ deleted: true, bundleDeviceId },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.edit' }
);

