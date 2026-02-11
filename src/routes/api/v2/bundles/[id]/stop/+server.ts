import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { publishToAccountMembers } from '$lib/server/mqtt/notifications/bundleNotifications';
import { DeviceNotificationType } from '$lib/server/mqtt/core/publish';
import { unregisterWaveTimeout, unregisterAllWavesForBundle } from '$lib/server/scheduler/bundleTimeoutManager';
import { initializeStateManager, getStateManager } from '$lib/server/state/stateManagerFactory';
import { BundleProcessingState } from '$lib/server/state/types';

/**
 * POST /api/v2/bundles/[id]/stop
 * Stop a deployment temporarily (STOPPED status)
 * 
 * Allowed from: IN_PROGRESS, PUBLISHED
 * 
 * What happens:
 * - All PENDING waves → CANCELLED, their device progress → CANCELLED
 * - Current IN_PROGRESS wave is left running (devices keep their current status)
 * - Bundle status → STOPPED
 * - Redis bundle state → CANCELLED
 * - Wave timeouts for PENDING waves are unregistered
 * - MQTT notification sent to UI
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ params, context }) => {
		const { id: bundleId } = params;
		const { prisma, session } = context;

		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			include: { waves: { orderBy: { createdAt: 'asc' } } }
		});

		if (!bundle) {
			throw Object.assign(new Error('Bundle not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		const allowed = ['IN_PROGRESS', 'PUBLISHED'];
		if (!allowed.includes(bundle.status)) {
			throw Object.assign(
				new Error(`Cannot stop a deployment with status "${bundle.status}". Only IN_PROGRESS or PUBLISHED deployments can be stopped.`),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}

		// 1. Cancel all PENDING waves and their device progress
		const pendingWaves = bundle.waves.filter((w: any) => w.status === 'PENDING');
		if (pendingWaves.length > 0) {
			const pendingWaveIds = pendingWaves.map((w: any) => w.id);

			await prisma.bundleWave.updateMany({
				where: { id: { in: pendingWaveIds } },
				data: { status: 'CANCELLED', endTime: new Date(), updatedBy: session.user.id }
			});

			// Update device progress in those waves to CANCELLED
			await prisma.bundleDeviceProgress.updateMany({
				where: { waveId: { in: pendingWaveIds }, status: 'PENDING' },
				data: { status: 'CANCELLED', completedAt: new Date(), updatedBy: session.user.id }
			});

			// Unregister wave timeouts for cancelled waves
			for (const wave of pendingWaves) {
				try { await unregisterWaveTimeout(wave.id); } catch {}
				await logAudit({
					actionType: AuditActionType.UPDATE,
					tableName: 'BundleWave',
					recordId: wave.id,
					oldData: wave,
					newData: { ...wave, status: 'CANCELLED' },
					userId: session.user.id,
					ipAddress: context.ipAddress,
					prisma
				});
			}
		}

		// 2. Update bundle status to STOPPED
		const oldStatus = bundle.status;
		await prisma.bundle.update({
			where: { id: bundleId },
			data: { status: 'STOPPED', updatedBy: session.user.id }
		});

		await logAudit({
			actionType: AuditActionType.UPDATE,
			tableName: 'Bundle',
			recordId: bundleId,
			oldData: { ...bundle, status: oldStatus },
			newData: { ...bundle, status: 'STOPPED' },
			userId: session.user.id,
			ipAddress: context.ipAddress,
			prisma
		});

		// 3. Update Redis state
		try {
			await initializeStateManager();
			const stateManager = getStateManager();
			const currentState = await stateManager.getBundleState(bundleId);
			if (currentState) {
				await stateManager.setBundleState(bundleId, {
					...currentState,
					state: BundleProcessingState.CANCELLED,
					updatedAt: new Date()
				});
			}
		} catch (e) {
			logger.warn(`[BundleStop] Failed to update Redis state: ${String(e)}`);
		}

		// 4. Send MQTT notification so UI updates in real-time
		try {
			if (bundle.accountId) {
				await publishToAccountMembers(prisma, bundle.accountId, DeviceNotificationType.BundleStatus, {
					action: 'bundleStatus',
					bundleId,
					status: 'STOPPED',
					timestamp: new Date().toISOString()
				});
			}
		} catch (e) {
			logger.warn(`[BundleStop] Failed to send MQTT notification: ${String(e)}`);
		}

		logger.info(`[BundleStop] Bundle ${bundleId} stopped by user ${session.user.id}. Cancelled ${pendingWaves.length} pending waves.`);

		return successResponse(
			{ bundleId, status: 'STOPPED', cancelledWaves: pendingWaves.length },
			{ message: `Deployment stopped successfully. ${pendingWaves.length} pending batch(es) cancelled.` }
		);
	},
	// TODO: re-enable ACL when bundle.update permission is granted for user route
	{ permission: 'bundle.update', skipPermission: true }
);
