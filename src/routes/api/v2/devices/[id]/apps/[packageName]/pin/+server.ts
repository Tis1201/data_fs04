/**
 * POST /api/v2/devices/[id]/apps/[packageName]/pin - Pin app on device (manual pin)
 * DELETE /api/v2/devices/[id]/apps/[packageName]/pin - Unpin app on device
 *
 * Uses a user_custom PinRule scoped to this device (targetType: devices, targetValue: [deviceId]).
 * Business flow: PinRule update → UserAppAction (audit) → ActionLog → queue device command → broadcast pins_updated.
 */
import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { queueNotification } from '$lib/server/mqtt/core/queue';
import { DeviceNotificationType } from '$lib/server/mqtt/core/publish';
import { broadcastDeviceActionUpdate } from '$lib/server/mqtt/handlers/notifications/device_action_broadcaster';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import * as crypto from 'node:crypto';

const MANUAL_PIN_RULE_NAME = 'Manual pins';
const PIN_ACTION_TIMEOUT_MS = 60_000;

export const POST = unifiedEndpoint(
	async ({ context, params }) => {
		const { prisma, session } = context;
		const deviceId = params.id;
		const packageName = decodeURIComponent(params.packageName);

		if (!packageName || packageName === '') {
			throw Object.assign(new Error('Invalid package name'), {
				status: 400,
				code: ErrorCodes.INVALID_INPUT
			});
		}

		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: { id: true, accountId: true, createdBy: true }
		});

		if (!device) {
			throw Object.assign(new Error('Device not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		requireResourceAccess(context, {
			accountId: device.accountId ?? undefined,
			createdBy: device.createdBy
		});

		// Find user_custom rule that targets only this device (manual pins per device)
		const rules = await prisma.pinRule.findMany({
			where: {
				ruleType: 'user_custom',
				createdBy: session.user.id,
				accountId: device.accountId,
				targetType: 'devices',
				isActive: true
			}
		});
		let rule = rules.find(
			(r) => Array.isArray(r.targetValue) && r.targetValue.length === 1 && r.targetValue[0] === deviceId
		) ?? null;

		if (!rule) {
			rule = await prisma.pinRule.create({
				data: {
					ruleType: 'user_custom',
					createdBy: session.user.id,
					accountId: device.accountId,
					name: MANUAL_PIN_RULE_NAME,
					description: 'Apps pinned from device detail',
					apps: [packageName],
					targetType: 'devices',
					targetValue: [deviceId],
					priority: 1,
					isActive: true
				}
			});
			logger.debug('[PinAPI] Created manual pin rule', { deviceId, ruleId: rule.id });
		} else {
			const apps = Array.isArray(rule.apps) ? [...rule.apps] : [];
			if (apps.includes(packageName)) {
				return successResponse({ pinned: true, message: 'Already pinned' }, { requestId: context.requestId });
			}
			await prisma.pinRule.update({
				where: { id: rule.id },
				data: { apps: [...apps, packageName], updatedAt: new Date() }
			});
		}

		// Audit: record UserAppAction
		await prisma.userAppAction.create({
			data: {
				userId: session.user.id,
				deviceId,
				action: 'pin',
				packageName,
				ruleId: rule.id
			}
		});

		const requestId = crypto.randomUUID();
		const created = await ActionLogger.createInitiated({
			deviceId,
			actionType: 'pin_apps',
			initiatedBy: session.user.id,
			requestId,
			connectionId: 'api',
			protocol: 'api',
			metadata: { apps: [packageName], ruleId: rule.id },
			initialMessage: `Pin app ${packageName}`
		});

		try {
			if (device.accountId) {
				await broadcastDeviceActionUpdate({
					prisma,
					deviceId,
					logId: created.id,
					action: 'pin_apps',
					status: 'initiated',
					message: 'Pin apps initiated',
					accountId: device.accountId
				});
			}
		} catch (broadcastErr) {
			logger.warn('[PinAPI] Failed to broadcast initial status:', broadcastErr);
		}

		const userAccountId = device.accountId ?? null;
		const flowId = crypto.randomUUID();
		await queueNotification({
			sub: `user:${session.user.id}:${userAccountId || 'system'}`,
			recipient: `device:${deviceId}`,
			type: DeviceNotificationType.ActionRequest,
			flowId,
			params: {
				action: 'pin_apps',
				deviceId,
				logId: created.id,
				requestId,
				apps: [packageName],
				ruleId: rule.id
			},
			expiresIn: '30m'
		});

		setTimeout(async () => {
			try {
				const current = await prisma.deviceActionLog.findUnique({
					where: { id: created.id },
					select: { status: true }
				});
				if (current && (current.status === 'initiated' || current.status === 'in_progress')) {
					await ActionLogger.finalize(created.id, 'failed', 'pin_apps timed out');
				}
			} catch (e) {
				logger.warn('[PinAPI] Timeout finalize error:', e);
			}
		}, PIN_ACTION_TIMEOUT_MS);

		try {
			await publisher.publish(
				MessageFactory.createSystemMessage(
					'pins_updated',
					`subscription:device:${deviceId}`,
					{ deviceId },
					SystemUser
				)
			);
			if (device.accountId) {
				await publisher.publish(
					MessageFactory.createSystemMessage(
						'pins_updated',
						`subscription:account:${device.accountId}`,
						{ deviceId },
						SystemUser
					)
				);
			}
		} catch (e) {
			logger.warn('[PinAPI] Failed to broadcast pins_updated:', e);
		}

		logger.info('[PinAPI] App pinned', { deviceId, packageName, userId: session.user.id });
		return successResponse({ pinned: true, message: 'App pinned' }, { requestId: context.requestId });
	},
	{ skipPermission: true }
);

