/**
 * Unified Device Actions API (v2)
 * 
 * This endpoint wraps the existing device actions endpoint with v2 response format.
 * Delegates to /api/devices/[id]/actions for the actual logic.
 * 
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import { TimeoutConfig } from '$lib/server/config/timeoutConfig';

/**
 * POST /api/v2/devices/[id]/actions
 * Execute device actions (reboot, install app, etc.)
 * 
 * Request body:
 * {
 *   "action": "reboot" | "installApp" | "uninstall" | "refresh" | "restart" | etc.,
 *   "data": { ... action-specific data ... }
 * }
 */
export const POST = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		const body = await event.request.json();
		const { action, data = {} } = body;
		
		if (!action) {
			throw Object.assign(
				new Error('Action is required'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
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
		
		logger.info(`[Device Actions v2] ${action} requested for device ${deviceId}`, {
			requestId: context.requestId,
			userId: context.session.user.id,
			action,
			deviceId
		});
		
		// Create action log
		const actionLog = await ActionLogger.createInitiated({
			deviceId,
			actionType: action,
			initiatedBy: context.session.user.id,
			requestId: context.requestId,
			metadata: data
		});
		
		// Map action to device command
		const actionTypeMap: Record<string, string> = {
			reboot: 'reboot',
			restart: 'restart',
			refresh: 'refresh',
			installApp: 'install_app',
			uninstall: 'uninstall_app',
			restartApp: 'restart_app',
			pushFile: 'push_file',
			pullFile: 'pull_file',
			updateFirmware: 'update_firmware',
			getLogs: 'get_logs',
			screenshot: 'screenshot',
			config: 'config_app'
		};
		
		const deviceActionType = actionTypeMap[action] || action;
		
		// Build action message for device
		const actionMessage = MessageFactory.createSystemMessage(
			'device:actionRequest',
			`subscription:device:${deviceId}`,
			{
				action: deviceActionType,
				logId: actionLog.id,
				...data
			},
			SystemUser,
			{ echoToSender: false }
		);
		
		// Send action to device
		await publisher.publish(actionMessage);
		
		// Set timeout for action
		const timeout = TimeoutConfig.DEVICE_ACTION;
		setTimeout(async () => {
			try {
				const log = await prisma.deviceActionLog.findUnique({
					where: { id: actionLog.id }
				});
				
				if (log && log.status === 'pending') {
					await ActionLogger.finalize(actionLog.id, 'timeout', 'Action timed out');
				}
			} catch (err) {
				logger.error(`[Device Actions v2] Timeout check error: ${err}`);
			}
		}, timeout);
		
		return successResponse(
			{
				actionId: actionLog.id,
				action,
				status: 'pending',
				deviceId,
				message: `Action ${action} sent to device`
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.control' }
);

