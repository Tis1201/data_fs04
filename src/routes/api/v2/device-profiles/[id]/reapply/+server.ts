import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

// Validation schema for reapply request
const ReapplyRequestSchema = z.object({
	deviceIds: z.array(z.string()).min(1, 'At least one device ID is required')
});

/**
 * POST /api/v2/device-profiles/[id]/reapply
 * Reapply profile configuration to specific devices
 */
export const POST = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: profileId } = params;

	// Parse and validate request body
	const body = await event.request.json();
	const validatedData = ReapplyRequestSchema.parse(body);

	logger.info(`[Reapply Profile] Starting reapply for profile ${profileId}`, {
		profileId,
		deviceIds: validatedData.deviceIds,
		deviceCount: validatedData.deviceIds.length,
		userId: session.user.id
	});

	// Verify device profile exists and load settings
	const deviceProfile = await prisma.deviceProfile.findUnique({
		where: { id: profileId },
		select: {
			id: true,
			name: true,
			accountId: true,
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
	});

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

	// Verify devices exist and have the profile assigned
	type AssignmentWithDevice = Prisma.DeviceProfileAssignmentGetPayload<{
		include: {
			device: {
				select: {
					id: true;
					name: true;
					status: true;
				};
			};
		};
	}>;

	const assignments = (await prisma.deviceProfileAssignment.findMany({
		where: {
			deviceId: { in: validatedData.deviceIds },
			profileId: profileId
		},
		include: {
			device: {
				select: {
					id: true,
					name: true,
					status: true
				}
			}
		}
	})) as AssignmentWithDevice[];

	if (assignments.length === 0) {
		return successResponse(
			{
				profileId,
				reappliedCount: 0,
				message: 'No devices found with this profile assigned'
			},
			{ requestId: context.requestId }
		);
	}

	// Prepare config payload
	const configPayload = mapToConfigPayload(deviceProfile);

	// Reapply config to all specified devices
	const successfulDevices: string[] = [];
	const failedDevices: string[] = [];

	await Promise.all(
		assignments.map(async (assignment: AssignmentWithDevice) => {
			try {
				// Log the action
				await ActionLogger.createInitiated({
					deviceId: assignment.deviceId,
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
					`subscription:device:${assignment.deviceId}`,
					{
						config: configPayload,
						profileId,
						profileName: deviceProfile.name,
						isReapply: true
					},
					SystemUser,
					{ echoToSender: false }
				);

				await publisher.publish(message);

				successfulDevices.push(assignment.deviceId);

				logger.info(`Reapplied profile to device ${assignment.deviceId}`, {
					deviceId: assignment.deviceId,
					profileId
				});
			} catch (error) {
				failedDevices.push(assignment.deviceId);
				logger.error(`Failed to reapply profile to device ${assignment.deviceId}:`, error);
			}
		})
	);

	return successResponse(
		{
			profileId,
			reappliedCount: successfulDevices.length,
			failedCount: failedDevices.length,
			successfulDevices,
			failedDevices,
			message: `Profile reapplied to ${successfulDevices.length} device(s)`
		},
		{ requestId: context.requestId }
	);
});