export const DELETE = unifiedEndpoint(
	async ({ context, params }) => {
		const { prisma, session } = context;
		const deviceId = params.id;
		const packageName = decodeURIComponent(params.packageName);

		if (!packageName || packageName === '') {
			throw Object.assign(new Error('Invalid package name'), {
				status: 400,
				code: ErrorCodes.INVALID_INPUT
			});
		}

		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: { id: true, accountId: true, createdBy: true }
		});

		if (!device) {
			throw Object.assign(new Error('Device not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		requireResourceAccess(context, {
			accountId: device.accountId ?? undefined,
			createdBy: device.createdBy
		});

		const rules = await prisma.pinRule.findMany({
			where: {
				ruleType: 'user_custom',
				createdBy: session.user.id,
				accountId: device.accountId,
				targetType: 'devices',
				isActive: true
			}
		});

		const rule = rules.find(
			(r) => Array.isArray(r.targetValue) && r.targetValue.length === 1 && r.targetValue[0] === deviceId
		);
		if (!rule) {
			return successResponse({ pinned: false, message: 'Not pinned' }, { requestId: context.requestId });
		}

		const apps = Array.isArray(rule.apps) ? rule.apps.filter((p) => p !== packageName) : [];
		if (apps.length === rule.apps.length) {
			return successResponse({ pinned: false, message: 'Not pinned' }, { requestId: context.requestId });
		}

		if (apps.length === 0) {
			await prisma.pinRule.delete({ where: { id: rule.id } });
		} else {
			await prisma.pinRule.update({
				where: { id: rule.id },
				data: { apps, updatedAt: new Date() }
			});
		}

		// Audit: record UserAppAction (unpin)
		await prisma.userAppAction.create({
			data: {
				userId: session.user.id,
				deviceId,
				action: 'unpin',
				packageName,
				ruleId: null
			}
		});

		const requestId = crypto.randomUUID();
		const created = await ActionLogger.createInitiated({
			deviceId,
			actionType: 'unpin_app',
			initiatedBy: session.user.id,
			requestId,
			connectionId: 'api',
			protocol: 'api',
			metadata: { packageName },
			initialMessage: `Unpin app ${packageName}`
		});

		try {
			if (device.accountId) {
				await broadcastDeviceActionUpdate({
					prisma,
					deviceId,
					logId: created.id,
					action: 'unpin_app',
					status: 'initiated',
					message: 'Unpin app initiated',
					accountId: device.accountId
				});
			}
		} catch (broadcastErr) {
			logger.warn('[PinAPI] Failed to broadcast initial status (unpin):', broadcastErr);
		}

		const userAccountId = device.accountId ?? null;
		const flowId = crypto.randomUUID();
		await queueNotification({
			sub: `user:${session.user.id}:${userAccountId || 'system'}`,
			recipient: `device:${deviceId}`,
			type: DeviceNotificationType.ActionRequest,
			flowId,
			params: {
				action: 'unpin_app',
				deviceId,
				logId: created.id,
				requestId,
				packageName
			},
			expiresIn: '30m'
		});

		setTimeout(async () => {
			try {
				const current = await prisma.deviceActionLog.findUnique({
					where: { id: created.id },
					select: { status: true }
				});
				if (current && (current.status === 'initiated' || current.status === 'in_progress')) {
					await ActionLogger.finalize(created.id, 'failed', 'unpin_app timed out');
				}
			} catch (e) {
				logger.warn('[PinAPI] Timeout finalize error (unpin):', e);
			}
		}, PIN_ACTION_TIMEOUT_MS);

		try {
			await publisher.publish(
				MessageFactory.createSystemMessage(
					'pins_updated',
					`subscription:device:${deviceId}`,
					{ deviceId },
					SystemUser
				)
			);
			if (device.accountId) {
				await publisher.publish(
					MessageFactory.createSystemMessage(
						'pins_updated',
						`subscription:account:${device.accountId}`,
						{ deviceId },
						SystemUser
					)
				);
			}
		} catch (e) {
			logger.warn('[PinAPI] Failed to broadcast pins_updated (unpin):', e);
		}

		logger.info('[PinAPI] App unpinned', { deviceId, packageName, userId: session.user.id });
		return successResponse({ pinned: false, message: 'App unpinned' }, { requestId: context.requestId });
	},
	{ skipPermission: true }
);
