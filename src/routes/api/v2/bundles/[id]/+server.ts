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
 * - Cannot delete IN_PROGRESS or COMPLETED bundles
 * - PUBLISHED bundles can only be deleted if they are scheduled (have scheduledAt)
 * - Allowed statuses: DRAFT, PUBLISHED (scheduled only), FAILED, STOPPED (Cancelled is permanent – not deletable)
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

    // Determine deletable statuses:
    // DRAFT, FAILED, STOPPED are deletable; CANCELLED is permanent (not deletable)
    // PUBLISHED is only deletable if scheduled (has scheduledAt)
    // IN_PROGRESS and COMPLETED are not deletable
    const alwaysDeletable = ['DRAFT', 'FAILED', 'STOPPED'];
    const isScheduledPublished = bundle.status === 'PUBLISHED' && !!(bundle as any).scheduledAt;
    
    if (!alwaysDeletable.includes(bundle.status) && !isScheduledPublished) {
      // For IN_PROGRESS or non-scheduled PUBLISHED, check waves to see if status should be recomputed
      if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
        const waves = await prisma.bundleWave.findMany({
          where: { bundleId },
          select: { status: true }
        });

        if (Array.isArray(waves) && waves.length > 0) {
          const anyActive = waves.some(
            (w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING'
          );

          if (anyActive) {
            throw Object.assign(
              new Error('Cannot delete an in-progress deployment. Stop or cancel it first.'),
              { status: 409, code: ErrorCodes.CONFLICT }
            );
          }

          // All waves are terminal - recompute bundle status
          const anyFailed = waves.some((w: any) => w.status === 'FAILED');
          const allDone = waves.every((w: any) =>
            ['COMPLETED', 'FAILED', 'CANCELLED', 'STOPPED'].includes(w.status)
          );
          const newStatus = allDone ? (anyFailed ? 'FAILED' : 'COMPLETED') : bundle.status;

          if (newStatus !== bundle.status) {
            await prisma.bundle.update({
              where: { id: bundleId },
              data: { status: newStatus }
            });
          }
          // After recomputing, if the new status still isn't deletable, block
          if (!alwaysDeletable.includes(newStatus)) {
            throw Object.assign(
              new Error('Cannot delete this deployment in its current status.'),
              { status: 409, code: ErrorCodes.CONFLICT }
            );
          }
        } else {
          throw Object.assign(
            new Error('Cannot delete this deployment in its current status.'),
            { status: 409, code: ErrorCodes.CONFLICT }
          );
        }
      } else {
        // COMPLETED or any other non-deletable status
        throw Object.assign(
          new Error('Cannot delete this deployment in its current status.'),
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
