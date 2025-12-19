import type { InMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { SystemUser } from '../../interfaces/message';
import { unregisterWaveTimeout } from '$lib/server/scheduler/bundleTimeoutManager';
import crypto from 'crypto';

export async function handleBundleStatus(message: InMessage): Promise<void> {
  try {
    const p = (message.payload || {}) as any;
    const deviceId: string | undefined = p.deviceId;

    const status: string | undefined = p.status;
    const progress: number | undefined = typeof p.progress === 'number' ? p.progress : undefined;
    const sessionId: string | undefined = p.sessionId || p.batchId; // wave:<waveId>
    const batchId: string | undefined = p.batchId || p.sessionId;
    if (!deviceId || !status || !sessionId) {
      logger.warn(`[DeviceHandler] bundleStatus missing required fields`, { deviceId, status, sessionId });
      return;
    }

    // sessionId/batchId are encoded as wave:<waveId>
    const waveId = String(sessionId).startsWith('wave:') ? String(sessionId).slice(5) : sessionId;

    // Find the BundleDeviceProgress record for this device in the wave
    const bdp = await (prisma as any).bundleDeviceProgress.findFirst({
      where: { waveId, bundle: { id: (message as any).bundleId || undefined } },
      include: { bundleDevice: true }
    });

    // If not found by relation, try by joining bundleDevice via deviceId
    let targetProgress = bdp;
    if (!targetProgress) {
      targetProgress = await (prisma as any).bundleDeviceProgress.findFirst({
        where: { waveId, bundleDevice: { deviceId } },
        include: { bundleDevice: true }
      });
    }

    if (!targetProgress) {
      logger.warn(`[DeviceHandler] bundleStatus: No progress row found for wave ${waveId} and device ${deviceId}`);
      // Still broadcast to UI so users see something
      const routing = MessageFactory.createSystemMessage(
        'device:bundleStatus',
        `subscription:device:${deviceId}`,
        { deviceId, waveId, status, progress },
        SystemUser,
        { echoToSender: false }
      );
      await publisher.publish(routing);
      return;
    }

    const newStatus = status === 'COMPLETED' ? 'COMPLETED' : status === 'FAILED' ? 'FAILED' : 'IN_PROGRESS';
    const update: any = { status: newStatus };
    if (newStatus === 'IN_PROGRESS' && typeof progress === 'number') {
      update.progress = progress;
      if (!targetProgress.startedAt) update.startedAt = new Date();
    }
    if (newStatus === 'COMPLETED' || newStatus === 'FAILED') {
      update.completedAt = new Date();
    }
    await (prisma as any).bundleDeviceProgress.update({ where: { id: targetProgress.id }, data: update });

    // Recompute wave aggregates
    const allForWave = await (prisma as any).bundleDeviceProgress.findMany({ where: { waveId } });
    const devicesTotal = allForWave.length;
    const devicesCompleted = allForWave.filter((r: any) => r.status === 'COMPLETED').length;
    const devicesFailed = allForWave.filter((r: any) => r.status === 'FAILED').length;
    // Progress represents percentage of devices that have been processed (completed + failed)
    const waveProgress = devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0;
    const waveStatus = devicesCompleted + devicesFailed >= devicesTotal && devicesTotal > 0
      ? (devicesFailed > 0 ? 'FAILED' : 'COMPLETED')
      : 'IN_PROGRESS';

    // Add detailed logging for wave status computation
    logger.info(`[WaveStatus] Wave ${waveId} status computation:`, {
      devicesTotal,
      devicesCompleted,
      devicesFailed,
      waveProgress,
      computedWaveStatus: waveStatus,
      deviceStatuses: allForWave.map((r: any) => ({ id: r.id, status: r.status, deviceId: r.bundleDevice?.deviceId }))
    });

    await (prisma as any).bundleWave.update({
      where: { id: waveId },
      data: { status: waveStatus, endTime: waveStatus !== 'IN_PROGRESS' ? new Date() : undefined }
    });

    // Broadcast wave status change to UI via MQTT
    try {
      const bundleId = (targetProgress as any).bundleId;
      
      // Get bundle accountId for MQTT topic
      const bundle = await (prisma as any).bundle.findUnique({
        where: { id: bundleId },
        select: { accountId: true }
      });
      
      if (bundle && bundle.accountId) {
        const { publishToAccountMembers } = await import('$lib/server/mqtt/notifications/bundleNotifications');
        const { DeviceNotificationType } = await import('$lib/server/mqtt/core/publish');
        
        await publishToAccountMembers(
          prisma,
          bundle.accountId,
          DeviceNotificationType.BundleWaveStatus,
          {
            action: 'waveStatus',
            bundleId,
            waveId,
            status: waveStatus,
            devicesTotal,
            devicesCompleted,
            devicesFailed,
            progress: waveProgress,
            endTime: waveStatus !== 'IN_PROGRESS' ? new Date().toISOString() : undefined
          }
        );
        
        logger.info(`[WaveStatus] Broadcasted wave status update via MQTT for wave ${waveId}: ${waveStatus}`);
      } else {
        logger.warn(`[WaveStatus] Bundle ${bundleId} not found or missing accountId, skipping MQTT broadcast`);
      }
    } catch (broadcastErr: any) {
      logger.warn(`[WaveStatus] Failed to broadcast wave status: ${broadcastErr?.message || String(broadcastErr)}`);
    }

    // If wave reached terminal status (completed or failed), try to start the next wave automatically
    if (waveStatus === 'COMPLETED' || waveStatus === 'FAILED') {
      const bundleId: string = (targetProgress as any).bundleId;
      logger.info(`[AutoStart] Wave ${waveId} reached terminal status: ${waveStatus}, attempting to start next wave for bundle ${bundleId}`);
      
      // COMPLETED waves: Remove from Redis immediately (all devices finished, no more data expected)
      // FAILED waves: Keep in Redis until bundle active period expires (devices may still send updates/retry)
      if (waveStatus === 'COMPLETED') {
        try {
          await unregisterWaveTimeout(waveId);
          logger.info(`[BundleHandler] Unregistered COMPLETED wave ${waveId} from timeout tracking`);
        } catch (timeoutErr: any) {
          logger.warn(`[BundleHandler] Failed to unregister COMPLETED wave from timeout tracking: ${String(timeoutErr?.message || timeoutErr)}`);
        }
      } else {
        // FAILED wave: Keep in Redis for late device responses during active period
        logger.debug(`[BundleHandler] Keeping FAILED wave ${waveId} in Redis timeout tracking until bundle active period expires`);
      }
      
      await checkAndAutoStartNextWave(bundleId, waveId);
    } else {
      logger.debug(`[AutoStart] Wave ${waveId} status: ${waveStatus}, not starting next wave yet`);
    }

    // Recompute bundle-level status based on all waves in the bundle
    try {
      const bundleId: string = (targetProgress as any).bundleId;
      await updateBundleStatus(bundleId);
    } catch (e) {
      logger.warn(`[DeviceHandler] Failed to recompute bundle status after wave update: ${String(e)}`);
    }

    // Broadcast to UI via unified status update (following new architecture)
    const routing = MessageFactory.createSystemMessage(
      'device:statusUpdate',
      `subscription:device:${deviceId}`,
      {
        action: 'bundleStatus',
        deviceId,
        waveId,
        status: newStatus,
        // Always send wave-level progress so UI aggregates are correct even for per-device updates
        progress: waveProgress,
        devicesTotal,
        devicesCompleted,
        devicesFailed,
        timestamp: new Date().toISOString()
      },
      SystemUser,
      { echoToSender: false }
    );
    await publisher.publish(routing);
  } catch (e: any) {
    logger.warn(`[DeviceHandler] Failed to process bundleStatus: ${String(e?.message || e)}`);
  }
}

// Helper function to update bundle status based on wave states
export async function updateBundleStatus(bundleId: string) {
  try {
    const waves = await (prisma as any).bundleWave.findMany({ where: { bundleId }, select: { status: true } });
    if (Array.isArray(waves) && waves.length > 0) {
      // Count waves by status
      const waveCounts = {
        PENDING: waves.filter((w: any) => w.status === 'PENDING').length,
        IN_PROGRESS: waves.filter((w: any) => w.status === 'IN_PROGRESS').length,
        COMPLETED: waves.filter((w: any) => w.status === 'COMPLETED').length,
        FAILED: waves.filter((w: any) => w.status === 'FAILED').length,
        CANCELLED: waves.filter((w: any) => w.status === 'CANCELLED').length
      };
      
      // Determine bundle status based on wave states
      const anyInProgress = waveCounts.IN_PROGRESS > 0;
      const anyPending = waveCounts.PENDING > 0;
      const anyFailed = waveCounts.FAILED > 0;
      const anyCancelled = waveCounts.CANCELLED > 0;
      const allCompleted = waveCounts.COMPLETED === waves.length;
      const allTerminal = waves.every((w: any) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(w.status));
      
      // Log detailed wave status information
      logger.info(`[BundleStatus] Bundle ${bundleId} wave analysis:`, {
        totalWaves: waves.length,
        waveCounts,
        anyInProgress,
        anyPending,
        anyFailed,
        anyCancelled,
        allCompleted,
        allTerminal
      });
      
      // Determine bundle status with priority order
      let bundleStatus;
      let reason = '';
      
      if (anyInProgress) {
        // Scenario: At least one wave is currently running
        bundleStatus = 'IN_PROGRESS';
        reason = 'Wave(s) currently in progress';
      } else if (anyFailed) {
        // Scenario: At least one wave failed (highest priority for failure)
        bundleStatus = 'FAILED';
        reason = 'At least one wave failed';
      } else if (anyCancelled && allTerminal) {
        // Scenario: Some waves cancelled and all waves are in terminal state
        bundleStatus = 'CANCELLED';
        reason = 'Deployment was cancelled';
      } else if (allCompleted) {
        // Scenario: All waves completed successfully
        bundleStatus = 'COMPLETED';
        reason = 'All waves completed successfully';
      } else if (anyPending) {
        // Scenario: Some waves are pending (waiting to start)
        bundleStatus = 'PUBLISHED';
        reason = 'Waves pending to start';
      } else {
        // Fallback scenario
        bundleStatus = 'PUBLISHED';
        reason = 'Fallback status';
      }
      
      logger.info(`[BundleStatus] Bundle ${bundleId} status decision:`, {
        computedStatus: bundleStatus,
        reason,
        waveStatuses: waves.map((w: any) => w.status)
      });
      
      // Update bundle status in database
      await (prisma as any).bundle.update({ where: { id: bundleId }, data: { status: bundleStatus } });
      logger.info(`[BundleStatus] Bundle ${bundleId} status updated to: ${bundleStatus}`);
      
      // Broadcast status update for terminal states via MQTT
      if (bundleStatus === 'COMPLETED' || bundleStatus === 'FAILED' || bundleStatus === 'CANCELLED') {
        try {
          // Get bundle accountId for MQTT topic
          const bundle = await (prisma as any).bundle.findUnique({
            where: { id: bundleId },
            select: { accountId: true }
          });
          
          if (bundle && bundle.accountId) {
            const { publishToAccountMembers } = await import('$lib/server/mqtt/notifications/bundleNotifications');
            const { DeviceNotificationType } = await import('$lib/server/mqtt/core/publish');
            
            await publishToAccountMembers(
              prisma,
              bundle.accountId,
              DeviceNotificationType.BundleStatus,
              {
                action: 'bundleStatus',
                bundleId,
                status: bundleStatus,
                reason,
                waveCounts
              }
            );
            
            logger.info(`[BundleStatus] Broadcasted bundle status update via MQTT: ${bundleStatus} (${reason})`);
          } else {
            logger.warn(`[BundleStatus] Bundle ${bundleId} not found or missing accountId, skipping MQTT broadcast`);
          }
        } catch (broadcastErr: any) {
          logger.warn(`[BundleStatus] Failed to broadcast bundle status: ${broadcastErr?.message || String(broadcastErr)}`);
        }
      }
    }
  } catch (e) {
    logger.warn(`[BundleStatus] Failed to update bundle status for ${bundleId}: ${String(e)}`);
  }
}

// Helper function to check and auto-start the next wave
export async function checkAndAutoStartNextWave(bundleId: string, currentWaveId: string) {
  try {
    logger.info(`[AutoStart] Checking for next wave after wave ${currentWaveId} in bundle ${bundleId}`);
    
    // Get all waves for this bundle ordered by creation time
    const allWaves = await (prisma as any).bundleWave.findMany({
      where: { bundleId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, status: true, name: true }
    });
    
    logger.info(`[AutoStart] Found ${allWaves.length} waves in bundle:`, allWaves.map((w: any) => ({ id: w.id, name: w.name, status: w.status })));
    
    // Find the current wave index
    const currentWaveIndex = allWaves.findIndex((w: any) => w.id === currentWaveId);
    logger.info(`[AutoStart] Current wave index: ${currentWaveIndex}`);
    
    // Check if there's a next wave that's pending
    if (currentWaveIndex >= 0 && currentWaveIndex + 1 < allWaves.length) {
      const nextWave = allWaves[currentWaveIndex + 1];
      logger.info(`[AutoStart] Next wave found:`, { id: nextWave.id, name: nextWave.name, status: nextWave.status });
      
      if (nextWave.status === 'PENDING') {
        logger.info(`[AutoStart] Starting next wave ${nextWave.id} (${nextWave.name})`);
        
        // Start the next wave automatically
        await (prisma as any).bundleWave.update({
          where: { id: nextWave.id },
          data: {
            status: 'IN_PROGRESS',
            startTime: new Date(),
            updatedBy: 'system'
          }
        });
        
        logger.info(`[AutoStart] Successfully updated wave ${nextWave.id} status to IN_PROGRESS`);
        
        // Broadcast wave status update to UI via MQTT
        try {
          // Get bundle accountId for MQTT topic
          const bundle = await (prisma as any).bundle.findUnique({
            where: { id: bundleId },
            select: { accountId: true }
          });
          
          if (bundle && bundle.accountId) {
            const { publishToAccountMembers } = await import('$lib/server/mqtt/notifications/bundleNotifications');
            const { DeviceNotificationType } = await import('$lib/server/mqtt/core/publish');
            
            await publishToAccountMembers(
              prisma,
              bundle.accountId,
              DeviceNotificationType.BundleWaveStatus,
              {
                action: 'waveStatus',
                bundleId,
                waveId: nextWave.id,
                status: 'IN_PROGRESS',
                startTime: new Date().toISOString()
              }
            );
            
            logger.info(`[AutoStart] Broadcasted wave status update via MQTT for wave ${nextWave.id}`);
          } else {
            logger.warn(`[AutoStart] Bundle ${bundleId} not found or missing accountId, skipping MQTT broadcast`);
          }
        } catch (broadcastErr: any) {
          logger.warn(`[AutoStart] Failed to broadcast wave status: ${broadcastErr?.message || String(broadcastErr)}`);
        }

        // Send install commands to devices in the next wave
        logger.info(`[AutoStart] Looking for devices in next wave ${nextWave.id} (${nextWave.name})`);
        const nextWaveProgresses = await (prisma as any).bundleDeviceProgress.findMany({
          where: { bundleId, waveId: nextWave.id },
          include: { bundleDevice: true },
          orderBy: { createdAt: 'asc' } // Ensure devices are processed in the same order they were assigned
        });
        
        logger.info(`[AutoStart] Found ${nextWaveProgresses.length} devices in next wave ${nextWave.id}:`, 
          nextWaveProgresses.map((p: any) => ({ 
            progressId: p.id, 
            deviceId: p.bundleDevice.deviceId, 
            status: p.status 
          }))
        );
        
        const bundle = await (prisma as any).bundle.findUnique({
          where: { id: bundleId },
          include: { 
            apps: { 
              include: { resource: true }, 
              orderBy: { order: 'asc' } 
            } 
          }
        });

        logger.info(`[AutoStart] Bundle details for wave ${nextWave.id}:`, {
          bundleId: bundle?.id,
          bundleName: bundle?.name,
          appsCount: bundle?.apps?.length || 0,
          reboot: bundle?.reboot,
          forceUpdate: bundle?.forceUpdate
        });
        
        logger.info(`[AutoStart] Processing ${nextWaveProgresses.length} devices for next wave ${nextWave.id}`);
        
        // Set startedAt for all devices in the wave when sending commands
        const startTime = new Date();
        await (prisma as any).bundleDeviceProgress.updateMany({
          where: { bundleId, waveId: nextWave.id, status: 'PENDING' },
          data: { 
            startedAt: startTime,
            status: 'IN_PROGRESS',
            updatedBy: 'system'
          }
        });
        logger.info(`[AutoStart] Set startedAt for all PENDING devices in wave ${nextWave.id}`);
        
        for (const prog of nextWaveProgresses) {
          const deviceId = prog.bundleDevice.deviceId;
          logger.info(`[AutoStart] Processing device ${deviceId} for wave ${nextWave.id}`);
          
          // Build the apps array with complete information
          const apps = (bundle?.apps || []).map((a: any, idx: number) => ({ 
            resourceId: a.resourceId, 
            name: a.resource?.name, 
            packageName: a.resource?.packageName, 
            path: a.resource?.path, 
            version: a.resource?.version, 
            format: a.resource?.format, 
            size: a.resource?.size, 
            order: a.order ?? idx + 1, 
            autoOpen: !!a.autoOpen 
          }));
          
          logger.info(`[AutoStart] Built ${apps.length} apps for device ${deviceId}:`, apps.map((a: any) => ({ name: a.name, packageName: a.packageName, version: a.version })));
          
          const anyAutoOpen = apps.some((a: any) => !!a.autoOpen);
          
          const command = {
            action: 'message',
            type: 'bundle_install',
            sessionId: `wave:${nextWave.id}`,
            batchId: `wave:${nextWave.id}`,
            deviceId,
            bundles: [
              { 
                id: bundle?.id ?? bundleId, 
                name: bundle?.name ?? 'Bundle', 
                order: 1,
                apps 
              }
            ],
            options: { 
              reboot: !!bundle?.reboot, 
              autoOpen: anyAutoOpen, 
              forceUpdate: !!bundle?.forceUpdate 
            }
          };
          
          logger.info(`[AutoStart] Built command for device ${deviceId}:`, {
            action: command.action,
            type: command.type,
            sessionId: command.sessionId,
            batchId: command.batchId,
            deviceId: command.deviceId,
            bundlesCount: command.bundles.length,
            options: command.options
          });
          
          try {
            // Check if device is online first
            logger.info(`[AutoStart] Checking device ${deviceId} status...`);
            const device = await (prisma as any).device.findUnique({ 
              where: { id: deviceId }, 
              select: { connected: true, name: true } 
            });
            
            if (!device) {
              logger.warn(`[AutoStart] Device ${deviceId} not found in database`);
              continue;
            }
            
            logger.info(`[AutoStart] Device ${deviceId} (${device.name}) status: connected=${device.connected}`);
            
            if (device.connected === false) {
              logger.warn(`[AutoStart] Device ${deviceId} (${device.name}) is offline, marking as failed`);
              // Mark device as failed immediately if offline
              await (prisma as any).bundleDeviceProgress.update({ 
                where: { id: prog.id }, 
                data: { 
                  status: 'FAILED', 
                  completedAt: new Date(), 
                  errorDetails: 'device_offline' 
                } 
              });
              continue;
            }
            
            // Use the same messaging system as manual publish
            logger.info(`[AutoStart] Publishing command to device ${deviceId} via subscription:device:${deviceId}`);
            const routing = MessageFactory.createSystemMessage('device', `subscription:device:${deviceId}`, command, SystemUser, { echoToSender: false });
            await publisher.publish(routing);
            
            logger.info(`[AutoStart] Successfully sent bundle_install command to device ${deviceId} (${device.name})`);
          } catch (sendErr: any) {
            logger.warn(`[AutoStart] Failed to send bundle_install to device ${deviceId} for wave ${nextWave.id}: ${sendErr?.message || String(sendErr)}`);
            logger.warn(`[AutoStart] Send error details:`, sendErr);
          }
        }
        
        logger.info(`Auto-started next wave ${nextWave.id} (${nextWave.name}) for bundle ${bundleId} after wave ${currentWaveId} reached terminal status`);
      } else {
        logger.info(`[AutoStart] Next wave ${nextWave.id} (${nextWave.name}) is not pending (status: ${nextWave.status}), not starting`);
      }
    } else {
      logger.info(`[AutoStart] No next wave found after wave ${currentWaveId} (current index: ${currentWaveIndex}, total waves: ${allWaves.length})`);
    }
    
    // Always check and update bundle status when a wave reaches terminal status
    await updateBundleStatus(bundleId);
  } catch (autoStartErr: any) {
    logger.warn(`Failed to auto-start next wave after ${currentWaveId} reached terminal status: ${autoStartErr?.message || String(autoStartErr)}`);
  }
}
