import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

export const DELETE: RequestHandler = restrict(
  async ({ params, locals }: any) => {
    const { id: bundleId } = params as { id: string };
    const prisma = locals.prisma as any;

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

    // Delete in a transaction in correct order
    await prisma.$transaction([
      prisma.bundleDeviceProgress.deleteMany({ where: { bundleId } }),
      prisma.bundleWave.deleteMany({ where: { bundleId } }),
      prisma.bundleDevice.deleteMany({ where: { bundleId } }),
      prisma.bundleApp.deleteMany({ where: { bundleId } }),
      prisma.bundle.delete({ where: { id: bundleId } })
    ]);

    return json({ success: true });
  },
  [SystemRole.USER]
);


