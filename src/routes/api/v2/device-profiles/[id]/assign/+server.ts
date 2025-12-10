import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { DeviceProfileService } from '$lib/server/device/profile';

/**
 * POST /api/v2/device-profiles/[id]/assign
 * Assign a device profile to specific devices
 */
export const POST = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, account, prisma, isAdmin } = context;
	const { id: profileId } = params;
	const body = await event.request.json();

	const { deviceIds } = body;

	if (!deviceIds || !Array.isArray(deviceIds)) {
		throw Object.assign(new Error('deviceIds array is required'), { status: 400 });
	}

	// Verify device profile exists
	const deviceProfile = await prisma.deviceProfile.findUnique({
		where: { id: profileId },
		select: {
			id: true,
			name: true,
			description: true,
			accountId: true,
			settings: {
				select: {
					id: true,
					key: true,
					value: true,
					dataType: true,
					category: true,
					label: true,
					order: true
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

	// Use the DeviceProfileService to assign profiles
	const profileService = new DeviceProfileService(prisma);

	await Promise.all(
		deviceIds.map(async (deviceId: string) => {
			try {
				// 1. Assign profile to device
				const assignmentResult = await profileService.assignProfile(
					deviceId,
					profileId,
					session.user.id
				);

				if (!assignmentResult.success) {
					logger.error(`Failed to assign profile to device ${deviceId}`, {
						error: assignmentResult.error,
						deviceId,
						profileId
					});
					return;
				}

				// 2. Update assignment status to APPLYING
				await prisma.deviceProfileAssignment.update({
					where: { deviceId: deviceId },
					data: { status: 'APPLYING' }
				});

				// 3. Get the global profile with settings for sending config
				const globalProfile = await prisma.deviceProfile.findUnique({
					where: { id: profileId },
					include: {
						settings: {
							orderBy: { order: 'asc' }
						}
					}
				});

				if (!globalProfile) {
					logger.error(`Profile ${profileId} not found when sending config to device ${deviceId}`);
					return;
				}

				// 4. Send config to device using ProfileMessagingService
				const { ProfileMessagingService, ProfileConfigBuilder } = await import(
					'$lib/server/device/profile'
				);

				const configBuilder = new ProfileConfigBuilder(prisma);
				const messagingService = new ProfileMessagingService(prisma);

				const config = configBuilder.buildFromGlobal(globalProfile);

				await messagingService.sendConfigToDevice(deviceId, config, profileId, {
					userId: session.user.id
				});

				logger.info(`Profile assigned and config sent to device ${deviceId}`, {
					deviceId,
					profileId,
					assignmentId: assignmentResult.assignmentId
				});
			} catch (error) {
				logger.error(`Error assigning profile to device ${deviceId}:`, error as any);
				// Continue with other devices even if one fails
			}
		})
	);

	return successResponse(
		{
			profileId,
			deviceIds,
			count: deviceIds.length,
			message: `Broadcasting device profile settings to ${deviceIds.length} device(s)`
		},
		{ requestId: context.requestId, status: 202 }
	);
});

