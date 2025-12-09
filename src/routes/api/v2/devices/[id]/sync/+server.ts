/**
 * Unified Device Sync API (v2)
 * 
 * This endpoint triggers device synchronization.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';

/**
 * POST /api/v2/devices/[id]/sync
 * Trigger device synchronization
 * 
 * Requests device to sync its state with the server.
 */
export const POST = unifiedEndpoint(
	async ({ context, params }) => {
		const deviceId = params.id;
		
		// Get device and check access
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				name: true,
				accountId: true,
				createdBy: true,
				connected: true,
				status: true
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
		
		// Check device is active and connected
		if (device.status !== 'ACTIVE') {
			throw Object.assign(
				new Error('Device is not active'),
				{ status: 400, code: ErrorCodes.DEVICE_OFFLINE }
			);
		}
		
		if (!device.connected) {
			throw Object.assign(
				new Error('Device is offline'),
				{ status: 400, code: ErrorCodes.DEVICE_OFFLINE }
			);
		}
		
		logger.info(`[Device Sync v2] Sync requested for device ${deviceId}`, {
			requestId: context.requestId,
			userId: context.session.user.id,
			deviceId
		});
		
		// Send sync command to device
		const syncMessage = MessageFactory.createSystemMessage(
			'device:sync',
			`subscription:device:${deviceId}`,
			{
				action: 'sync',
				timestamp: new Date().toISOString()
			},
			SystemUser,
			{ echoToSender: false }
		);
		
		await publisher.publish(syncMessage);
		
		return successResponse(
			{
				deviceId,
				action: 'sync',
				status: 'sent',
				message: 'Sync command sent to device'
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.control' }
);

