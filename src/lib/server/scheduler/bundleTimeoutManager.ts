import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { SystemUser } from '$lib/server/messaging/interfaces/message';
import { checkAndAutoStartNextWave } from '$lib/server/messaging/handlers/device/bundleUtils';
import { updateBundleStatus } from './bundleEventProcessor';

// Marks devices as FAILED due to inactivity if wave has exceeded the timeout window
export async function applyTimeouts() {
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();
  // Find waves in progress that started earlier than timeout window
  const waves = await (prisma as any).bundleWave.findMany({
    where: {
      status: 'IN_PROGRESS',
      startTime: { not: null }
    },
    select: { id: true, startTime: true, bundleId: true }
  });
  for (const w of waves) {
    const startMs = w.startTime ? new Date(w.startTime as any).getTime() : 0;
    if (!startMs) continue;
    if (now - startMs < TIMEOUT_MS) continue;

    try {
      // Mark any devices with PENDING/IN_PROGRESS and no recent start as FAILED
      const cutoff = new Date(now - TIMEOUT_MS);
      const res = await (prisma as any).bundleDeviceProgress.updateMany({
        where: {
          waveId: w.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          OR: [
            { startedAt: null },
            { startedAt: { lt: cutoff } }
          ]
        },
        data: {
          status: 'FAILED',
          errorDetails: 'timeout',
          startedAt: new Date(), // Set startedAt when marking as failed due to timeout
          completedAt: new Date(),
          updatedBy: 'system'
        }
      });
      if ((res?.count ?? 0) > 0) {
        logger.info(`[BundleTimeoutManager] Timeout pass: marked ${res.count} device(s) FAILED in wave ${w.id}`);
      }

      // Recompute wave aggregates and publish
      const all = await (prisma as any).bundleDeviceProgress.findMany({ where: { waveId: w.id } });
      const devicesTotal = all.length;
      const devicesCompleted = all.filter((r: any) => r.status === 'COMPLETED').length;
      const devicesFailed = all.filter((r: any) => r.status === 'FAILED').length;
      const waveProgress = devicesTotal > 0 ? Math.round((all.reduce((a: number, r: any) => {
        let p = 0;
        try { if (r.metadata) { const m = JSON.parse(r.metadata); p = Number(m?.progress ?? 0); } } catch {}
        return a + (Number.isFinite(p) ? p : 0);
      }, 0) / devicesTotal)) : 0;
      const waveStatus = (devicesCompleted + devicesFailed >= devicesTotal && devicesTotal > 0)
        ? (devicesFailed > 0 ? 'FAILED' : 'COMPLETED')
        : 'IN_PROGRESS';

      // Get current wave status to check if we need to set startTime
      const currentWave = await (prisma as any).bundleWave.findUnique({
        where: { id: w.id },
        select: { status: true, startTime: true }
      });

      const updateData: any = {
        status: waveStatus,
        endTime: waveStatus !== 'IN_PROGRESS' ? new Date() : undefined
      };

      // Only set startTime if transitioning from PENDING to IN_PROGRESS and startTime is not already set
      if (waveStatus === 'IN_PROGRESS' && currentWave?.status === 'PENDING' && !currentWave?.startTime) {
        updateData.startTime = new Date();
        logger.info(`[BundleTimeoutManager] Timeout pass: Setting startTime for wave ${w.id} transitioning from PENDING to IN_PROGRESS`);
      }

      await (prisma as any).bundleWave.update({
        where: { id: w.id },
        data: updateData
      });

      // Update bundle status based on all waves
      await updateBundleStatus(prisma, w.bundleId);

      // If wave reached terminal status due to timeout, try to start the next wave automatically
      if (waveStatus === 'COMPLETED' || waveStatus === 'FAILED') {
        logger.info(`[BundleTimeoutManager] Wave ${w.id} reached terminal status due to timeout: ${waveStatus}, attempting to start next wave for bundle ${w.bundleId}`);
        try {
          await checkAndAutoStartNextWave(w.bundleId, w.id);
        } catch (autoStartErr: any) {
          logger.warn(`[BundleTimeoutManager] Failed to auto-start next wave after timeout: ${String(autoStartErr?.message || autoStartErr)}`);
        }
      }

      // Publish bundle-level wave status
      try {
        const routing = MessageFactory.createSystemMessage(
          'bundle:waveStatus',
          `subscription:bundle:${w.bundleId}`,
          {
            action: 'bundle:waveStatus',
            waveId: w.id,
            status: waveStatus,
            progress: waveProgress,
            devicesTotal,
            devicesCompleted,
            devicesFailed,
            endTime: waveStatus !== 'IN_PROGRESS' ? new Date().toISOString() : undefined
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(routing);
      } catch (e) {
        logger.warn(`[BundleTimeoutManager] Timeout publish failed for wave ${w.id}: ${String(e)}`);
      }
    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Timeout handling failed for wave ${w.id}: ${String(e?.message || e)}`);
    }
  }
}
