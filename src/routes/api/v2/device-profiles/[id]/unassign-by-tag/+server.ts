import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/device-profiles/[id]/unassign-by-tag
 * Unassign this profile from all devices that have any of the given tags.
 */
export const POST = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: profileId } = params;
	const body = await event.request.json();
	const { tagIds } = body;

	if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
		throw Object.assign(new Error('Tag IDs array is required'), { status: 400 });
	}

	const deviceProfile = await prisma.deviceProfile.findUnique({
		where: { id: profileId },
		select: { id: true, name: true, accountId: true }
	});

	if (!deviceProfile) {
		throw Object.assign(
			new Error('Device profile not found'),
			{ status: 404, code: 'DEVICE_PROFILE_NOT_FOUND' }
		);
	}

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

	// Assignments for this profile where the device has any of the tags
	const assignments = await prisma.deviceProfileAssignment.findMany({
		where: {
			profileId,
			device: {
				tags: {
					some: { id: { in: tagIds } }
				}
			}
		}
	});

	if (assignments.length === 0) {
		return successResponse(
			{
				profileId,
				tagIds,
				unassignedCount: 0,
				message: 'No assigned devices found with the selected tags'
			},
			{ requestId: context.requestId }
		);
	}

	for (const a of assignments) {
		await logAudit({
			actionType: AuditActionType.DELETE,
			tableName: 'DeviceProfileAssignment',
			recordId: a.id,
			oldData: a,
			newData: null,
			userId: session.user.id,
			ipAddress: context.ipAddress,
			prisma
		});
	}

	const result = await prisma.deviceProfileAssignment.deleteMany({
		where: {
			profileId,
			device: {
				tags: {
					some: { id: { in: tagIds } }
				}
			}
		}
	});

	logger.info(`Unassigned profile from ${result.count} device(s) by tag`, {
		profileId,
		tagIds,
		userId: session.user.id
	});

	return successResponse(
		{
			profileId,
			tagIds,
			unassignedCount: result.count,
			deviceIds: assignments.map((a: { deviceId: string }) => a.deviceId),
			message: `Successfully unassigned from ${result.count} device(s)`
		},
		{ requestId: context.requestId }
	);
});
