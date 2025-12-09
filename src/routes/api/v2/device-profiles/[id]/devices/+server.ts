import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { areDevicesOnline } from '$lib/server/device/devicePresence';

/**
 * GET /api/v2/device-profiles/[id]/devices
 *
 * Supports:
 * - status=assigned | available (default: assigned)
 * - search: filter by device name/description/id
 * - tagId: filter available devices by tag
 * - limit, offset for pagination (limit default 10, max 100)
 *
 * Admin: can access any profile
 * User: must belong to the profile's account
 */
export const GET = unifiedEndpoint(async ({ context, event, params }) => {
	const profileId = params.id;
	if (!profileId) {
		return { success: false, error: { code: 'BAD_REQUEST', message: 'Profile id is required' } };
	}

	const url = event.url;
	const status = (url.searchParams.get('status') || 'assigned').toLowerCase();
	const search = (url.searchParams.get('search') || '').trim();
	const tagId = url.searchParams.get('tagId');
	const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '10')));
	const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));

	// Fetch profile and enforce access
	const profile = await context.prisma.deviceProfile.findUnique({
		where: { id: profileId },
		select: { id: true, accountId: true, level: true }
	});

	if (!profile) {
		return { success: false, error: { code: 'NOT_FOUND', message: 'Device profile not found' } };
	}

	const isAdmin = context.session.user.systemRole === 'ADMIN';
	if (!isAdmin) {
		const currentAccountId = context.account?.id;
		if (!currentAccountId || currentAccountId !== profile.accountId) {
			return { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this profile' } };
		}
	}

	// Base where clause on Device (mirror legacy behavior)
	const where: any = {
		status: 'ACTIVE'
	};

	// Account scoping (legacy: admin unrestricted; user -> all memberships)
	if (!isAdmin) {
		let accountIds: string[] = [];
		if (context.account?.id) {
			accountIds = [context.account.id];
		} else {
			const memberships = await context.prisma.accountMembership.findMany({
				where: { userId: context.session.user.id },
				select: { accountId: true }
			});
			accountIds = memberships.map((m: { accountId: string }) => m.accountId).filter(Boolean);
		}

		if (accountIds.length === 0) {
			return {
				success: true,
				data: {
					devices: [],
					total: 0,
					pagination: { limit, offset, page: 1, totalPages: 1, totalCount: 0 }
				}
			};
		}

		where.accountId = { in: accountIds };
	}

	// Search filter
	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ description: { contains: search, mode: 'insensitive' } },
			{ id: { contains: search, mode: 'insensitive' } },
			{ macAddress: { contains: search, mode: 'insensitive' } },
			{ deviceType: { contains: search, mode: 'insensitive' } }
		];
	}

	// Tag filter (available path only)
	if (tagId) {
		where.tags = { some: { id: tagId } };
	}

	// Device type filter (parity with legacy)
	const deviceType = url.searchParams.get('deviceType');
	if (deviceType && deviceType !== 'all') {
		where.deviceType = deviceType;
	}

	if (status === 'assigned') {
		// For GLOBAL profiles include devices assigned directly to this profile
		// OR devices assigned to DEVICE-level profiles in the same account
		if (profile.level === 'GLOBAL') {
			where.AND = [
				...(where.AND || []),
				{
					OR: [
						{
							profileAssignment: {
								profileId
							}
						},
						{
							profileAssignment: {
								profile: {
									level: 'DEVICE',
									accountId: profile.accountId
								}
							}
						}
					]
				}
			];
		} else {
			// Device-level profile: direct assignments only
			where.profileAssignment = { profileId };
		}
	} else {
		// Available devices: no assignment
		where.profileAssignment = null;
	}

	const [devices, total] = await Promise.all([
		context.prisma.device.findMany({
			where,
			orderBy: status === 'assigned' ? [{ createdAt: 'desc' }] : [{ name: 'asc' }, { id: 'asc' }],
			skip: offset,
			take: limit,
			select: {
				id: true,
				name: true,
				status: true,
				model: true,
				description: true,
				connected: true,
				createdAt: true,
				updatedAt: true,
				profileAssignment: {
					select: {
						profileId: true,
						status: true,
						assignedAt: true,
						appliedAt: true,
						lastSyncAt: true,
						profile: {
							select: { id: true, name: true, level: true, accountId: true }
						}
					}
				}
			}
		}),
		context.prisma.device.count({ where })
	]);

	// Override connected with Redis presence
	const presenceMap = await areDevicesOnline(devices.map((d: typeof devices[number]) => d.id));
	const devicesWithPresence = devices.map((d: typeof devices[number]) => ({
		...d,
		connected: presenceMap.get(d.id) ?? false
	}));

	return {
		success: true,
		data: {
			devices: devicesWithPresence,
			total,
			pagination: {
				limit,
				offset,
				page: Math.floor(offset / limit) + 1,
				totalPages: Math.max(1, Math.ceil(total / limit)),
				totalCount: total
			}
		}
	};
});

