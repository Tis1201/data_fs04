import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/device-profiles/[id]/assign-all
 * Assign a device profile to all available devices
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

	// Get devices that are not already assigned
	const devices = await prisma.device.findMany({
		where: {
			id: { in: deviceIds },
			profileAssignment: null
		},
		select: {
			id: true
		}
	});

	if (devices.length === 0) {
		return successResponse(
			{
				profileId,
				assignedCount: 0,
				message: 'No available devices to assign'
			},
			{ requestId: context.requestId }
		);
	}

	// Create assignments for all available devices
	const assignments = devices.map((device: any) => ({
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
			deviceId: { in: devices.map((d: any) => d.id) },
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

	logger.info(`Created ${result.count} profile assignments for assign-all`, {
		profileId,
		deviceCount: result.count,
		userId: session.user.id
	});

	// Call the assign endpoint to handle ActionLog creation and MQTT messaging
	const deviceIdsToAssign = devices.map((d: any) => d.id);

	// Create internal request to assign endpoint
	try {
		const assignResponse = await fetch(
			`${event.url.origin}/api/v2/device-profiles/${profileId}/assign`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					cookie: event.request.headers.get('cookie') || ''
				},
				body: JSON.stringify({ deviceIds: deviceIdsToAssign })
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
			assignedCount: result.count,
			deviceIds: deviceIdsToAssign,
			message: `Successfully assigned ${result.count} device(s)`
		},
		{ requestId: context.requestId }
	);
});

