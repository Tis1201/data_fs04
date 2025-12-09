/**
 * Unified Wave Progress API (v2)
 * 
 * This endpoint retrieves the progress of a bundle wave deployment.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/bundles/[id]/waves/[waveId]/progress
 * Get wave deployment progress
 */
export const GET = unifiedEndpoint(
	async ({ context, params }) => {
		const { id: bundleId, waveId } = params;
		
		// Get bundle and check access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: {
				id: true,
				accountId: true,
				createdBy: true
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
		
		// Ensure wave exists
		const wave = await prisma.bundleWave.findFirst({ 
			where: { id: waveId, bundleId } 
		});
		
		if (!wave) {
			throw Object.assign(
				new Error('Wave not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Get progress for all devices in this wave
		const rows = await prisma.bundleDeviceProgress.findMany({
			where: { bundleId, waveId },
			include: { bundleDevice: true },
			orderBy: { createdAt: 'asc' }
		});
		
		// Get device names
		const deviceIds = rows.map((r) => r.bundleDevice.deviceId);
		const devices = await prisma.device.findMany({
			where: { id: { in: deviceIds } },
			select: { id: true, name: true }
		});
		const deviceMap = new Map(devices.map((d) => [d.id, d.name]));
		
		// Map progress data
		const data = rows.map((r) => {
			let metaProgress = 0;
			try {
				if (r.metadata) {
					const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
					const p = Number((m as any)?.progress);
					if (Number.isFinite(p)) metaProgress = Math.max(0, Math.min(100, p));
				}
			} catch {}
			
			const status = r.status as string;
			const computedProgress = status === 'COMPLETED' ? 100 : metaProgress;
			
			return {
				id: r.id,
				deviceId: r.bundleDevice.deviceId,
				deviceName: deviceMap.get(r.bundleDevice.deviceId) || r.bundleDevice.deviceId,
				status: r.status,
				progress: computedProgress,
				startedAt: r.startedAt ? r.startedAt.toISOString() : null,
				completedAt: r.completedAt ? r.completedAt.toISOString() : null,
				errorDetails: r.errorDetails || null,
				retryCount: r.retryCount || 0
			};
		});
		
		// Calculate summary
		const summary = {
			total: data.length,
			completed: data.filter(d => d.status === 'COMPLETED').length,
			inProgress: data.filter(d => d.status === 'IN_PROGRESS' || d.status === 'PENDING').length,
			failed: data.filter(d => d.status === 'FAILED').length,
			averageProgress: data.length > 0 
				? Math.round(data.reduce((sum, d) => sum + d.progress, 0) / data.length)
				: 0
		};
		
		return successResponse(
			{
				waveId,
				bundleId,
				waveStatus: wave.status,
				devices: data,
				summary
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.view' }
);

