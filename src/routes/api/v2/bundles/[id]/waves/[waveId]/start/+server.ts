/**
 * Unified Wave Start API (v2)
 * 
 * This endpoint starts a bundle wave deployment.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { registerWaveTimeout } from '$lib/server/scheduler/bundleTimeoutManager';
import type { UserInfo } from '$lib/server/types/user';

/**
 * POST /api/v2/bundles/[id]/waves/[waveId]/start
 * Start a wave deployment
 */
export const POST = unifiedEndpoint(
	async ({ context, params }) => {
		const { id: bundleId, waveId } = params;
		
		// Get bundle and check access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: {
				id: true,
				name: true,
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
		
		// Ensure wave belongs to bundle
		const wave = await prisma.bundleWave.findFirst({ 
			where: { id: waveId, bundleId } 
		});
		
		if (!wave) {
			throw Object.assign(
				new Error('Wave not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		if (wave.status !== 'PENDING') {
			throw Object.assign(
				new Error(`Wave is already ${wave.status}`),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		// Mark wave as IN_PROGRESS
		const updated = await prisma.bundleWave.update({
			where: { id: waveId },
			data: {
				status: 'IN_PROGRESS',
				startTime: new Date(),
				updatedBy: context.session.user.id
			},
			select: { id: true, status: true, startTime: true }
		});
		
		// Send install command to each device assigned to this wave
		try {
			const progresses = await prisma.bundleDeviceProgress.findMany({
				where: { bundleId, waveId },
				include: { bundleDevice: true },
				orderBy: { createdAt: 'asc' } // Ensure devices are processed in assignment order
			});

			const actingUser: UserInfo = {
				id: context.session.user.id,
				email: context.session.user.email,
				name: (context.session.user as any).name ?? context.session.user.email,
				systemRole: context.session.user.systemRole,
				source: 'session'
			};
			
			// Set startedAt for all devices in the wave when sending commands
			const startTime = new Date();
			await prisma.bundleDeviceProgress.updateMany({
				where: { bundleId, waveId, status: 'PENDING' },
				data: { 
					startedAt: startTime,
					status: 'IN_PROGRESS',
					updatedBy: actingUser.id
				}
			});
			
			for (const prog of progresses) {
				const deviceId = prog.bundleDevice.deviceId;
				const command = {
					type: 'bundle_install',
					sessionId: `wave:${waveId}`,
					batchId: `wave:${waveId}`,
					deviceId,
					bundles: [
						{ id: bundle.id, name: bundle.name, order: 1 }
					],
					options: { reboot: false, autoOpen: false }
				};
				
				// Use publisher to send command to device
				const routing = MessageFactory.createSystemMessage(
					'device:actionRequest',
					`subscription:device:${deviceId}`,
					command,
					actingUser,
					{ echoToSender: false }
				);
				await publisher.publish(routing);
			}
			
			logger.info(`[Wave Start v2] Dispatched bundle_install to ${progresses.length} devices for wave ${waveId}`, {
				requestId: context.requestId,
				bundleId,
				waveId,
				devicesCount: progresses.length
			});
		} catch (dispatchErr: any) {
			logger.warn(`[Wave Start v2] Failed dispatching devices for wave ${waveId}: ${dispatchErr?.message || String(dispatchErr)}`, {
				requestId: context.requestId
			});
		}
		
		// Register wave for timeout tracking
		try {
			await registerWaveTimeout(waveId, bundleId, new Date());
			logger.info(`[Wave Start v2] Registered wave ${waveId} for timeout tracking`, {
				requestId: context.requestId
			});
		} catch (timeoutErr: any) {
			logger.warn(`[Wave Start v2] Failed to register wave for timeout tracking: ${String(timeoutErr?.message || timeoutErr)}`, {
				requestId: context.requestId
			});
		}
		
		return successResponse(
			updated,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.publish', feature: 'bundle.autoStartWaves' }
);

