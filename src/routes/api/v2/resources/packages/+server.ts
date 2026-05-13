import { unifiedEndpoint, whereNotPublicDeveloperCatalog } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/v2/resources/packages
 * Fetch unique package names from Resource table
 * Query parameters:
 * - type: "home_launcher" or "kiosk_app" to filter by resource type
 * - accountId: Optional account ID to filter by account (defaults to user's account)
 */
export const GET = unifiedEndpoint(async ({ context, event }) => {
	const { session, account, prisma, isAdmin } = context;
	const { url } = event;
	const searchParams = url.searchParams;
	const type = searchParams.get('type');
	const accountId = searchParams.get('accountId');

	// Validate type parameter
	if (!type || !['home_launcher', 'kiosk_app'].includes(type)) {
		throw Object.assign(
			new Error('Invalid or missing type parameter. Must be "home_launcher" or "kiosk_app"'),
			{ status: 400, code: 'INVALID_TYPE' }
		);
	}

	// Determine target account ID based on role and parameters
	let targetAccountId: string | null = accountId ?? null;

	if (isAdmin) {
		// Admin can access any account, or all accounts if none specified
		targetAccountId = accountId || null;
	} else {
		// Regular users need to use their account
		if (!targetAccountId) {
			targetAccountId = account?.id ?? null;

			if (!targetAccountId) {
				throw Object.assign(
					new Error('User has no account association'),
					{ status: 400, code: 'NO_ACCOUNT' }
				);
			}
		} else {
			// Check if user has access to the specified account
			const hasAccess = await prisma.accountMembership.findFirst({
				where: {
					accountId: targetAccountId,
					userId: session.user.id
				}
			});

			if (!hasAccess) {
				throw Object.assign(
					new Error('Access denied to specified account'),
					{ status: 403, code: ErrorCodes.FORBIDDEN }
				);
			}
		}
	}

	// Build type filter
	let typeFilter = {};
	if (type === 'home_launcher') {
		typeFilter = {
			OR: [
				{ type: 'binary' },
				{ format: 'apk' },
				{ name: { contains: 'launcher', mode: 'insensitive' as const } }
			]
		};
	} else if (type === 'kiosk_app') {
		typeFilter = {
			OR: [
				{ type: 'binary' },
				{ format: 'apk' },
				{ name: { contains: 'kiosk', mode: 'insensitive' as const } }
			]
		};
	}

	// Fetch unique package names from Resource table
	type ResourceWithPackage = Prisma.ResourceGetPayload<{
		select: { packageName: true; name: true; description: true };
	}>;

	const resources = (await prisma.resource.findMany({
		where: {
			// Only filter by accountId if it's provided
			...(targetAccountId && { accountId: targetAccountId }),
			packageName: { not: null },
			...typeFilter,
			...whereNotPublicDeveloperCatalog
		},
		select: {
			packageName: true,
			name: true,
			description: true
		},
		distinct: ['packageName'],
		orderBy: { packageName: 'asc' }
	})) as ResourceWithPackage[];

	// Transform data for frontend
	const packages = resources
		.filter((resource) => resource.packageName)
		.map((resource) => ({
			packageName: resource.packageName!,
			displayName: resource.name,
			description: resource.description
		}));

	return successResponse(
		{
			packages,
			total: packages.length,
			type
		},
		{
			requestId: context.requestId,
			message: `Found ${packages.length} unique ${type} packages`
		}
	);
});
