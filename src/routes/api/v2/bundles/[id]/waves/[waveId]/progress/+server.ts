import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { compareProgressOrder } from '$lib/bundles/progressOrder';

/**
 * GET /api/v2/bundles/[id]/waves/[waveId]/progress
 * Get progress for all devices in a wave
 * 
 * Returns:
 * - Device ID and name
 * - Status (PENDING, IN_PROGRESS, COMPLETED, FAILED)
 * - Progress percentage (0-100)
 * - Start/completion times
 * - Error details if failed
 * - Retry count
 */
export const GET = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma } = context;
    const { id: bundleId, waveId } = params;

    const rows = await prisma.bundleDeviceProgress.findMany({
      where: { bundleId, waveId },
      include: { bundleDevice: true },
      orderBy: { createdAt: 'asc' }
    });

    const deviceIds = rows.map((r: any) => r.bundleDevice.deviceId);
    const devices = await prisma.device.findMany({
      where: { id: { in: deviceIds } },
      select: { id: true, name: true }
    });

    const deviceMap = new Map(devices.map((d: any) => [d.id, d.name]));

    const data = rows.map((r: any) => {
      let metaProgress = 0;
      try {
        if (r.metadata) {
          const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
          const p = Number(m?.progress);
          if (Number.isFinite(p)) metaProgress = Math.max(0, Math.min(100, p));
        }
      } catch {}

      const status = r.status as string;
      const computedProgress =
        status === 'COMPLETED' ? 100 : status === 'FAILED' ? metaProgress : metaProgress;

      return {
        id: r.id,
        deviceId: r.bundleDevice.deviceId,
        deviceName: deviceMap.get(r.bundleDevice.deviceId) || r.bundleDevice.deviceId,
        status: r.status,
        progress: computedProgress,
        startedAt: r.startedAt ? r.startedAt.toISOString() : null,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        errorDetails: r.errorDetails || null,
        retryCount: r.retryCount || 0
      };
    });

    // Order: End On (completedAt) desc, device name asc (same as job so order never mixes up)
    data.sort((a: any, b: any) =>
      compareProgressOrder(
        a.completedAt ? new Date(a.completedAt).getTime() : 0,
        a.deviceName || '',
        b.completedAt ? new Date(b.completedAt).getTime() : 0,
        b.deviceName || ''
      )
    );

    return successResponse({ data });
  },
  { permission: 'bundle.view' }
);
