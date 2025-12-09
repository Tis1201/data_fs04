/**
 * Unified Device Tag Deletion API (v2)
 * 
 * This endpoint removes a specific tag from a device (via path parameter).
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * DELETE /api/v2/devices/[id]/tags/[tagId]
 * Remove a tag from a device
 */
export const DELETE = unifiedEndpoint(
	async ({ context, params }) => {
		const { id: deviceId, tagId } = params;
		
		// Get device and check access
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				accountId: true,
				createdBy: true
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
		
		// Remove device tag from device
		await prisma.device.update({
			where: { id: deviceId },
			data: {
				tags: {
					disconnect: { id: tagId }
				}
			}
		});
		
		logger.info(`[Device Tags v2] Tag ${tagId} removed from device ${deviceId}`, {
			requestId: context.requestId,
			userId: context.session.user.id
		});
		
		return successResponse(
			{ message: 'Tag removed from device', deviceId, tagId },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.edit' }
);

