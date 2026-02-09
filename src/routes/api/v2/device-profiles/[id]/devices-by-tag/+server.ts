import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';

/**
 * GET /api/v2/device-profiles/[id]/devices-by-tag
 * Get devices that match profile's target tags
 */
export const GET = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: profileId } = params;
	const { url } = event;
	const tagIds = url.searchParams.getAll('tagId');

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

	// Find devices with the specified tags (Device.tags -> DeviceTag[])
	const devices = await prisma.device.findMany({
		where: {
			...(tagIds.length > 0 && {
				tags: {
					some: {
						id: { in: tagIds }
					}
				}
			}),
			...(deviceProfile.accountId && { accountId: deviceProfile.accountId })
		},
		include: {
			tags: {
				select: {
					id: true,
					name: true
				}
			},
			profileAssignment: {
				select: {
					profileId: true,
					status: true
				}
			}
		},
		orderBy: {
			name: 'asc'
		}
	});

	return successResponse(
		{
			profileId,
			tagIds,
			devices,
			total: devices.length
		},
		{ requestId: context.requestId }
	);
});

