import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import type { Prisma } from '@prisma/client';

/**
 * DELETE /api/v2/bundles/[id]
 * Delete a bundle
 * 
 * Admin: Can delete any bundle (includes state cleanup)
 * User: Can delete bundles
 * 
 * Restrictions:
 * - Cannot delete PUBLISHED or IN_PROGRESS bundles
 * - Checks wave status before deletion
 * - Cascades delete to related entities
 */
export const DELETE = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;

    // Fetch bundle
    const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
    if (!bundle) {
      throw Object.assign(
        new Error('Bundle not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // If bundle is PUBLISHED or IN_PROGRESS, recompute status from waves
    if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
      const waves = await prisma.bundleWave.findMany({
        where: { bundleId },
        select: { status: true }
      });

      if (Array.isArray(waves) && waves.length > 0) {
        const anyInProgress = waves.some(
          (w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING'
        );

        if (anyInProgress) {
          throw Object.assign(
            new Error('Cannot delete a published or in-progress bundle'),
            { status: 409, code: ErrorCodes.CONFLICT }
          );
        }

        const anyFailed = waves.some((w: any) => w.status === 'FAILED');
        const allDone = waves.every((w: any) =>
          ['COMPLETED', 'FAILED'].includes(w.status)
        );
        const newStatus = allDone ? (anyFailed ? 'FAILED' : 'COMPLETED') : bundle.status;

        if (newStatus !== bundle.status) {
          await prisma.bundle.update({
            where: { id: bundleId },
            data: { status: newStatus }
          });
        }
      } else {
        // No waves; still treat as not deletable if status not DRAFT
        throw Object.assign(
          new Error('Cannot delete a published or in-progress bundle'),
          { status: 409, code: ErrorCodes.CONFLICT }
        );
      }
    }

    // Delete in a transaction in correct order
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.bundleDeviceProgress.deleteMany({ where: { bundleId } });
      await tx.bundleWave.deleteMany({ where: { bundleId } });
      await tx.bundleDevice.deleteMany({ where: { bundleId } });
      await tx.bundleApp.deleteMany({ where: { bundleId } });
      await tx.bundle.delete({ where: { id: bundleId } });
    });

    // Clean up bundle state from state manager (admin only)
    if (session.user.systemRole === 'ADMIN') {
      try {
        const { initializeStateManager, getStateManager } = await import(
          '$lib/server/state/stateManagerFactory'
        );
        await initializeStateManager();
        const stateManager = getStateManager();
        await stateManager.deleteBundleState(bundleId);
        logger.info(`Bundle state cleaned up for bundle ${bundleId}`);
      } catch (error) {
        // State cleanup is not critical for bundle deletion
        logger.warn(`Failed to cleanup bundle state: ${String(error)}`);
      }
    }

    return successResponse(
      { bundleId },
      { message: 'Bundle deleted successfully' }
    );
  },
  { permission: 'bundle.delete' }
);
