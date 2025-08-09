import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';

// Core implementation that can be called from HTTP route and from scheduler
export async function _publishBundleCore(prisma: any, bundleId: string, userId = 'system') {
  const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
  if (!bundle) {
    return { status: 404, body: { success: false, error: 'Bundle not found' } };
  }
  // Enforce that only DRAFT bundles can be published
  if (bundle.status !== 'DRAFT') {
    return { status: 409, body: { success: false, error: 'Only DRAFT bundles can be published' } };
  }

  const updated = await prisma.bundle.update({
    where: { id: bundleId },
    data: { status: 'PUBLISHED', updatedBy: userId },
    select: { id: true, status: true }
  });

  // Notify UI that bundle moved to PUBLISHED so detail/list can refresh in real-time
  try {
    const publishedMsg = MessageFactory.createSystemMessage(
      'bundle:status',
      `subscription:bundle:${bundleId}`,
      { action: 'bundleStatus', bundleId, status: 'PUBLISHED' },
      SystemUser,
      { echoToSender: false }
    );
    await publisher.publish(publishedMsg);
  } catch {}

  try {
    const existingWaves = await prisma.bundleWave.count({ where: { bundleId } });
    if (existingWaves === 0) {
      const bundleDevices = await prisma.bundleDevice.findMany({
        where: { bundleId },
        select: { id: true, deviceId: true },
        orderBy: { createdAt: 'asc' }
      });

      const totalDevices = bundleDevices.length;
      const waveSize = Math.max(1, Number(bundle.waveSize) || 500);
      const totalWaves = Math.max(1, Math.ceil(totalDevices / waveSize));

      const createdWaves: Array<{ id: string; name: string }> = [];
      for (let i = 0; i < totalWaves; i++) {
        const wave = await prisma.bundleWave.create({
          data: { bundleId, name: `Wave ${i + 1}`, status: 'PENDING', createdBy: userId, updatedBy: userId, maxDevices: waveSize },
          select: { id: true, name: true }
        });
        createdWaves.push(wave);
      }

      const progressRows: Array<{ bundleId: string; waveId: string; bundleDeviceId: string; status: string; createdBy: string; updatedBy: string }> = [];
      for (let idx = 0; idx < bundleDevices.length; idx++) {
        const waveIdx = Math.floor(idx / waveSize);
        const waveId = createdWaves[Math.min(waveIdx, createdWaves.length - 1)].id;
        progressRows.push({ bundleId, waveId, bundleDeviceId: bundleDevices[idx].id, status: 'PENDING', createdBy: userId, updatedBy: userId });
      }
      if (progressRows.length > 0) await prisma.bundleDeviceProgress.createMany({ data: progressRows });

      logger.info(`Bundle ${bundleId} published with ${totalWaves} waves created (size=${waveSize}, devices=${totalDevices})`);

      if (createdWaves.length > 0) {
        const firstWaveId = createdWaves[0].id;
        try {
          await prisma.bundleWave.update({ where: { id: firstWaveId }, data: { status: 'IN_PROGRESS', startTime: new Date(), updatedBy: userId } });

          // Notify UI that bundle moved to IN_PROGRESS (auto-started first wave)
          try {
            const inProgressMsg = MessageFactory.createSystemMessage(
              'bundle:status',
              `subscription:bundle:${bundleId}`,
              { action: 'bundleStatus', bundleId, status: 'IN_PROGRESS' },
              SystemUser,
              { echoToSender: false }
            );
            await publisher.publish(inProgressMsg);
          } catch {}

          const [bundleMeta, bundleWithApps, progresses] = await Promise.all([
            prisma.bundle.findUnique({ where: { id: bundleId }, select: { id: true, name: true, reboot: true, forceUpdate: true } }),
            prisma.bundle.findUnique({ where: { id: bundleId }, include: { apps: { include: { resource: true }, orderBy: { order: 'asc' } } } }),
            prisma.bundleDeviceProgress.findMany({ where: { bundleId, waveId: firstWaveId }, include: { bundleDevice: true } })
          ]);

          for (const prog of progresses) {
            const deviceId = (prog as any).bundleDevice.deviceId as string;

            // offline fast-fail
            try {
              const deviceRow = await prisma.device.findUnique({ where: { id: deviceId }, select: { connected: true } });
              if (!deviceRow || deviceRow.connected === false) {
                await prisma.bundleDeviceProgress.update({ where: { id: (prog as any).id }, data: { status: 'FAILED', completedAt: new Date(), errorDetails: 'offline' } });
                const allForWave = await prisma.bundleDeviceProgress.findMany({ where: { waveId: firstWaveId } });
                const devicesTotal = allForWave.length;
                const devicesCompleted = allForWave.filter((r: any) => r.status === 'COMPLETED').length;
                const devicesFailed = allForWave.filter((r: any) => r.status === 'FAILED').length;
                const waveProgress = devicesTotal > 0 ? Math.round((devicesCompleted / devicesTotal) * 100) : 0;
                const waveStatus = devicesCompleted + devicesFailed >= devicesTotal && devicesTotal > 0 ? (devicesFailed > 0 ? 'FAILED' : 'COMPLETED') : 'IN_PROGRESS';
                await prisma.bundleWave.update({ where: { id: firstWaveId }, data: { status: waveStatus, endTime: waveStatus !== 'IN_PROGRESS' ? new Date() : undefined } });
                try {
                  const wavesForBundle = await prisma.bundleWave.findMany({ where: { bundleId }, select: { status: true } });
                  if (Array.isArray(wavesForBundle) && wavesForBundle.length > 0) {
                    const anyInProgressB = wavesForBundle.some((w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING');
                    const anyFailedB = wavesForBundle.some((w: any) => w.status === 'FAILED');
                    const allDoneB = wavesForBundle.every((w: any) => ['COMPLETED', 'FAILED'].includes(w.status));
                    const bundleStatusB = anyInProgressB ? 'IN_PROGRESS' : (allDoneB ? (anyFailedB ? 'FAILED' : 'COMPLETED') : 'PUBLISHED');
                    await prisma.bundle.update({ where: { id: bundleId }, data: { status: bundleStatusB } });
                  }
                } catch {}
                const offlineMsg = MessageFactory.createSystemMessage('device:bundleStatus', `subscription:device:${deviceId}`, { action: 'bundleStatus', deviceId, waveId: firstWaveId, status: 'FAILED', progress: waveProgress, devicesTotal, devicesCompleted, devicesFailed }, SystemUser, { echoToSender: false });
                await publisher.publish(offlineMsg);
                continue;
              }
            } catch {}

            const apps = (bundleWithApps?.apps || []).map((a: any, idx: number) => ({ resourceId: a.resourceId, name: a.resource?.name, packageName: a.resource?.packageName, path: a.resource?.path, version: a.resource?.version, format: a.resource?.format, size: a.resource?.size, order: a.order ?? idx + 1, autoOpen: !!a.autoOpen }));

            const anyAutoOpen = apps.some((a: any) => !!a.autoOpen);
            const payload: Record<string, unknown> = {
              action: 'message',
              type: 'bundle_install',
              deviceId,
              sessionId: `wave:${firstWaveId}`,
              batchId: `wave:${firstWaveId}`,
              bundles: [ { id: bundleMeta?.id ?? bundleId, name: bundleMeta?.name ?? 'Bundle', order: 1, apps } ],
              options: {
                reboot: !!bundleMeta?.reboot,
                autoOpen: anyAutoOpen,
                forceUpdate: !!bundleMeta?.forceUpdate
              }
            };
            const routing = MessageFactory.createSystemMessage('device', `subscription:device:${deviceId}`, payload, SystemUser, { echoToSender: false });
            await publisher.publish(routing);

            const numApps = Math.max(1, apps.length || 1);
            const timeoutMs = numApps * 5 * 60 * 1000;
            setTimeout(async () => {
              try {
                const current = await prisma.bundleDeviceProgress.findUnique({ where: { id: (prog as any).id } });
                if (!current) return;
                if (current.status === 'PENDING' || current.status === 'IN_PROGRESS') {
                  await prisma.bundleDeviceProgress.update({ where: { id: current.id }, data: { status: 'FAILED', completedAt: new Date(), errorDetails: 'timeout' } });
                  const allForWave2 = await prisma.bundleDeviceProgress.findMany({ where: { waveId: firstWaveId } });
                  const devicesTotal2 = allForWave2.length;
                  const devicesCompleted2 = allForWave2.filter((r: any) => r.status === 'COMPLETED').length;
                  const devicesFailed2 = allForWave2.filter((r: any) => r.status === 'FAILED').length;
                  const waveProgress2 = devicesTotal2 > 0 ? Math.round((devicesCompleted2 / devicesTotal2) * 100) : 0;
                  const waveStatus2 = devicesCompleted2 + devicesFailed2 >= devicesTotal2 && devicesTotal2 > 0 ? (devicesFailed2 > 0 ? 'FAILED' : 'COMPLETED') : 'IN_PROGRESS';
                  await prisma.bundleWave.update({ where: { id: firstWaveId }, data: { status: waveStatus2, endTime: waveStatus2 !== 'IN_PROGRESS' ? new Date() : undefined } });
                  try {
                    const wavesForBundle2 = await prisma.bundleWave.findMany({ where: { bundleId }, select: { status: true } });
                    if (Array.isArray(wavesForBundle2) && wavesForBundle2.length > 0) {
                      const anyInProgressC = wavesForBundle2.some((w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING');
                      const anyFailedC = wavesForBundle2.some((w: any) => w.status === 'FAILED');
                      const allDoneC = wavesForBundle2.every((w: any) => ['COMPLETED', 'FAILED'].includes(w.status));
                      const bundleStatusC = anyInProgressC ? 'IN_PROGRESS' : (allDoneC ? (anyFailedC ? 'FAILED' : 'COMPLETED') : 'PUBLISHED');
                      await prisma.bundle.update({ where: { id: bundleId }, data: { status: bundleStatusC } });
                    }
                  } catch {}
                  const timeoutMsg = MessageFactory.createSystemMessage('device:bundleStatus', `subscription:device:${deviceId}`, { action: 'bundleStatus', deviceId, waveId: firstWaveId, status: 'FAILED', progress: waveProgress2, devicesTotal: devicesTotal2, devicesCompleted: devicesCompleted2, devicesFailed: devicesFailed2, error: 'timeout' }, SystemUser, { echoToSender: false });
                  await publisher.publish(timeoutMsg);
                }
              } catch {}
            }, timeoutMs);
          }

          logger.info(`Auto-started first wave ${firstWaveId} for bundle ${bundleId} (dispatched ${progresses.length} devices)`);
        } catch (startErr: any) {
          logger.warn(`Failed to auto-start first wave for bundle ${bundleId}: ${startErr?.message || String(startErr)}`);
        }
      }
    } else {
      logger.info(`Bundle ${bundleId} already has ${existingWaves} waves; skipping wave creation`);
    }
  } catch (waveErr: any) {
    logger.warn(`Wave creation error for bundle ${bundleId}: ${waveErr?.message || String(waveErr)}`);
  }

  return { status: 200, body: { success: true, data: updated } };
}

export const POST: RequestHandler = restrict(
  async (event: any) => {
    const { params, locals } = event as { params: { id: string }; locals: any };
    const { id: bundleId } = params;
    try {
      const auth = await locals.auth?.validate?.();
      const userId = auth?.user?.id || locals?.user?.id || 'system';
      const result = await _publishBundleCore(locals.prisma as any, bundleId, userId);
      return json(result.body, { status: result.status });
    } catch (err) {
      return json({ success: false, error: 'Failed to publish bundle' }, { status: 500 });
    }
  },
  [SystemRole.ADMIN]
);


// Helper to publish from scheduler without HTTP context
export async function _publishBundleDirect(prisma: any, bundleId: string) {
  await _publishBundleCore(prisma, bundleId, 'system');
}


