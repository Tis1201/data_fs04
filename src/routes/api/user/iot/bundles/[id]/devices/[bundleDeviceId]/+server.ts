import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * When bundle is STOPPED: only devices in a cancelled wave can be removed.
 * When bundle is CANCELLED: no device removal (view only). When IN_PROGRESS or COMPLETED: not allowed.
 */
export const DELETE: RequestHandler = async ({ params, locals, getClientAddress }) => {
  try {
    const { id: bundleId, bundleDeviceId } = params as { id: string; bundleDeviceId: string };

    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await locals.prisma.bundleDevice.findUnique({
      where: { id: bundleDeviceId },
      select: { id: true, bundleId: true, deviceId: true }
    });

    if (!existing || existing.bundleId !== bundleId) {
      return json({ success: false, error: 'Device not found in bundle' }, { status: 404 });
    }

    const bundle = await locals.prisma.bundle.findUnique({
      where: { id: bundleId },
      select: { status: true }
    });
    if (!bundle) {
      return json({ success: false, error: 'Bundle not found' }, { status: 404 });
    }

    const bundleStatus = (bundle.status || '').toUpperCase();
    if (bundleStatus === 'IN_PROGRESS' || bundleStatus === 'COMPLETED') {
      return json(
        { success: false, error: 'Cannot remove devices while deployment is In Progress or Completed' },
        { status: 403 }
      );
    }

    if (bundleStatus === 'CANCELLED') {
      return json(
        { success: false, error: 'Cannot remove devices when deployment is permanently Cancelled (view only)' },
        { status: 403 }
      );
    }
    if (bundleStatus === 'STOPPED') {
      const progressList = await locals.prisma.bundleDeviceProgress.findMany({
        where: { bundleDeviceId },
        select: { status: true }
      });
      const allCancelled =
        progressList.length === 0 ||
        progressList.every((p) => (p.status || '').toUpperCase() === 'CANCELLED');
      if (!allCancelled) {
        return json(
          {
            success: false,
            error: 'When deployment is Stopped, only devices in a cancelled wave can be removed'
          },
          { status: 403 }
        );
      }
    }

    await locals.prisma.bundleDevice.delete({ where: { id: bundleDeviceId } });

    logger.info(`BundleDevice ${bundleDeviceId} removed from bundle ${bundleId} by user ${auth.user.id}`);

    // Log audit for bundle device deletion
    await logAudit({
      actionType: AuditActionType.DELETE,
      tableName: 'BundleDevice',
      recordId: bundleDeviceId,
      oldData: existing,
      newData: null,
      userId: auth.user.id,
      ipAddress: (locals as any).ipAddress || getClientAddress?.() || 'unknown',
      prisma: locals.prisma
    });

    return json({ success: true, message: 'Device removed from bundle' });
  } catch (err) {
    return errorHandler(err);
  }
};


