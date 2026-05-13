import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/device-profiles/[id]/assign-by-tag
 * Assign a device profile to devices with specific tags
 */
export const POST = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: profileId } = params;
	const body = await event.request.json();
	const { tagIds } = body;

	if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
		throw Object.assign(new Error('Tag IDs array is required'), { status: 400 });
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

	// Find devices with the specified tags that are either unassigned OR only have a DEVICE-level (private) config.
	// Exclude only devices already assigned to a GLOBAL profile.
	const devices = await prisma.device.findMany({
		where: {
			tags: {
				some: {
					id: { in: tagIds }
				}
			},
			...(deviceProfile.accountId && { accountId: deviceProfile.accountId }),
			OR: [
				{ profileAssignment: null },
				{ profileAssignment: { profile: { level: 'DEVICE' } } }
			]
		},
		select: {
			id: true
		}
	});

	if (devices.length === 0) {
		return successResponse(
			{
				profileId,
				tagIds,
				assignedCount: 0,
				message: 'No devices found with specified tags'
			},
			{ requestId: context.requestId }
		);
	}

	// Create assignments for all matching devices
	const assignments = devices.map((device: { id: string }) => ({
		deviceId: device.id,
		profileId: profileId,
		assignedBy: session.user.id,
		status: 'PENDING' as const
	}));

	const result = await prisma.deviceProfileAssignment.createMany({
		data: assignments,
		skipDuplicates: true
	});

	// Get created assignments for audit log
	const createdAssignments = await prisma.deviceProfileAssignment.findMany({
		where: {
			deviceId: { in: devices.map((d: { id: string }) => d.id) },
			profileId: profileId
		}
	});

	// Log audit for created assignments
	for (const assignment of createdAssignments) {
		await logAudit({
			actionType: AuditActionType.INSERT,
			tableName: 'DeviceProfileAssignment',
			recordId: assignment.id,
			oldData: null,
			newData: assignment,
			userId: session.user.id,
			ipAddress: context.ipAddress,
			prisma
		});
	}

	logger.info(`Created ${result.count} profile assignments by tag`, {
		profileId,
		tagIds,
		deviceCount: result.count,
		userId: session.user.id
	});

	// Call the assign endpoint to handle ActionLog creation and MQTT messaging
	const deviceIds = devices.map((d: { id: string }) => d.id);

	try {
		const assignResponse = await fetch(
			`${event.url.origin}/api/v2/device-profiles/${profileId}/assign`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					cookie: event.request.headers.get('cookie') || ''
				},
				body: JSON.stringify({ deviceIds })
			}
		);

		if (!assignResponse.ok) {
			const data = await assignResponse.json();
			logger.error('Error calling assign endpoint:', data);
		}
	} catch (error) {
		logger.error('Failed to call assign endpoint:', error);
	}

	return successResponse(
		{
			profileId,
			tagIds,
			assignedCount: devices.length,
			deviceIds,
			message: `Successfully assigned ${devices.length} device(s) by tag`
		},
		{ requestId: context.requestId }
	);
});

