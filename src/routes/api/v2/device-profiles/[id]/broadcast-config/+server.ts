import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';
import type { Prisma } from '@prisma/client';

/**
 * POST /api/v2/device-profiles/[id]/broadcast-config
 * Broadcast profile configuration to all assigned devices
 */
export const POST = unifiedEndpoint(async ({ context, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: profileId } = params;

	// Verify device profile exists and load settings
	type DeviceProfileWithSettings = Prisma.DeviceProfileGetPayload<{
		select: {
			id: true;
			name: true;
			accountId: true;
			assignments: true;
			settings: {
				select: {
					id: true;
					key: true;
					value: true;
					dataType: true;
					category: true;
				};
			};
		};
	}>;

	const deviceProfile = (await prisma.deviceProfile.findUnique({
		where: { id: profileId },
		select: {
			id: true,
			name: true,
			accountId: true,
			assignments: true,
			settings: {
				select: {
					id: true,
					key: true,
					value: true,
					dataType: true,
					category: true
				}
			}
		}
	})) as DeviceProfileWithSettings | null;

	if (!deviceProfile) {
		throw Object.assign(
			new Error('Device profile not found'),
			{ status: 404, code: 'DEVICE_PROFILE_NOT_FOUND' }
		);
	}

	// Check if user has access to this device profile
	if (!isAdmin) {
		const hasAccess = await prisma.accountMembership.findFirst({
			where: {
				accountId: deviceProfile.accountId,
				userId: session.user.id
			}
		});

		if (!hasAccess) {
			throw Object.assign(
				new Error('Access denied to this device profile'),
				{ status: 403, code: ErrorCodes.FORBIDDEN }
			);
		}
	}

	// Get all assigned devices
	const deviceIds = deviceProfile.assignments.map((a: any) => a.deviceId);

	if (deviceIds.length === 0) {
		return successResponse(
			{
				profileId,
				message: 'No devices assigned to this profile',
				broadcastedCount: 0
			},
			{ requestId: context.requestId }
		);
	}

	// Prepare config payload
	const configPayload = mapToConfigPayload(deviceProfile as any);

	// Broadcast config to all assigned devices
	await Promise.all(
		deviceIds.map(async (deviceId: string) => {
			try {
				// Log the action
				await ActionLogger.createInitiated({
					deviceId,
					actionType: 'config_update',
					initiatedBy: session.user.id,
					requestId: context.requestId,
					metadata: {
						profileId,
						profileName: deviceProfile.name,
						settingsCount: deviceProfile.settings.length
					}
				});

				// Send message to device
				const message = MessageFactory.createSystemMessage(
					'device:configUpdate',
					`subscription:device:${deviceId}`,
					{
						config: configPayload,
						profileId,
						profileName: deviceProfile.name
					},
					SystemUser,
					{ echoToSender: false }
				);

				await publisher.publish(message);

				logger.info(`Broadcasted config to device ${deviceId}`, {
					deviceId,
					profileId
				});
			} catch (error) {
				logger.error(`Failed to broadcast config to device ${deviceId}:`, error);
			}
		})
	);

	return successResponse(
		{
			profileId,
			broadcastedCount: deviceIds.length,
			deviceIds,
			message: `Configuration broadcasted to ${deviceIds.length} device(s)`
		},
		{ requestId: context.requestId }
	);
});

