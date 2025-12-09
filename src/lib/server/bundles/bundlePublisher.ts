/**
 * Bundle Publisher - Shared Logic
 * 
 * Core implementation for publishing bundles and creating deployment waves.
 * This can be called from HTTP routes and from the scheduler.
 */

import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { initializeStateManager, getStateManager } from '$lib/server/state/stateManagerFactory';
import { BundleProcessingState } from '$lib/server/state/types';
import { registerWaveTimeout, setBundleTimeout } from '$lib/server/scheduler/bundleTimeoutManager';
import { calculateBundleTimeout, getTimeoutMinutes } from '$lib/server/config/timeoutConfig';
import { isDeviceOnline } from '$lib/server/device/devicePresence';

/**
 * Publish a bundle and create deployment waves
 * 
 * @param prisma - Prisma client instance
 * @param bundleId - ID of the bundle to publish
 * @param userId - ID of the user publishing (defaults to 'system')
 * @returns Result object with status and body
 */
export async function publishBundleCore(prisma: any, bundleId: string, userId = 'system') {
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

  // Initialize bundle state in state manager
  try {
    await initializeStateManager();
    const stateManager = getStateManager();
    await stateManager.setBundleState(bundleId, {
      bundleId,
      state: BundleProcessingState.ACTIVE,
      timeoutAt: null,
      gracePeriodHours: 2,
      lastDeviceResponse: null,
      updatedAt: new Date()
    });
    logger.info(`[PublishBundle] Initialized bundle state for ${bundleId} as ACTIVE`);
  } catch (error) {
    logger.warn(`[PublishBundle] Failed to initialize bundle state for ${bundleId}: ${error instanceof Error ? error.message : String(error)}`);
  }

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

          // Register auto-started first wave for timeout tracking
          try {
            await registerWaveTimeout(firstWaveId, bundleId, new Date());
            logger.info(`[PublishBundle] Registered auto-started first wave ${firstWaveId} for timeout tracking`);
          } catch (timeoutErr: any) {
            logger.warn(`[PublishBundle] Failed to register auto-started wave for timeout tracking: ${String(timeoutErr?.message || timeoutErr)}`);
          }

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
            prisma.bundle.findUnique({ where: { id: bundleId }, select: { id: true, name: true, reboot: true, forceUpdate: true, autoOpen: true } }),
            prisma.bundle.findUnique({ where: { id: bundleId }, include: { apps: { include: { resource: true }, orderBy: { order: 'asc' } } } }),
            prisma.bundleDeviceProgress.findMany({ where: { bundleId, waveId: firstWaveId }, include: { bundleDevice: true } })
          ]);

          // Set startedAt for all devices in the first wave when sending commands
          const startTime = new Date();
          await prisma.bundleDeviceProgress.updateMany({
            where: { bundleId, waveId: firstWaveId, status: 'PENDING' },
            data: { 
              startedAt: startTime,
              status: 'IN_PROGRESS',
              updatedBy: userId
            }
          });
          logger.info(`Set startedAt for all PENDING devices in first wave ${firstWaveId}`);

          // Set bundle timeout using centralized configuration (only once)
          let bundleTimeoutSet = false;
          const apps = (bundleWithApps?.apps || []).map((a: any, idx: number) => ({ 
            resourceId: a.resourceId, 
            name: a.resource?.name, 
            packageName: a.resource?.packageName, 
            path: a.resource?.path, 
            version: a.resource?.version, 
            format: a.resource?.format, 
            size: a.resource?.size, 
            order: a.order ?? idx + 1 
          }));

          for (const prog of progresses) {
            const deviceId = (prog as any).bundleDevice.deviceId as string;

            // offline fast-fail - check Redis for real-time presence
            let deviceIsOffline = false;
            try {
              const deviceIsOnlineRedis = await isDeviceOnline(deviceId);
              deviceIsOffline = !deviceIsOnlineRedis;
              
              // Detailed logging for debugging
              logger.info(`[PublishBundle] Device ${deviceId} presence check (Redis): online=${deviceIsOnlineRedis}, isOffline=${deviceIsOffline}`);
            } catch (offlineErr) {
              // If we can't check device status, assume offline (fail-safe)
              logger.error(`[PublishBundle] Failed to check device ${deviceId} presence: ${offlineErr instanceof Error ? offlineErr.message : String(offlineErr)}`);
              deviceIsOffline = true;
            }

            if (deviceIsOffline) {
              try {
                await prisma.bundleDeviceProgress.update({ where: { id: (prog as any).id }, data: { status: 'FAILED', completedAt: new Date(), errorDetails: 'offline' } });
                const allForWave = await prisma.bundleDeviceProgress.findMany({ where: { waveId: firstWaveId } });
                const devicesTotal = allForWave.length;
                const devicesCompleted = allForWave.filter((r: any) => r.status === 'COMPLETED').length;
                const devicesFailed = allForWave.filter((r: any) => r.status === 'FAILED').length;
                const waveProgress = devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0;
                const waveStatus = devicesCompleted + devicesFailed >= devicesTotal && devicesTotal > 0 ? (devicesFailed > 0 ? 'FAILED' : 'COMPLETED') : 'IN_PROGRESS';
                
                // Update wave status in database
                await prisma.bundleWave.update({ 
                  where: { id: firstWaveId }, 
                  data: { 
                    status: waveStatus, 
                    endTime: waveStatus !== 'IN_PROGRESS' ? new Date() : undefined 
                  } 
                });
                
                // Update bundle status based on all waves
                try {
                  const wavesForBundle = await prisma.bundleWave.findMany({ where: { bundleId }, select: { status: true } });
                  if (Array.isArray(wavesForBundle) && wavesForBundle.length > 0) {
                    const waveCounts = {
                      PENDING: wavesForBundle.filter((w: any) => w.status === 'PENDING').length,
                      IN_PROGRESS: wavesForBundle.filter((w: any) => w.status === 'IN_PROGRESS').length,
                      COMPLETED: wavesForBundle.filter((w: any) => w.status === 'COMPLETED').length,
                      FAILED: wavesForBundle.filter((w: any) => w.status === 'FAILED').length,
                      CANCELLED: wavesForBundle.filter((w: any) => w.status === 'CANCELLED').length
                    };
                    
                    const anyInProgressB = waveCounts.IN_PROGRESS > 0;
                    const anyPendingB = waveCounts.PENDING > 0;
                    const anyFailedB = waveCounts.FAILED > 0;
                    const anyCancelledB = waveCounts.CANCELLED > 0;
                    const allCompletedB = waveCounts.COMPLETED === wavesForBundle.length;
                    const allTerminalB = wavesForBundle.every((w: any) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(w.status));
                    
                    let bundleStatusB;
                    if (anyInProgressB) {
                      bundleStatusB = 'IN_PROGRESS';
                    } else if (anyFailedB) {
                      bundleStatusB = 'FAILED';
                    } else if (anyCancelledB && allTerminalB) {
                      bundleStatusB = 'CANCELLED';
                    } else if (allCompletedB) {
                      bundleStatusB = 'COMPLETED';
                    } else if (anyPendingB) {
                      bundleStatusB = 'PUBLISHED';
                    } else {
                      bundleStatusB = 'PUBLISHED';
                    }
                    
                    await prisma.bundle.update({ where: { id: bundleId }, data: { status: bundleStatusB } });
                  }
                } catch (bundleStatusErr) {
                  logger.warn(`[PublishBundle] Failed to update bundle status: ${bundleStatusErr instanceof Error ? bundleStatusErr.message : String(bundleStatusErr)}`);
                }
                
                // Send real-time progress update
                const waveMsg = MessageFactory.createSystemMessage(
                  'bundle:wave:progress',
                  `subscription:bundle:${bundleId}`,
                  { waveId: firstWaveId, bundleId, status: waveStatus, progress: waveProgress, devicesTotal, devicesCompleted, devicesFailed },
                  SystemUser,
                  { echoToSender: false }
                );
                await publisher.publish(waveMsg);
                
                // Send device-specific offline notification
                const offlineMsg = MessageFactory.createSystemMessage(
                  'device:bundleStatus',
                  `subscription:device:${deviceId}`,
                  { action: 'bundleStatus', deviceId, waveId: firstWaveId, status: 'FAILED', progress: waveProgress, devicesTotal, devicesCompleted, devicesFailed },
                  SystemUser,
                  { echoToSender: false }
                );
                await publisher.publish(offlineMsg);
                
                logger.info(`[PublishBundle] Device ${deviceId} offline => fast-fail => progress=${waveProgress}%, status=${waveStatus}`);
              } catch (failErr) {
                logger.error(`[PublishBundle] Failed to mark device ${deviceId} as offline: ${failErr instanceof Error ? failErr.message : String(failErr)}`);
              }
              continue;  // Skip sending command to offline device
            }

            // Set bundle timeout using centralized configuration (only once)
            if (!bundleTimeoutSet) {
              const numApps = Math.max(1, apps.length || 1);
              const timeoutMs = calculateBundleTimeout(numApps);
              try {
                await setBundleTimeout(bundleId, timeoutMs);
                logger.info(`[PublishBundle] Set bundle ${bundleId} timeout to ${getTimeoutMinutes(timeoutMs)} minutes (${numApps} apps)`);
                bundleTimeoutSet = true;
              } catch (timeoutErr: any) {
                logger.warn(`[PublishBundle] Failed to set bundle timeout: ${String(timeoutErr?.message || timeoutErr)}`);
              }
            }

            const command = {
              type: 'bundle_install',
              sessionId: `wave:${firstWaveId}`,
              batchId: `wave:${firstWaveId}`,
              deviceId,
              bundles: [
                {
                  id: bundleId,
                  name: bundleMeta?.name || 'Bundle',
                  order: 1,
                  apps: apps
                }
              ],
              options: {
                reboot: bundleMeta?.reboot ?? false,
                autoOpen: bundleMeta?.autoOpen ?? false,
                forceUpdate: bundleMeta?.forceUpdate ?? false
              }
            };

            const routing = MessageFactory.createSystemMessage(
              'device:actionRequest',
              `subscription:device:${deviceId}`,
              command,
              SystemUser,
              { echoToSender: false }
            );

            try {
              await publisher.publish(routing);
              logger.info(`[PublishBundle] Dispatched bundle_install to device ${deviceId} in auto-started wave ${firstWaveId} with ${apps.length} apps`);
            } catch (pubErr) {
              logger.error(`[PublishBundle] Failed to publish to device ${deviceId}: ${pubErr instanceof Error ? pubErr.message : String(pubErr)}`);
            }
          }

          logger.info(`[PublishBundle] Auto-started first wave ${firstWaveId} and dispatched install to ${progresses.length} devices`);
        } catch (autoStartErr) {
          logger.error(`[PublishBundle] Error auto-starting first wave: ${autoStartErr instanceof Error ? autoStartErr.message : String(autoStartErr)}`);
        }
      }

      return { status: 200, body: { success: true, bundle: updated, wavesCreated: createdWaves.length } };
    }

    return { status: 200, body: { success: true, bundle: updated, wavesCreated: 0, message: 'Waves already exist' } };
  } catch (error) {
    logger.error(`Error publishing bundle: ${error instanceof Error ? error.message : String(error)}`);
    return { status: 500, body: { success: false, error: 'Failed to publish bundle' } };
  }
}

// Export as _publishBundleCore for backward compatibility
export const _publishBundleCore = publishBundleCore;

