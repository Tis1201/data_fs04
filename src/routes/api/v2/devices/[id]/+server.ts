/**
 * Unified Device Detail API (v2)
 * 
 * This endpoint provides device information and management.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { requirePermission } from '$lib/server/security/permissions';
import { successResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/devices/[id]
 * Get device details.
 * Permission is checked with the loaded device as resource so USER role can pass (device.view requires resource.accountId).
 */
export const GET = unifiedEndpoint(
	async ({ context, params }) => {
		const deviceId = params.id;

		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			include: {
				account: true,
				company: true,
				tags: true,
				profileAssignment: {
					include: {
						profile: {
							select: {
								id: true,
								name: true,
								description: true
							}
						}
					}
				},
				_count: {
					select: {
						actionLogs: true
					}
				}
			}
			// Note: When using include, Prisma automatically includes all scalar fields
			// So profileId and all config fields (kioskLockMode, displayResolution, etc.)
			// will be automatically included in the result
		});

		if (!device) {
			throw Object.assign(
				new Error('Device not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}

		// Check permission with device as resource (USER needs resource.accountId for device.view)
		await requirePermission(context.permissionUser, 'device.view', {
			accountId: device.accountId ?? undefined,
			createdBy: device.createdBy ?? undefined
		});

		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});

		return successResponse(device, { requestId: context.requestId });
	},
	{ permission: 'device.view', skipPermission: true }
);

/**
 * DELETE /api/v2/devices/[id]
 * Delete a device
 */
export const DELETE = unifiedEndpoint(
	async ({ context, params }) => {
		const deviceId = params.id;
		
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				connected: true
			}
		});
		
		if (!device) {
			throw Object.assign(
				new Error('Device not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Check access
		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});
		
		// Cannot delete connected devices
		if (device.connected) {
			throw Object.assign(
				new Error('Cannot delete a connected device. Please disconnect first.'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		
		// Delete device (cascading deletes will handle related records)
		await prisma.device.delete({
			where: { id: deviceId }
		});
		
		return successResponse(
			{ deleted: true },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.delete' }
);

/**
 * PATCH /api/v2/devices/[id]
 * Update device details
 */
export const PATCH = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		const data = await event.request.json();
		
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
		
		// Check access
		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});
		
		// Build update data
		const updates: any = {};
		if (data.name !== undefined) updates.name = data.name;
		if (data.description !== undefined) updates.description = data.description;
		if (data.status !== undefined) updates.status = data.status;
		if (data.deviceType !== undefined) updates.deviceType = data.deviceType;
		
		// Admin-only fields
		if (context.session.user.systemRole === 'ADMIN') {
			if (data.accountId !== undefined) updates.accountId = data.accountId;
			if (data.companyId !== undefined) updates.companyId = data.companyId;
		}
		
		const updatedDevice = await prisma.device.update({
			where: { id: deviceId },
			data: updates,
			include: {
				account: true,
				company: true
			}
		});
		
		return successResponse(
			updatedDevice,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.edit' }
);

