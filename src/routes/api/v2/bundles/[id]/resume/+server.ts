import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { publishToAccountMembers } from '$lib/server/mqtt/notifications/bundleNotifications';
import { DeviceNotificationType } from '$lib/server/mqtt/core/publish';
import { initializeStateManager, getStateManager } from '$lib/server/state/stateManagerFactory';
import { BundleProcessingState } from '$lib/server/state/types';
import { registerWaveTimeout } from '$lib/server/scheduler/bundleTimeoutManager';
import { sendBundleInstallToWave } from '$lib/server/bundles/bundlePublisher';

/**
 * POST /api/v2/bundles/[id]/resume
 * Resume a stopped deployment and auto-start the first PENDING wave.
 * 
 * Allowed from: STOPPED only (Cancelled is permanent and cannot be resumed)
 * 
 * What happens:
 * 1. All CANCELLED waves → PENDING; device progress in those waves → PENDING
 * 2. Bundle status → IN_PROGRESS
 * 3. Redis bundle state → ACTIVE
 * 4. First PENDING wave → IN_PROGRESS, devices get MQTT start command
 * 5. MQTT notification sent to UI (bundleStatus: IN_PROGRESS)
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ params, context }) => {
		const { id: bundleId } = params;
		const { prisma, session } = context;

		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			include: {
				waves: { orderBy: { createdAt: 'asc' } },
				apps: { include: { resource: true } }
			}
		});

		if (!bundle) {
			throw Object.assign(new Error('Bundle not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		const allowed = ['STOPPED'];
		if (!allowed.includes(bundle.status)) {
			throw Object.assign(
				new Error(`Cannot resume a deployment with status "${bundle.status}". Only STOPPED deployments can be resumed. Cancelled is permanent.`),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}

		const appsWithDeletedResource = (bundle.apps || []).filter((a: any) => !a.resource);
		if (appsWithDeletedResource.length > 0) {
			throw Object.assign(
				new Error(`Cannot resume: ${appsWithDeletedResource.length} app(s) reference deleted resources. Remove or replace them before resuming.`),
				{ status: 400, code: ErrorCodes.VALIDATION_ERROR }
			);
		}

		// 1. Reactivate CANCELLED waves back to PENDING
		const cancelledWaves = bundle.waves.filter((w: any) => w.status === 'CANCELLED');
		if (cancelledWaves.length > 0) {
			const cancelledWaveIds = cancelledWaves.map((w: any) => w.id);

			await prisma.bundleWave.updateMany({
				where: { id: { in: cancelledWaveIds } },
				data: { status: 'PENDING', startTime: null, endTime: null, updatedBy: session.user.id }
			});

			// Reset device progress for these waves back to PENDING
			await prisma.bundleDeviceProgress.updateMany({
				where: {
					waveId: { in: cancelledWaveIds },
					status: { in: ['CANCELLED', 'FAILED'] }
				},
				data: { status: 'PENDING', startedAt: null, completedAt: null, errorDetails: null, updatedBy: session.user.id }
			});

			for (const wave of cancelledWaves) {
				await logAudit({
					actionType: AuditActionType.UPDATE,
					tableName: 'BundleWave',
					recordId: wave.id,
					oldData: wave,
					newData: { ...wave, status: 'PENDING' },
					userId: session.user.id,
					ipAddress: context.ipAddress,
					prisma
				});
			}
		}

		// 2. Find the first PENDING wave and auto-start it
		// (Re-fetch waves after the update so we see the latest statuses)
		const updatedWaves = await prisma.bundleWave.findMany({
			where: { bundleId },
			orderBy: { createdAt: 'asc' }
		});
		const firstPendingWave = updatedWaves.find((w: any) => w.status === 'PENDING');
		const hasInProgressWave = updatedWaves.some((w: any) => w.status === 'IN_PROGRESS');

		let autoStartedWaveId: string | null = null;

		// Only auto-start if there is no wave already IN_PROGRESS (e.g. Wave 1 still running)
		if (firstPendingWave && !hasInProgressWave) {
			await prisma.bundleWave.update({
				where: { id: firstPendingWave.id },
				data: { status: 'IN_PROGRESS', startTime: new Date(), updatedBy: session.user.id }
			});
			autoStartedWaveId = firstPendingWave.id;

			// Register wave for timeout tracking
			try {
				await registerWaveTimeout(firstPendingWave.id, bundleId, new Date());
			} catch (timeoutErr: any) {
				logger.warn(`[BundleResume] Failed to register wave timeout: ${String(timeoutErr?.message || timeoutErr)}`);
			}

			// Update device progress for this wave to IN_PROGRESS and send full bundle_install (presigned URLs)
			const pendingDevices = await prisma.bundleDeviceProgress.findMany({
				where: { waveId: firstPendingWave.id, status: 'PENDING' },
				include: { bundleDevice: true }
			});

			if (pendingDevices.length > 0) {
				await prisma.bundleDeviceProgress.updateMany({
					where: { waveId: firstPendingWave.id, status: 'PENDING' },
					data: { status: 'IN_PROGRESS', startedAt: new Date(), updatedBy: session.user.id }
				});

				try {
					await sendBundleInstallToWave(prisma, bundleId, firstPendingWave.id, session.user.id);
				} catch (installErr: any) {
					logger.warn(`[BundleResume] Failed to send bundle_install to devices: ${String(installErr?.message || installErr)}`);
					// Don't rollback - wave is IN_PROGRESS, devices may have received partial messages
				}
			}

			logger.info(`[BundleResume] Auto-started wave ${firstPendingWave.id} (${firstPendingWave.name}) for bundle ${bundleId} with ${pendingDevices.length} devices`);
		}

		// 3. Update bundle status to IN_PROGRESS (deployment is running again)
		const newBundleStatus = (firstPendingWave || hasInProgressWave) ? 'IN_PROGRESS' : 'PUBLISHED';
		const oldStatus = bundle.status;
		await prisma.bundle.update({
			where: { id: bundleId },
			data: { status: newBundleStatus, updatedBy: session.user.id }
		});

		await logAudit({
			actionType: AuditActionType.UPDATE,
			tableName: 'Bundle',
			recordId: bundleId,
			oldData: { ...bundle, status: oldStatus },
			newData: { ...bundle, status: newBundleStatus },
			userId: session.user.id,
			ipAddress: context.ipAddress,
			prisma
		});

		// 4. Update Redis state to ACTIVE (CRITICAL: without this the scheduler won't process device events)
		// Re-creates keys even if they expired during the Stopped period (setBundleState uses setEx → creates fresh)
		try {
			await initializeStateManager();
			const stateManager = getStateManager();
			await stateManager.setBundleState(bundleId, {
				bundleId,
				state: BundleProcessingState.ACTIVE,
				timeoutAt: null,
				gracePeriodHours: 2,
				lastDeviceResponse: null,
				updatedAt: new Date()
			});
			logger.info(`[BundleResume] Redis state set to ACTIVE for bundle ${bundleId} (re-created if expired)`);
		} catch (e) {
			// Redis failed – rollback DB changes to avoid orphaned deployment
			logger.error(`[BundleResume] CRITICAL: Failed to update Redis state for bundle ${bundleId}: ${String(e)}. Rolling back.`);
			try {
				await prisma.bundle.update({ where: { id: bundleId }, data: { status: 'STOPPED', updatedBy: session.user.id } });
				if (autoStartedWaveId) {
					await prisma.bundleWave.update({ where: { id: autoStartedWaveId }, data: { status: 'PENDING', startTime: null, updatedBy: session.user.id } });
					await prisma.bundleDeviceProgress.updateMany({
						where: { waveId: autoStartedWaveId, status: 'IN_PROGRESS' },
						data: { status: 'PENDING', startedAt: null, updatedBy: session.user.id }
					});
				}
			} catch (rollbackErr) {
				logger.error(`[BundleResume] Rollback also failed: ${String(rollbackErr)}`);
			}
			throw Object.assign(
				new Error('Failed to activate deployment in Redis. The scheduler would not process device events. Please try again or check Redis connectivity.'),
				{ status: 503, code: ErrorCodes.INTERNAL_ERROR }
			);
		}

		// 5. Send MQTT notification so UI updates in real-time
		try {
			if (bundle.accountId) {
				await publishToAccountMembers(prisma, bundle.accountId, DeviceNotificationType.BundleStatus, {
					action: 'bundleStatus',
					bundleId,
					status: newBundleStatus,
					timestamp: new Date().toISOString()
				});
			}
		} catch (e) {
			logger.warn(`[BundleResume] Failed to send MQTT notification: ${String(e)}`);
		}

		logger.info(`[BundleResume] Bundle ${bundleId} resumed by user ${session.user.id}. Status: ${newBundleStatus}. Reactivated ${cancelledWaves.length} waves.${autoStartedWaveId ? ` Auto-started wave ${autoStartedWaveId}.` : ''}`);

		return successResponse(
			{ bundleId, status: newBundleStatus, reactivatedWaves: cancelledWaves.length, autoStartedWaveId },
			{ message: `Deployment resumed and ${autoStartedWaveId ? 'next batch started' : 'continuing'}.` }
		);
	},
	// TODO: re-enable ACL when bundle.update permission is granted for user route
	{ permission: 'bundle.update', skipPermission: true }
);
