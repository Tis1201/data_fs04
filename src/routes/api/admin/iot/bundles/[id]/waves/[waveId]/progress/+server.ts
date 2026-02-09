import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { compareProgressOrder } from '$lib/bundles/progressOrder';

export const GET: RequestHandler = restrict(async (event: any) => {
  const { params, locals } = event as { params: { id: string; waveId: string }; locals: any };
  const { id: bundleId, waveId } = params;
  try {
    const rows = await locals.prisma.bundleDeviceProgress.findMany({
      where: { bundleId, waveId },
      include: { bundleDevice: true },
      orderBy: { createdAt: 'asc' }
    });
    const deviceIds = rows.map((r: any) => r.bundleDevice.deviceId);
    const devices = await locals.prisma.device.findMany({
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
      const computedProgress = status === 'COMPLETED' ? 100 : (status === 'FAILED' ? metaProgress : metaProgress);

      return ({
      id: r.id,
      deviceId: r.bundleDevice.deviceId,
      deviceName: deviceMap.get(r.bundleDevice.deviceId) || r.bundleDevice.deviceId,
        status: r.status,
        progress: computedProgress,
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      errorDetails: r.errorDetails || null,
      retryCount: r.retryCount || 0
      });
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

    return json({ success: true, data });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to load progress' }, { status: 500 });
  }
}, [SystemRole.ADMIN]);


