/**
 * Unified Device Tags API (v2)
 * 
 * This endpoint manages device tags.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * GET /api/v2/devices/tags
 * List all device tags
 * 
 * - Admin: sees all tags
 * - User: sees only tags in their account
 */
export const GET = unifiedEndpoint(
	async ({ context }) => {
		// Determine account scope
		let where: Record<string, any> = {};
		let accountIds: string[] = [];

		if (context.isAdmin) {
			// Admin sees all tags regardless of current account
			where = {};
		} else if (context.accountId) {
			accountIds = [context.accountId];
			where = { accountId: { in: accountIds } };
		} else {
			const memberships = await context.prisma.accountMembership.findMany({
				where: { userId: context.session.user.id },
				select: { accountId: true }
			});
			accountIds = memberships.map((m: { accountId: string }) => m.accountId).filter(Boolean);
			if (accountIds.length === 0) {
				return successResponse([], { requestId: context.requestId });
			}
			where = { accountId: { in: accountIds } };
		}

		logger.info('[DeviceTags][GET] resolved scope', {
			accountIds,
			isAdmin: context.isAdmin,
			userId: context.session.user.id,
			where,
			requestId: context.requestId
		});
		
		const tags = await context.prisma.deviceTag.findMany({
			where,
			select: {
				id: true,
				name: true,
				description: true,
				accountId: true
			},
			orderBy: {
				name: 'asc'
			}
		});
		
		// Add a default color for each tag since the model doesn't have a color field
		const tagsWithColor = tags.map((tag: typeof tags[number]) => ({
			...tag,
			color: '#6b7280' // Default gray color
		}));
		
		return successResponse(
			tagsWithColor,
			{ requestId: context.requestId }
		);
	},
	// No explicit permission check; access is constrained via account scoping above
);

/**
 * POST /api/v2/devices/tags
 * Create a new device tag
 * 
 * Request body:
 * {
 *   "name": "Production",
 *   "description": "Production devices"
 * }
 */
export const POST = unifiedEndpoint(
	async ({ context, event }) => {
		const data = await event.request.json();
		const { TAG_NAME_MAX } = await import('../../../../user/iot/device_tags/new/device-tag');

		if (!data.name) {
			throw Object.assign(
				new Error('Tag name is required'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		if (typeof data.name === 'string' && data.name.length > TAG_NAME_MAX) {
			throw Object.assign(
				new Error(`Tag name must be at most ${TAG_NAME_MAX} characters`),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		// Resolve accountId (use current account, or first membership)
		let accountId = context.accountId;
		if (!accountId) {
			const membership = await context.prisma.accountMembership.findFirst({
				where: { userId: context.session.user.id },
				select: { accountId: true }
			});
			accountId = membership?.accountId;
		}

		if (!accountId) {
			throw Object.assign(
				new Error('No account scope available for creating tags'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}

		// Check for duplicate name in the same account (case-insensitive; tag names are unique per account)
		const existing = await context.prisma.deviceTag.findFirst({
			where: {
				accountId,
				name: { equals: data.name, mode: 'insensitive' }
			}
		});

		if (existing) {
			throw Object.assign(
				new Error('A tag with this name already exists'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		
		const tag = await context.prisma.deviceTag.create({
			data: {
				name: data.name,
				description: data.description || null,
				accountId
			}
		});
		
		return successResponse(
			{
				...tag,
				color: '#6b7280'
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.edit' }
);

