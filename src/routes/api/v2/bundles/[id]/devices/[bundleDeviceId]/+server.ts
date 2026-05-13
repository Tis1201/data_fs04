import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * DELETE /api/v2/bundles/[id]/devices/[bundleDeviceId]
 * Remove a device from a bundle.
 *
 * When bundle is STOPPED: only devices in a cancelled wave can be removed.
 * When bundle is CANCELLED: no device removal (view only, permanent cancel).
 * When bundle is IN_PROGRESS or COMPLETED: removal is not allowed.
 */
export const DELETE = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId, bundleDeviceId } = params;

    const existing = await prisma.bundleDevice.findUnique({
      where: { id: bundleDeviceId },
      select: { id: true, bundleId: true, deviceId: true }
    });

    if (!existing || existing.bundleId !== bundleId) {
      throw Object.assign(
        new Error('Device not found in bundle'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      select: { status: true }
    });
    if (!bundle) {
      throw Object.assign(
        new Error('Bundle not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    const bundleStatus = (bundle.status || '').toUpperCase();
    if (bundleStatus === 'IN_PROGRESS' || bundleStatus === 'COMPLETED') {
      throw Object.assign(
        new Error('Cannot remove devices while deployment is In Progress or Completed'),
        { status: 403, code: ErrorCodes.FORBIDDEN }
      );
    }

    if (bundleStatus === 'CANCELLED') {
      throw Object.assign(
        new Error('Cannot remove devices when deployment is permanently Cancelled (view only)'),
        { status: 403, code: ErrorCodes.FORBIDDEN }
      );
    }
    if (bundleStatus === 'STOPPED') {
      const progressList = await prisma.bundleDeviceProgress.findMany({
        where: { bundleDeviceId },
        select: { status: true }
      });
      const allCancelled =
        progressList.length === 0 ||
        progressList.every((p) => (p.status || '').toUpperCase() === 'CANCELLED');
      if (!allCancelled) {
        throw Object.assign(
          new Error('When deployment is Stopped, only devices in a cancelled wave can be removed'),
          { status: 403, code: ErrorCodes.FORBIDDEN }
        );
      }
    }

    await prisma.bundleDevice.delete({ where: { id: bundleDeviceId } });

    logger.info(
      `BundleDevice ${bundleDeviceId} removed from bundle ${bundleId} by user ${session.user.id}`
    );

    // Log audit for bundle device deletion
    await logAudit({
      actionType: AuditActionType.DELETE,
      tableName: 'BundleDevice',
      recordId: bundleDeviceId,
      oldData: existing,
      newData: null,
      userId: session.user.id,
      ipAddress: context.ipAddress,
      prisma
    });

    return successResponse(
      { bundleId, bundleDeviceId },
      { message: 'Device removed from bundle' }
    );
  },
  { permission: 'bundle.edit' }
);
