import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';

/**
 * GET /api/v2/device-profiles/[id]/assignments
 * Get all assignments for a device profile
 */
export const GET = unifiedEndpoint(async ({ context, params }) => {
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

	// Get all assignments for this profile
	const assignments = await prisma.deviceProfileAssignment.findMany({
		where: {
			profileId: profileId
		},
		include: {
			device: {
				select: {
					id: true,
					name: true,
					status: true,
					serialNumber: true
				}
			},
			assignedByUser: {
				select: {
					id: true,
					name: true,
					email: true
				}
			}
		},
		orderBy: {
			createdAt: 'desc'
		}
	});

	return successResponse(
		{
			profileId,
			assignments,
			total: assignments.length
		},
		{ requestId: context.requestId }
	);
});

