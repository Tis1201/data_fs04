/**
 * Unified Bundles API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/bundles
 * - /api/user/bundles
 * 
 * Works for both admin and user roles with appropriate permission checks.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { unifiedEndpoint, handlePaginatedList } from '$lib/server/api/unifiedEndpoint';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/bundles
 * List bundles (paginated)
 * 
 * - Admin: sees all bundles
 * - User: sees only bundles in their account
 */
export const GET: RequestHandler = unifiedEndpoint(
	async ({ context, event }) => {
		return await handlePaginatedList(
			context,
			event,
			// Fetcher
			async (options) => {
				return await prisma.bundle.findMany({
					...options,
					include: {
						account: options.include?.account || false,
						_count: {
							select: {
								bundleDevices: true,
								bundleApps: true,
								bundleWaves: true
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
				return await prisma.bundle.count({
					where: options.where
				});
			}
		);
	},
	{ permission: 'bundle.view' }
);

