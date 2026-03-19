import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/v2/resources/packages/all
 * Fetch all unique package names from Resource table
 * Returns both home_launcher and kiosk_app packages in a single response
 * Query parameters:
 * - accountId: Optional account ID to filter by account (defaults to user's account)
 * - formats: Optional comma-separated list (e.g. deb,exe,apk) to filter by format; used for Kiosk Application
 */
export const GET = unifiedEndpoint(async ({ context, event }) => {
	const { session, account, prisma, isAdmin } = context;
	const { url } = event;
	const searchParams = url.searchParams;
	const accountId = searchParams.get('accountId');
	const formatsParam = searchParams.get('formats'); // e.g. "deb,exe,apk" for kiosk apps only

	// Parse formats filter (deb, exe, apk for Kiosk Application)
	let allowedFormats: string[] | null = null;
	if (formatsParam?.trim()) {
		allowedFormats = formatsParam
			.split(',')
			.map((f) => f.trim().toLowerCase())
			.filter(Boolean);
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

	// Fetch all unique package names from Resource table
	type ResourceWithPackage = Prisma.ResourceGetPayload<{
		select: {
			packageName: true;
			name: true;
			description: true;
			type: true;
			format: true;
		};
	}>;

	const resources = (await prisma.resource.findMany({
		where: {
			// Only filter by accountId if it's provided
			...(targetAccountId && { accountId: targetAccountId }),
			packageName: { not: null }
		},
		select: {
			packageName: true,
			name: true,
			description: true,
			type: true,
			format: true
		},
		distinct: ['packageName'],
		orderBy: { packageName: 'asc' }
	})) as ResourceWithPackage[];

	// Transform data for frontend
	let allPackages = resources
		.filter((resource) => resource.packageName)
		.map((resource) => ({
			packageName: resource.packageName!,
			displayName: resource.name,
			description: resource.description,
			type: resource.type,
			format: resource.format
		}));

	// Filter by format when formats param is provided (e.g. deb,exe,apk for Kiosk Application)
	if (allowedFormats && allowedFormats.length > 0) {
		allPackages = allPackages.filter((p) => {
			const fmt = (p.format || '').toLowerCase();
			return allowedFormats!.some((f) => fmt === f || fmt.endsWith('.' + f));
		});
	}

	return successResponse(
		{
			packages: allPackages,
			counts: {
				total: allPackages.length
			}
		},
		{
			requestId: context.requestId,
			message: `Found ${allPackages.length} unique packages`
		}
	);
});

