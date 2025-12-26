import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/device-profiles/[id]/unassign-all
 * Unassign a device profile from all devices
 */
export const POST = unifiedEndpoint(async ({ context, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: profileId } = params;

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

	// Get existing assignments for audit log before deletion
	const existingAssignments = await prisma.deviceProfileAssignment.findMany({
		where: {
			profileId: profileId
		}
	});

	// Delete all assignments for this profile
	const result = await prisma.deviceProfileAssignment.deleteMany({
		where: {
			profileId: profileId
		}
	});

	// Log audit for deleted assignments
	for (const assignment of existingAssignments) {
		await logAudit({
			actionType: AuditActionType.DELETE,
			tableName: 'DeviceProfileAssignment',
			recordId: assignment.id,
			oldData: assignment,
			newData: null,
			userId: session.user.id,
			ipAddress: context.ipAddress,
			prisma
		});
	}

	logger.info(`Unassigned profile from all devices`, {
		profileId,
		deviceCount: result.count,
		userId: session.user.id
	});

	return successResponse(
		{
			profileId,
			unassignedCount: result.count,
			message: `Successfully unassigned from ${result.count} device(s)`
		},
		{ requestId: context.requestId }
	);
});

