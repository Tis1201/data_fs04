import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { registerWaveTimeout } from '$lib/server/scheduler/bundleTimeoutManager';

/**
 * Checks if the current wave is complete and automatically starts the next wave
 */
export async function checkAndAutoStartNextWave(bundleId: string, currentWaveId: string) {
  try {
    // Get all waves for this bundle ordered by creation time
    const allWaves = await prisma.bundleWave.findMany({
      where: { bundleId },
      orderBy: { createdAt: 'asc' }
    });

    if (allWaves.length === 0) {
      logger.warn(`[BundleUtils] No waves found for bundle ${bundleId}`);
      return;
    }

    // Find the current wave index
    const currentWaveIndex = allWaves.findIndex(wave => wave.id === currentWaveId);
    if (currentWaveIndex === -1) {
      logger.warn(`[BundleUtils] Current wave ${currentWaveId} not found in bundle ${bundleId}`);
      return;
    }

    // Check if there's a next wave
    const nextWaveIndex = currentWaveIndex + 1;
    if (nextWaveIndex >= allWaves.length) {
      logger.info(`[BundleUtils] No next wave found for bundle ${bundleId} - all waves completed`);
      return;
    }

    const nextWave = allWaves[nextWaveIndex];
    
    // Check if next wave is in PENDING status
    if (nextWave.status !== 'PENDING') {
      logger.info(`[BundleUtils] Next wave ${nextWave.id} is not in PENDING status (${nextWave.status}), skipping auto-start`);
      return;
    }

    // Start the next wave
    logger.info(`[BundleUtils] Auto-starting next wave ${nextWave.id} for bundle ${bundleId}`);
    
    // Update wave status to RUNNING
    await prisma.bundleWave.update({
      where: { id: nextWave.id },
      data: { 
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    // Register wave for timeout tracking
    try {
      await registerWaveTimeout(nextWave.id, bundleId, new Date());
      logger.info(`[BundleUtils] Registered auto-started wave ${nextWave.id} for timeout tracking`);
    } catch (timeoutErr: any) {
      logger.warn(`[BundleUtils] Failed to register auto-started wave for timeout tracking: ${String(timeoutErr?.message || timeoutErr)}`);
    }

    // Send start command to all devices in the next wave
    const devices = await prisma.bundleWaveDevice.findMany({
      where: { 
        waveId: nextWave.id,
        status: 'PENDING'
      },
      include: { device: true }
    });

    for (const waveDevice of devices) {
      if (waveDevice.device) {
        try {
          const message = MessageFactory.createSystemMessage(
            'device:actionRequest',
            `subscription:device:${waveDevice.device.id}`,
            {
              action: 'bundleStatus',
              deviceId: waveDevice.device.id,
              waveId: nextWave.id,
              bundleId: bundleId,
              timestamp: new Date().toISOString()
            },
            SystemUser
          );

          await publisher.publish(message);
          logger.info(`[BundleUtils] Sent bundle start command to device ${waveDevice.device.id} for wave ${nextWave.id}`);
        } catch (error) {
          logger.error(`[BundleUtils] Failed to send bundle start command to device ${waveDevice.device.id}: ${String(error)}`);
        }
      }
    }

    logger.info(`[BundleUtils] Successfully auto-started wave ${nextWave.id} for bundle ${bundleId}`);
  } catch (error) {
    logger.error(`[BundleUtils] Error in checkAndAutoStartNextWave: ${String(error)}`);
    throw error;
  }
}

