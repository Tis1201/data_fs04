/**
 * Unified Bundle Devices API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/bundles/[id]/devices
 * - /api/user/iot/bundles/[id]/devices
 * 
 * Manages devices assigned to a bundle.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/bundles/[id]/devices
 * List devices assigned to bundle
 */
export const GET = unifiedEndpoint(
	async ({ context, params }) => {
		const bundleId = params.id;
		
		// Check bundle access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: { id: true, accountId: true, createdBy: true }
		});
		
		if (!bundle) {
			throw Object.assign(
				new Error('Bundle not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		requireResourceAccess(context, {
			accountId: bundle.accountId || undefined,
			createdBy: bundle.createdBy
		});
		
		// Get bundle devices
		const bundleDevices = await prisma.bundleDevice.findMany({
			where: { bundleId },
			orderBy: { createdAt: 'asc' }
		});
		
		// Get device info separately
		const deviceIds = bundleDevices.map(bd => bd.deviceId);
		const devices = await prisma.device.findMany({
			where: { id: { in: deviceIds } },
			select: {
				id: true,
				name: true,
				model: true,
				connected: true
			}
		});
		
		// Combine bundle devices with device info
		const devicesMap = new Map(devices.map(d => [d.id, d]));
		const bundleDevicesWithInfo = bundleDevices.map(bd => ({
			...bd,
			device: devicesMap.get(bd.deviceId) || null
		}));
		
		return successResponse(
			bundleDevicesWithInfo,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.view' }
);

/**
 * POST /api/v2/bundles/[id]/devices
 * Assign devices to bundle
 */
export const POST = unifiedEndpoint(
	async ({ context, params, event }) => {
		const bundleId = params.id;
		const data = await event.request.json();
		const deviceIds = data.deviceIds as string[];
		
		if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
			throw Object.assign(
				new Error('deviceIds array is required'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		// Check bundle access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				status: true
			}
		});
		
		if (!bundle) {
			throw Object.assign(
				new Error('Bundle not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		requireResourceAccess(context, {
			accountId: bundle.accountId || undefined,
			createdBy: bundle.createdBy
		});
		
		// Can only add devices to DRAFT bundles
		if (bundle.status !== 'DRAFT') {
			throw Object.assign(
				new Error('Can only add devices to DRAFT bundles'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		
		// Verify devices exist and user has access
		const devices = await prisma.device.findMany({
			where: {
				id: { in: deviceIds },
				...(context.session.user.systemRole !== 'ADMIN' && {
					accountId: context.account?.id
				})
			},
			select: { id: true, name: true, model: true, connected: true }
		});
		
		if (devices.length !== deviceIds.length) {
			throw Object.assign(
				new Error('Some devices not found or access denied'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Add devices to bundle (ignore conflicts for idempotency)
		const createData = deviceIds.map(deviceId => ({
			bundleId,
			deviceId,
			createdBy: context.session.user.id,
			updatedBy: context.session.user.id
		}));
		
		await prisma.bundleDevice.createMany({
			data: createData,
			skipDuplicates: true
		});
		
		// Get updated list
		const bundleDevices = await prisma.bundleDevice.findMany({
			where: { bundleId }
		});
		
		// Combine with device info
		const allDeviceIds = bundleDevices.map(bd => bd.deviceId);
		const allDevices = await prisma.device.findMany({
			where: { id: { in: allDeviceIds } },
			select: {
				id: true,
				name: true,
				model: true,
				connected: true
			}
		});
		
		const devicesMap = new Map(allDevices.map(d => [d.id, d]));
		const bundleDevicesWithInfo = bundleDevices.map(bd => ({
			...bd,
			device: devicesMap.get(bd.deviceId) || null
		}));
		
		return successResponse(
			{ added: devices.length, total: bundleDevicesWithInfo.length, devices: bundleDevicesWithInfo },
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.edit' }
);

