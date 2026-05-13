import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { publishToAccountMembers } from '$lib/server/mqtt/notifications/bundleNotifications';
import { DeviceNotificationType } from '$lib/server/mqtt/core/publish';
import { unregisterWaveTimeout, registerWaveTimeout } from '$lib/server/scheduler/bundleTimeoutManager';
import { initializeStateManager, getStateManager } from '$lib/server/state/stateManagerFactory';
import { BundleProcessingState } from '$lib/server/state/types';
import { sendBundleInstallToWave } from '$lib/server/bundles/bundlePublisher';

/**
 * POST /api/v2/bundles/[id]/retry
 * Retry a failed deployment and auto-start the first PENDING wave.
 * 
 * Allowed from: FAILED
 * 
 * What happens:
 * 1. All FAILED waves → PENDING (startTime/endTime cleared)
 * 2. Device progress in FAILED waves: FAILED → PENDING (timestamps + errorDetails cleared)
 * 3. Wave timeouts for FAILED waves are unregistered
 * 4. First PENDING wave → IN_PROGRESS; devices get MQTT start command; wave registered for timeout
 * 5. Bundle status → IN_PROGRESS (if a wave was started) or PUBLISHED (if no PENDING waves)
 * 6. Redis bundle state → ACTIVE (CRITICAL – rollback DB if fails)
 * 7. MQTT notification sent to UI
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

		if (bundle.status !== 'FAILED') {
			throw Object.assign(
				new Error(`Cannot retry a deployment with status "${bundle.status}". Only FAILED deployments can be retried.`),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}

		const appsWithDeletedResource = (bundle.apps || []).filter((a: any) => !a.resource);
		if (appsWithDeletedResource.length > 0) {
			throw Object.assign(
				new Error(`Cannot retry: ${appsWithDeletedResource.length} app(s) reference deleted resources. Remove or replace them before retrying.`),
				{ status: 400, code: ErrorCodes.VALIDATION_ERROR }
			);
		}

		// 1. Reset FAILED waves to PENDING
		const failedWaves = bundle.waves.filter((w: any) => w.status === 'FAILED');
		if (failedWaves.length > 0) {
			const failedWaveIds = failedWaves.map((w: any) => w.id);

			await prisma.bundleWave.updateMany({
				where: { id: { in: failedWaveIds } },
				data: {
					status: 'PENDING',
					startTime: null,
					endTime: null,
					updatedBy: session.user.id
				}
			});

			// Reset FAILED device progresses in those waves to PENDING
			await prisma.bundleDeviceProgress.updateMany({
				where: {
					waveId: { in: failedWaveIds },
					status: 'FAILED'
				},
				data: {
					status: 'PENDING',
					startedAt: null,
					completedAt: null,
					errorDetails: null,
					updatedBy: session.user.id
				}
			});

			// Unregister wave timeouts for FAILED waves
			for (const wave of failedWaves) {
				try { await unregisterWaveTimeout(wave.id); } catch {}
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

		// Only auto-start if there is no wave already IN_PROGRESS
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
				logger.warn(`[BundleRetry] Failed to register wave timeout: ${String(timeoutErr?.message || timeoutErr)}`);
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
					logger.warn(`[BundleRetry] Failed to send bundle_install to devices: ${String(installErr?.message || installErr)}`);
					// Don't rollback - wave is IN_PROGRESS, devices may have received partial messages
				}
			}

			logger.info(`[BundleRetry] Auto-started wave ${firstPendingWave.id} (${(firstPendingWave as any).name}) for bundle ${bundleId} with ${pendingDevices.length} devices`);
		}

		// 3. Update bundle status to IN_PROGRESS (if a wave is running) or PUBLISHED (if not)
		const newBundleStatus = (firstPendingWave || hasInProgressWave) ? 'IN_PROGRESS' : 'PUBLISHED';
		await prisma.bundle.update({
			where: { id: bundleId },
			data: { status: newBundleStatus, updatedBy: session.user.id }
		});

		await logAudit({
			actionType: AuditActionType.UPDATE,
			tableName: 'Bundle',
			recordId: bundleId,
			oldData: { ...bundle, status: 'FAILED' },
			newData: { ...bundle, status: newBundleStatus },
			userId: session.user.id,
			ipAddress: context.ipAddress,
			prisma
		});

		// 4. Update Redis state to ACTIVE (CRITICAL: without this the scheduler won't process device events)
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
			logger.info(`[BundleRetry] Redis state set to ACTIVE for bundle ${bundleId}`);
		} catch (e) {
			// Redis failed – rollback DB changes to avoid orphaned deployment
			logger.error(`[BundleRetry] CRITICAL: Failed to update Redis state for bundle ${bundleId}: ${String(e)}. Rolling back.`);
			try {
				await prisma.bundle.update({ where: { id: bundleId }, data: { status: 'FAILED', updatedBy: session.user.id } });
				if (autoStartedWaveId) {
					await prisma.bundleWave.update({ where: { id: autoStartedWaveId }, data: { status: 'PENDING', startTime: null, updatedBy: session.user.id } });
					await prisma.bundleDeviceProgress.updateMany({
						where: { waveId: autoStartedWaveId, status: 'IN_PROGRESS' },
						data: { status: 'PENDING', startedAt: null, updatedBy: session.user.id }
					});
				}
			} catch (rollbackErr) {
				logger.error(`[BundleRetry] Rollback also failed: ${String(rollbackErr)}`);
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
			logger.warn(`[BundleRetry] Failed to send MQTT notification: ${String(e)}`);
		}

		logger.info(`[BundleRetry] Bundle ${bundleId} retried by user ${session.user.id}. Status: ${newBundleStatus}. Reset ${failedWaves.length} failed waves.${autoStartedWaveId ? ` Auto-started wave ${autoStartedWaveId}.` : ''}`);

		return successResponse(
			{ bundleId, status: newBundleStatus, retriedWaves: failedWaves.length, autoStartedWaveId },
			{ message: `Deployment retry initiated. ${failedWaves.length} failed batch(es) reset.${autoStartedWaveId ? ' Next batch started.' : ''}` }
		);
	},
	// TODO: re-enable ACL when bundle.update permission is granted for user route
	{ permission: 'bundle.update', skipPermission: true }
);
