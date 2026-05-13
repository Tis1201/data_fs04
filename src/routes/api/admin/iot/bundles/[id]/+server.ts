import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Prisma, PrismaClient } from '@prisma/client';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { initializeStateManager, getStateManager } from '$lib/server/state/stateManagerFactory';

export const DELETE: RequestHandler = restrict(
  async ({ params, locals }: any) => {
    const { id: bundleId } = params as { id: string };
    const prisma = locals.prisma as PrismaClient;

    // Fetch bundle
    const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
    if (!bundle) {
      return json({ success: false, error: 'Bundle not found' }, { status: 404 });
    }

    // If bundle is PUBLISHED or IN_PROGRESS, recompute status from waves
    if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
      const waves = await prisma.bundleWave.findMany({ where: { bundleId }, select: { status: true } });
      if (Array.isArray(waves) && waves.length > 0) {
        const anyInProgress = waves.some((w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING');
        if (anyInProgress) {
          return json({ success: false, error: 'Cannot delete a published or in-progress bundle' }, { status: 409 });
        }
        const anyFailed = waves.some((w: any) => w.status === 'FAILED');
        const allDone = waves.every((w: any) => ['COMPLETED', 'FAILED'].includes(w.status));
        const newStatus = allDone ? (anyFailed ? 'FAILED' : 'COMPLETED') : bundle.status;
        if (newStatus !== bundle.status) {
          await prisma.bundle.update({ where: { id: bundleId }, data: { status: newStatus } });
        }
      } else {
        // No waves; still treat as not deletable if status not DRAFT
        return json({ success: false, error: 'Cannot delete a published or in-progress bundle' }, { status: 409 });
      }
    }

    // Delete in an interactive transaction in correct order
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.bundleDeviceProgress.deleteMany({ where: { bundleId } });
      await tx.bundleWave.deleteMany({ where: { bundleId } });
      await tx.bundleDevice.deleteMany({ where: { bundleId } });
      await tx.bundleApp.deleteMany({ where: { bundleId } });
      await tx.bundle.delete({ where: { id: bundleId } });
    });

    // Clean up bundle state from state manager
    try {
      await initializeStateManager();
      const stateManager = getStateManager();
      await stateManager.deleteBundleState(bundleId);
    } catch (error) {
      // State cleanup is not critical for bundle deletion
    }

    return json({ success: true });
  },
  [SystemRole.ADMIN]
);


