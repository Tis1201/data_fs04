import type { RequestEvent } from '@sveltejs/kit';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export { bundleTableOptions } from '$lib/server/bundles/bundleTableOptions';

export async function loadBundles(locals: any, url: URL) {
  const result = await fetchTableData(locals, url, bundleTableOptions);
  return { bundles: result.records, meta: result.meta };
}

export async function deleteBundle(locals: any, id: string) {
  const bundle = await locals.prisma.bundle.findUnique({
    where: { id },
    include: { apps: true, waves: true }
  });
  if (!bundle) return { notFound: true };

  if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
    try {
      const waves = await locals.prisma.bundleWave.findMany({
        where: { bundleId: id },
        select: { status: true }
      });
      if (Array.isArray(waves) && waves.length > 0) {
        const anyInProgress = waves.some((w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING');
        const anyFailed = waves.some((w: any) => w.status === 'FAILED');
        const allDone = waves.every((w: any) => ['COMPLETED', 'FAILED'].includes(w.status));
        if (!anyInProgress && allDone) {
          const computedStatus = anyFailed ? 'FAILED' : 'COMPLETED';
          await locals.prisma.bundle.update({ where: { id }, data: { status: computedStatus } });
          bundle.status = computedStatus as any;
        }
      }
    } catch {}
    if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
      return { cannotDelete: true };
    }
  }

  await locals.prisma.$transaction(async (tx: any) => {
    await tx.bundleApp.deleteMany({ where: { bundleId: id } });
    await tx.bundleDeviceProgress.deleteMany({ where: { bundleId: id } });
    await tx.bundleWave.deleteMany({ where: { bundleId: id } });
    await tx.bundleDevice.deleteMany({ where: { bundleId: id } });
    await tx.bundle.delete({ where: { id } });
    await logAudit({
      actionType: AuditActionType.DELETE,
      tableName: 'Bundle',
      recordId: id,
      oldData: bundle,
      newData: null,
      userId: locals.user.id,
      ipAddress: locals.ipAddress,
      prisma: tx
    });
  });

  return { success: true };
}


