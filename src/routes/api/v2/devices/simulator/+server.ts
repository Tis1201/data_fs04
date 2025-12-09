/**
 * Unified Device Simulator API (v2)
 * 
 * This endpoint creates simulated devices for testing.
 * Admin-only feature.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/devices/simulator
 * Create simulated devices for testing
 * 
 * Request body:
 * {
 *   "name": "Test Device",
 *   "deviceType": "kiosk",
 *   "count": 1,
 *   "accountId": "optional_account_id"
 * }
 */
export const POST = unifiedEndpoint(
	async ({ context, event }) => {
		const body = await event.request.json();
		const { name, deviceType = 'kiosk', count = 1, accountId } = body;
		
		if (!name) {
			throw Object.assign(
				new Error('Device name is required'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		if (count < 1 || count > 100) {
			throw Object.assign(
				new Error('Count must be between 1 and 100'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		// Determine target account (admin can specify, otherwise use their account)
		const targetAccountId = accountId || context.account?.id;
		
		const devices = [];
		
		for (let i = 0; i < count; i++) {
			const deviceName = count > 1 ? `${name} ${i + 1}` : name;
			
			const device = await prisma.device.create({
				data: {
					name: deviceName,
					deviceType,
					description: `Simulated device for testing`,
					status: 'ACTIVE',
					createdBy: context.session.user.id,
					accountId: targetAccountId,
					connected: false,
					connectedAt: null,
					disconnectedAt: null
				},
				select: {
					id: true,
					name: true,
					deviceType: true,
					status: true,
					connected: true
				}
			});
			
			devices.push(device);
		}
		
		logger.info(`[Simulator v2] Created ${devices.length} simulated devices`, {
			requestId: context.requestId,
			userId: context.session.user.id,
			count: devices.length
		});
		
		return successResponse(
			{
				devices,
				count: devices.length,
				message: `Created ${devices.length} simulated device${devices.length > 1 ? 's' : ''}`
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'admin.accessSimulator', feature: 'device.simulator' }
);

