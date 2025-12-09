/**
 * Unified Devices API (v2)
 * 
 * This endpoint provides device listing and management.
 * Works for both admin and user roles with appropriate permission checks.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { unifiedEndpoint, handlePaginatedList } from '$lib/server/api/unifiedEndpoint';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/devices
 * List devices (paginated)
 * 
 * Query params:
 * - page: page number
 * - pageSize: items per page
 * - status: filter by status (ACTIVE, INACTIVE, etc.)
 * - connected: filter by connection status (true/false)
 * 
 * - Admin: sees all devices
 * - User: sees only devices in their account
 */
export const GET: RequestHandler = unifiedEndpoint(
	async ({ context, event }) => {
		const url = event.url;
		const statusFilter = url.searchParams.get('status');
		const connectedFilter = url.searchParams.get('connected');

		// Build query filters
		const filters: any = {};
		if (statusFilter) {
			filters.status = statusFilter;
		}
		if (connectedFilter !== null) {
			filters.connected = connectedFilter === 'true';
		}

		return await handlePaginatedList(
			context,
			event,
			// Fetcher
			async (options) => {
				return await prisma.device.findMany({
					...options,
					where: {
						...options.where,
						...filters
					},
					include: {
						account: options.include?.account || false
					},
					orderBy: {
						createdAt: 'desc'
					}
				});
			},
			// Counter
			async (options) => {
				return await prisma.device.count({
					where: {
						...options.where,
						...filters
					}
				});
			}
		);
	},
	{ permission: 'device.view' }
);

