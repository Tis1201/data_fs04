/**
 * Unified Device Profiles API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/device-profiles
 * - /api/user/iot/device-profiles
 * 
 * Works for both admin and user roles with appropriate permission checks.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { unifiedEndpoint, handlePaginatedList } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/device-profiles
 * List device profiles (paginated)
 * 
 * - Admin: sees all profiles
 * - User: sees only profiles in their account
 */
export const GET: RequestHandler = unifiedEndpoint(
	async ({ context, event }) => {
		return await handlePaginatedList(
			context,
			event,
			// Fetcher
			async (options) => {
				return await prisma.deviceProfile.findMany({
					...options,
					include: {
						account: options.include?.account || false,
						_count: {
							select: {
								deviceProfileAssignments: true
							}
						}
					},
					orderBy: {
						createdAt: 'desc'
					}
				});
			},
			// Counter
			async (options) => {
				return await prisma.deviceProfile.count({
					where: options.where
				});
			}
		);
	},
	{ permission: 'deviceProfile.view' }
);

/**
 * POST /api/v2/device-profiles
 * Create new device profile
 * 
 * - Admin: can create in any account
 * - User: can create in their account only
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ context, event }) => {
		const data = await event.request.json();

		// Validate account access
		const accountId = data.accountId || context.account?.id;
		
		if (!accountId) {
			throw Object.assign(
				new Error('Account ID is required'),
				{ status: 400, code: 'INVALID_INPUT' }
			);
		}

		// Non-admin users can only create in their account
		if (context.session.user.systemRole !== 'ADMIN' && accountId !== context.account?.id) {
			throw Object.assign(
				new Error('Cannot create profile in different account'),
				{ status: 403, code: 'FORBIDDEN' }
			);
		}

		const profile = await prisma.deviceProfile.create({
			data: {
				name: data.name,
				description: data.description,
				accountId,
				createdBy: context.session.user.id
			},
			include: {
				account: true
			}
		});

		return successResponse(profile, { requestId: context.requestId });
	},
	{ permission: 'deviceProfile.edit' }
);

