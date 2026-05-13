import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { publishBundleCore } from '$lib/server/bundles/bundlePublisher';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { unregisterAllWavesForBundle } from '$lib/server/scheduler/bundleTimeoutManager';

/**
 * POST /api/v2/bundles/[id]/run
 * Run a deployment (for Scheduled or Completed bundles)
 * 
 * Allowed from: PUBLISHED (scheduled), COMPLETED
 * 
 * What happens:
 * - All existing waves and device progress are DELETED
 * - All wave timeouts for this bundle are unregistered from Redis
 * - Bundle is reset to DRAFT, then publishBundleCore is called which:
 *   - Creates new waves from devices
 *   - Assigns devices to waves
 *   - Starts the first wave (IN_PROGRESS)
 *   - Sets device progress to IN_PROGRESS + startedAt
 *   - Sends MQTT commands to devices (bundle_install action)
 *   - Registers wave timeout in Redis
 *   - Sets Redis bundle state to ACTIVE
 *   - Sends MQTT notifications to UI (PUBLISHED → IN_PROGRESS)
 * - Bundle ends as PUBLISHED/IN_PROGRESS
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ params, context }) => {
		const { id: bundleId } = params;
		const { prisma, session } = context;

		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			include: {
				waves: { orderBy: { createdAt: 'asc' } }
			}
		});

		if (!bundle) {
			throw Object.assign(new Error('Bundle not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		const allowed = ['PUBLISHED', 'COMPLETED'];
		if (!allowed.includes(bundle.status)) {
			throw Object.assign(
				new Error(`Cannot run a deployment with status "${bundle.status}". Only PUBLISHED (scheduled) or COMPLETED deployments can be run.`),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}

		const oldStatus = bundle.status;

		// 1. Unregister all wave timeouts from Redis
		try {
			await unregisterAllWavesForBundle(bundleId);
		} catch (e) {
			logger.warn(`[BundleRun] Failed to unregister wave timeouts: ${String(e)}`);
		}

		// 2. Clean up existing waves and device progress
		await prisma.bundleDeviceProgress.deleteMany({ where: { bundleId } });
		await prisma.bundleWave.deleteMany({ where: { bundleId } });

		// 3. Reset bundle to DRAFT so publishBundleCore can process it
		await prisma.bundle.update({
			where: { id: bundleId },
			data: { status: 'DRAFT', updatedBy: session.user.id }
		});

		// 4. Use publishBundleCore to handle the full publish flow
		// publishBundleCore handles:
		// - Creates waves, assigns devices
		// - Starts first wave, sends MQTT commands to devices
		// - Registers wave timeouts
		// - Sets Redis bundle state to ACTIVE
		// - Sends MQTT notifications to UI
		const result = await publishBundleCore(prisma, bundleId, session.user.id);

		if (result.status !== 200 && result.status !== 201) {
			// Rollback status if publish failed
			await prisma.bundle.update({
				where: { id: bundleId },
				data: { status: oldStatus, updatedBy: session.user.id }
			});
			throw Object.assign(
				new Error(result.body?.error || 'Failed to run deployment'),
				{ status: result.status, code: ErrorCodes.SERVER_ERROR }
			);
		}

		await logAudit({
			actionType: AuditActionType.UPDATE,
			tableName: 'Bundle',
			recordId: bundleId,
			oldData: { ...bundle, status: oldStatus },
			newData: { ...bundle, status: 'PUBLISHED' },
			userId: session.user.id,
			ipAddress: context.ipAddress,
			prisma
		});

		logger.info(`[BundleRun] Bundle ${bundleId} run by user ${session.user.id} (from ${oldStatus}).`);

		const wavesCreated = result?.body?.wavesCreated ?? 0;

		return successResponse(
			{ bundleId, status: 'PUBLISHED', wavesCreated },
			{
				message: wavesCreated > 0
					? `Deployment started with ${wavesCreated} batch(es). First batch started automatically.`
					: 'Deployment started.'
			}
		);
	},
	{ permission: 'bundle.publish', skipPermission: true }
);
