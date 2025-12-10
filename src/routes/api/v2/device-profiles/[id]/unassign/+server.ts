import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/device-profiles/[id]/unassign
 * Unassign a device profile from specific devices
 */
export const POST = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: profileId } = params;
	const body = await event.request.json();
	const { deviceIds } = body;

	if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
		throw Object.assign(new Error('Device IDs array is required'), { status: 400 });
	}

	// Verify device profile exists
	const deviceProfile = await prisma.deviceProfile.findUnique({
		where: { id: profileId },
		select: {
			id: true,
			name: true,
			accountId: true
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

	// Delete assignments for specified devices
	const result = await prisma.deviceProfileAssignment.deleteMany({
		where: {
			deviceId: { in: deviceIds },
			profileId: profileId
		}
	});

	logger.info(`Unassigned profile from ${result.count} devices`, {
		profileId,
		deviceCount: result.count,
		deviceIds,
		userId: session.user.id
	});

	return successResponse(
		{
			profileId,
			unassignedCount: result.count,
			deviceIds,
			message: `Successfully unassigned from ${result.count} device(s)`
		},
		{ requestId: context.requestId }
	);
});

