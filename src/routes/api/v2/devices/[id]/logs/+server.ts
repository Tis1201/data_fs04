/**
 * Unified Device Logs API (v2)
 * 
 * This endpoint provides device action logs.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { paginatedResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/devices/[id]/logs
 * Get device action logs
 * 
 * Query params:
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 20, max: 100)
 * - actionType: filter by action type
 * - status: filter by status (pending, in_progress, success, failed, etc.)
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
		const actionType = url.searchParams.get('actionType');
		const status = url.searchParams.get('status');
		
		// Get device and check access
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				id: true,
				accountId: true,
				createdBy: true
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
		
		// Build where clause
		const where: any = { deviceId };
		if (actionType) where.actionType = actionType;
		if (status) where.status = status;
		
		// Get logs
		const skip = (page - 1) * pageSize;
		const [logs, total] = await Promise.all([
			prisma.deviceActionLog.findMany({
				where,
				skip,
				take: pageSize,
				orderBy: {
					initiatedAt: 'desc'
				},
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			}),
			prisma.deviceActionLog.count({ where })
		]);
		
		return paginatedResponse(
			logs,
			total,
			page,
			pageSize,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.view' }
);

