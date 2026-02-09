import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';

/**
 * GET /api/v2/device-profiles/[id]/assigned-device-tags
 * Returns tags that belong to devices currently assigned to this profile.
 * Used by Unassign by tag to show only relevant tags.
 */
export const GET = unifiedEndpoint(async ({ context, params }) => {
	const { prisma, isAdmin } = context;
	const { id: profileId } = params;

	const deviceProfile = await prisma.deviceProfile.findUnique({
		where: { id: profileId },
		select: { id: true, accountId: true }
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
				userId: context.session.user.id
			}
		});
		if (!hasAccess) {
			throw Object.assign(
				new Error('Access denied to this device profile'),
				{ status: 403, code: ErrorCodes.FORBIDDEN }
			);
		}
	}

	const devicesWithTags = await prisma.device.findMany({
		where: {
			profileAssignment: { profileId }
		},
		select: {
			tags: {
				select: { id: true, name: true }
			}
		}
	});

	const tagMap = new Map<string, { id: string; name: string }>();
	for (const d of devicesWithTags) {
		for (const t of d.tags) {
			tagMap.set(t.id, { id: t.id, name: t.name });
		}
	}
	const tags = Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));

	return successResponse(
		{ tags },
		{ requestId: context.requestId }
	);
});
