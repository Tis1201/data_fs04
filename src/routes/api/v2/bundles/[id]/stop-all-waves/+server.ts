import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/bundles/[id]/stop-all-waves
 * Stop all pending waves for a bundle (Admin only advanced feature)
 * Current IN_PROGRESS wave will complete normally
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ params, context }) => {
		const { id: bundleId } = params;
		const { prisma, session } = context;

		// Fetch the bundle and its waves
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			include: {
				waves: {
					orderBy: { createdAt: 'asc' }
				}
			}
		});

		if (!bundle) {
			return {
				success: false,
				error: {
					code: ErrorCodes.NOT_FOUND,
					message: 'Bundle not found'
				}
			};
		}

		// Check if there are any active waves
		const activeWaves = bundle.waves.filter((wave: any) => 
			wave.status === 'IN_PROGRESS' || wave.status === 'PENDING'
		);

		if (activeWaves.length === 0) {
			return {
				success: false,
				error: {
					code: ErrorCodes.INVALID_INPUT,
					message: 'No active waves to stop',
					details: 'There are no waves currently in progress or pending'
				}
			};
		}

		// Update all PENDING waves to CANCELLED status
		// This allows the current IN_PROGRESS wave to complete normally
		// but prevents subsequent waves from starting
		const pendingWaves = bundle.waves.filter((wave: any) => wave.status === 'PENDING');
		
		if (pendingWaves.length > 0) {
			await prisma.bundleWave.updateMany({
				where: {
					id: { in: pendingWaves.map((w: any) => w.id) }
				},
				data: {
					status: 'CANCELLED',
					updatedBy: session.user.id
				}
			});

			logger.info(`[StopAllWaves] Stopped ${pendingWaves.length} pending waves for bundle ${bundleId}`);

			// Log audit for each cancelled wave
			for (const wave of pendingWaves) {
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

		// Check if there's a wave currently running
		const currentRunningWave = bundle.waves.find((wave: any) => wave.status === 'IN_PROGRESS');
		
		if (currentRunningWave) {
			// If there's a wave running, keep bundle status as IN_PROGRESS
			// Let the current wave complete normally
			logger.info(`[StopAllWaves] Bundle ${bundleId} - wave ${currentRunningWave.id} is running, keeping bundle as IN_PROGRESS until wave completes`);
		} else {
			// If no wave is running, update bundle status to CANCELLED immediately
			await prisma.bundle.update({
				where: { id: bundleId },
				data: {
					status: 'CANCELLED',
					updatedBy: session.user.id
				}
			});

			await logAudit({
				actionType: AuditActionType.UPDATE,
				tableName: 'Bundle',
				recordId: bundleId,
				oldData: bundle,
				newData: { ...bundle, status: 'CANCELLED' },
				userId: session.user.id,
				ipAddress: context.ipAddress,
				prisma
			});

			logger.info(`[StopAllWaves] Bundle ${bundleId} status updated to CANCELLED - no waves running`);
		}

		return {
			success: true,
			data: {
				message: `Successfully stopped ${pendingWaves.length} pending waves. Current wave will complete normally.`,
				cancelledWaves: pendingWaves.length,
				bundleId,
				bundleStatus: currentRunningWave ? 'IN_PROGRESS' : 'CANCELLED'
			}
		};
	},
	{ permission: 'bundle.stopAllWaves' }
);

