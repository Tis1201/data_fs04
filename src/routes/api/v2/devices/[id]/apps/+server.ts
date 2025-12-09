/**
 * Unified Device Apps API (v2)
 * 
 * This endpoint provides device app listing.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, paginatedResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';

/**
 * GET /api/v2/devices/[id]/apps
 * Get apps installed on device
 * 
 * Query params:
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 20, max: 100)
 */
export const GET = unifiedEndpoint(
	async ({ context, params, event }) => {
		const deviceId = params.id;
		const url = event.url;
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = Math.min(
			parseInt(url.searchParams.get('pageSize') || '20'),
			100
		);
		
		// Get device and check access
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				macAddress: true
			}
		});
		
		if (!device) {
			throw Object.assign(
				new Error('Device not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Check access
		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});
		
		// Get apps from ClickHouse
		const result = await deviceAppService.getDeviceApps(deviceId, page, pageSize);
		
		return paginatedResponse(
			result.apps,
			result.total,
			page,
			pageSize,
			{ requestId: context.requestId }
		);
	},
	{ skipPermission: true } // Access enforced via requireResourceAccess
);

