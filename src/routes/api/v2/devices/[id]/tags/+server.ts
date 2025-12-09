/**
 * Unified Device Tag Assignment API (v2)
 * 
 * This endpoint manages tag assignments for a device.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * GET /api/v2/devices/[id]/tags
 * Get tags assigned to a device
 */
export const GET = unifiedEndpoint(
	async ({ context, params }) => {
		const deviceId = params.id;
		
		// Get device and check access
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				tags: {
					select: {
						id: true,
						name: true,
						description: true
					}
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
		
		return successResponse(
			device.tags,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.view' }
);

/**
 * POST /api/v2/devices/[id]/tags
 * Add a tag to a device
 * 
 * Request body:
 * {
 *   "deviceTagId": "tag_id_here"
 * }
 */
export const POST = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		const { deviceTagId } = await event.request.json();
		
		if (!deviceTagId) {
			throw Object.assign(
				new Error('Device Tag ID is required'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
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
		
		// Check if tag already assigned
		if (device.tags.some(t => t.id === deviceTagId)) {
			throw Object.assign(
				new Error('Device tag is already assigned to this device'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		
		// Add device tag to device
		await prisma.device.update({
			where: { id: deviceId },
			data: {
				tags: {
					connect: { id: deviceTagId }
				}
			}
		});
		
		logger.info(`[Device Tags v2] Tag ${deviceTagId} added to device ${deviceId}`, {
			requestId: context.requestId,
			userId: context.session.user.id
		});
		
		return successResponse(
			{ message: 'Tag added to device', deviceId, deviceTagId },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.edit' }
);

/**
 * DELETE /api/v2/devices/[id]/tags
 * Remove a tag from a device
 * 
 * Request body:
 * {
 *   "deviceTagId": "tag_id_here"
 * }
 */
export const DELETE = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		const { deviceTagId } = await event.request.json();
		
		if (!deviceTagId) {
			throw Object.assign(
				new Error('Device Tag ID is required'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
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
					disconnect: { id: deviceTagId }
				}
			}
		});
		
		logger.info(`[Device Tags v2] Tag ${deviceTagId} removed from device ${deviceId}`, {
			requestId: context.requestId,
			userId: context.session.user.id
		});
		
		return successResponse(
			{ message: 'Tag removed from device', deviceId, deviceTagId },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.edit' }
);

