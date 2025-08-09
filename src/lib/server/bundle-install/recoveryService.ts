import { logger } from '$lib/server/logger';
import { prisma } from '$lib/server/prisma';
import { bundleInstallErrorHandler } from './errorHandler';
import { bundleInstallService } from './bundleInstallService';
import { sseService } from '../sse/sseService';

export interface RecoveryOptions {
  autoRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  notifyOnFailure: boolean;
  escalateOnPermanentFailure: boolean;
}

export interface RecoveryResult {
  success: boolean;
  recoveredDevices: string[];
  recoveredBatches: string[];
  failedRecoveries: string[];
  message: string;
}

class RecoveryService {
  private readonly DEFAULT_RECOVERY_OPTIONS: RecoveryOptions = {
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 5000,
    notifyOnFailure: true,
    escalateOnPermanentFailure: true
  };

  async recoverSession(sessionId: string, options?: Partial<RecoveryOptions>): Promise<RecoveryResult> {
    const recoveryOptions = { ...this.DEFAULT_RECOVERY_OPTIONS, ...options };

    logger.info(`Starting recovery for session ${sessionId}`, { recoveryOptions });

    const result: RecoveryResult = {
      success: false,
      recoveredDevices: [],
      recoveredBatches: [],
      failedRecoveries: [],
      message: ''
    };

    try {
      // Get session details
      const session = await prisma.bundleInstallSession.findUnique({
        where: { id: sessionId },
        include: {
          devices: true,
          batches: true,
          errors: {
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      if (!session) {
        result.message = 'Session not found';
        return result;
      }

      // Recover failed devices
      const failedDevices = session.devices.filter(d => d.status === 'FAILED');
      for (const device of failedDevices) {
        const deviceRecovered = await this.recoverDevice(device.deviceId, sessionId, recoveryOptions);
        if (deviceRecovered) {
          result.recoveredDevices.push(device.deviceId);
        } else {
          result.failedRecoveries.push(device.deviceId);
        }
      }

      // Recover failed batches
      const failedBatches = session.batches.filter(b => b.status === 'FAILED');
      for (const batch of failedBatches) {
        const batchRecovered = await this.recoverBatch(batch.id, recoveryOptions);
        if (batchRecovered) {
          result.recoveredBatches.push(batch.id);
        } else {
          result.failedRecoveries.push(batch.id);
        }
      }

      // Determine overall success
      result.success = result.recoveredDevices.length > 0 || result.recoveredBatches.length > 0;
      result.message = `Recovery completed: ${result.recoveredDevices.length} devices, ${result.recoveredBatches.length} batches recovered`;

      // Notify about recovery results
      await this.notifyRecoveryResults(sessionId, result, recoveryOptions);

      logger.info(`Recovery completed for session ${sessionId}`, result);
      return result;

    } catch (error) {
      logger.error(`Recovery failed for session ${sessionId}`, { error: error.message });
      result.message = `Recovery failed: ${error.message}`;
      return result;
    }
  }

  async recoverDevice(deviceId: string, sessionId: string, options: RecoveryOptions): Promise<boolean> {
    try {
      logger.info(`Attempting to recover device ${deviceId}`, { sessionId });

      // Check if device is recoverable
      const device = await prisma.bundleInstallDevice.findFirst({
        where: { sessionId, deviceId, status: 'FAILED' }
      });

      if (!device) {
        logger.warn(`Device ${deviceId} not found or not in failed state`, { sessionId });
        return false;
      }

      // Check error history for this device
      const recentErrors = await prisma.bundleInstallError.findMany({
        where: { sessionId, deviceId },
        orderBy: { timestamp: 'desc' },
        take: 5
      });

      // If too many recent errors, don't retry
      if (recentErrors.length >= options.maxRetries) {
        logger.warn(`Device ${deviceId} has exceeded max retry attempts`, { sessionId, errorCount: recentErrors.length });
        return false;
      }

      // Attempt recovery using error handler
      const recovered = await bundleInstallErrorHandler.recoverDevice(deviceId, sessionId);
      
      if (recovered) {
        // Re-send installation command to device
        await this.resendDeviceCommand(deviceId, sessionId);
        logger.info(`Device ${deviceId} recovered successfully`, { sessionId });
        return true;
      }

      return false;

    } catch (error) {
      logger.error(`Failed to recover device ${deviceId}`, { sessionId, error: error.message });
      return false;
    }
  }

  async recoverBatch(batchId: string, options: RecoveryOptions): Promise<boolean> {
    try {
      logger.info(`Attempting to recover batch ${batchId}`);

      // Check if batch is recoverable
      const batch = await prisma.bundleInstallBatch.findUnique({
        where: { id: batchId }
      });

      if (!batch || batch.status !== 'FAILED') {
        logger.warn(`Batch ${batchId} not found or not in failed state`);
        return false;
      }

      // Check error history for this batch
      const recentErrors = await prisma.bundleInstallError.findMany({
        where: { batchId },
        orderBy: { timestamp: 'desc' },
        take: 5
      });

      // If too many recent errors, don't retry
      if (recentErrors.length >= options.maxRetries) {
        logger.warn(`Batch ${batchId} has exceeded max retry attempts`, { errorCount: recentErrors.length });
        return false;
      }

      // Attempt recovery using error handler
      const recovered = await bundleInstallErrorHandler.recoverBatch(batchId);
      
      if (recovered) {
        // Restart batch processing
        await this.restartBatchProcessing(batchId);
        logger.info(`Batch ${batchId} recovered successfully`);
        return true;
      }

      return false;

    } catch (error) {
      logger.error(`Failed to recover batch ${batchId}`, { error: error.message });
      return false;
    }
  }

  private async resendDeviceCommand(deviceId: string, sessionId: string): Promise<void> {
    try {
      // Get device installation details
      const deviceRecord = await prisma.bundleInstallDevice.findFirst({
        where: { sessionId, deviceId },
        include: {
          bundles: {
            include: { bundle: true },
            orderBy: { order: 'asc' }
          }
        }
      });

      if (!deviceRecord) {
        logger.error(`Device record not found for ${deviceId}`, { sessionId });
        return;
      }

      // Re-send installation command
      const command = {
        type: 'bundle_install',
        sessionId,
        batchId: deviceRecord.batchId,
        deviceId,
        bundles: deviceRecord.bundles.map(b => ({
          id: b.bundle.id,
          name: b.bundle.name,
          order: b.order
        })),
        options: {
          reboot: false,
          autoOpen: false
        }
      };

      // Send via SSE
      await sseService.sendToDevice(deviceId, {
        type: 'device',
        scope: `subscription:device:${deviceId}`,
        payload: command
      });

      logger.info(`Re-sent installation command to device ${deviceId}`, { sessionId });

    } catch (error) {
      logger.error(`Failed to re-send command to device ${deviceId}`, { sessionId, error: error.message });
    }
  }

  private async restartBatchProcessing(batchId: string): Promise<void> {
    try {
      // Get batch details
      const batch = await prisma.bundleInstallBatch.findUnique({
        where: { id: batchId },
        include: {
          devices: {
            include: { device: true }
          }
        }
      });

      if (!batch) {
        logger.error(`Batch ${batchId} not found`);
        return;
      }

      // Restart batch by sending commands to all devices in the batch
      for (const deviceRecord of batch.devices) {
        if (deviceRecord.status === 'PENDING') {
          await this.resendDeviceCommand(deviceRecord.deviceId, batch.sessionId);
        }
      }

      logger.info(`Restarted batch processing for ${batchId}`);

    } catch (error) {
      logger.error(`Failed to restart batch processing for ${batchId}`, { error: error.message });
    }
  }

  private async notifyRecoveryResults(sessionId: string, result: RecoveryResult, options: RecoveryOptions): Promise<void> {
    if (!options.notifyOnFailure) return;

    try {
      // Broadcast recovery results
      await sseService.broadcast({
        type: 'session:recovery',
        payload: {
          sessionId,
          result,
          timestamp: new Date()
        }
      });

      // If there are permanent failures and escalation is enabled
      if (result.failedRecoveries.length > 0 && options.escalateOnPermanentFailure) {
        await this.escalatePermanentFailures(sessionId, result.failedRecoveries);
      }

    } catch (error) {
      logger.error('Failed to notify recovery results', { sessionId, error: error.message });
    }
  }

  private async escalatePermanentFailures(sessionId: string, failedRecoveries: string[]): Promise<void> {
    try {
      // Log escalation
      logger.warn(`Escalating permanent failures for session ${sessionId}`, { failedRecoveries });

      // Create escalation record
      await prisma.bundleInstallError.create({
        data: {
          sessionId,
          errorType: 'SESSION',
          errorCode: 'PERMANENT_FAILURE',
          errorMessage: `Permanent failures after recovery attempts: ${failedRecoveries.join(', ')}`,
          retryCount: 0,
          maxRetries: 0,
          timestamp: new Date(),
          metadata: { failedRecoveries }
        }
      });

      // Send escalation notification
      await sseService.broadcast({
        type: 'session:escalation',
        payload: {
          sessionId,
          failedRecoveries,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Failed to escalate permanent failures', { sessionId, error: error.message });
    }
  }

  // Automatic Recovery Methods
  async scheduleAutomaticRecovery(sessionId: string, delay: number = 30000): Promise<void> {
    logger.info(`Scheduling automatic recovery for session ${sessionId} in ${delay}ms`);

    setTimeout(async () => {
      try {
        const result = await this.recoverSession(sessionId, {
          autoRetry: true,
          maxRetries: 2,
          retryDelay: 10000,
          notifyOnFailure: true,
          escalateOnPermanentFailure: true
        });

        logger.info(`Automatic recovery completed for session ${sessionId}`, result);

      } catch (error) {
        logger.error(`Automatic recovery failed for session ${sessionId}`, { error: error.message });
      }
    }, delay);
  }

  async monitorAndRecover(sessionId: string, interval: number = 60000): Promise<void> {
    logger.info(`Starting monitoring and recovery for session ${sessionId}`);

    const monitorInterval = setInterval(async () => {
      try {
        // Check for failed devices/batches
        const failedDevices = await prisma.bundleInstallDevice.count({
          where: { sessionId, status: 'FAILED' }
        });

        const failedBatches = await prisma.bundleInstallBatch.count({
          where: { sessionId, status: 'FAILED' }
        });

        if (failedDevices > 0 || failedBatches > 0) {
          logger.info(`Found failures in session ${sessionId}`, { failedDevices, failedBatches });
          await this.recoverSession(sessionId);
        }

        // Check if session is completed
        const session = await prisma.bundleInstallSession.findUnique({
          where: { id: sessionId }
        });

        if (session?.status === 'COMPLETED' || session?.status === 'FAILED') {
          clearInterval(monitorInterval);
          logger.info(`Monitoring stopped for session ${sessionId} - status: ${session?.status}`);
        }

      } catch (error) {
        logger.error(`Monitoring error for session ${sessionId}`, { error: error.message });
      }
    }, interval);
  }

  // Recovery Analysis
  async getRecoveryAnalysis(sessionId: string): Promise<any> {
    const errors = await prisma.bundleInstallError.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' }
    });

    const devices = await prisma.bundleInstallDevice.findMany({
      where: { sessionId }
    });

    const analysis = {
      totalErrors: errors.length,
      recoverableErrors: errors.filter(e => e.retryCount < e.maxRetries).length,
      permanentFailures: errors.filter(e => e.retryCount >= e.maxRetries).length,
      failedDevices: devices.filter(d => d.status === 'FAILED').length,
      recoveredDevices: devices.filter(d => d.status === 'COMPLETED' && d.error).length,
      errorTypes: {} as Record<string, number>,
      recoverySuccessRate: 0
    };

    // Calculate error types
    errors.forEach(error => {
      analysis.errorTypes[error.errorType] = (analysis.errorTypes[error.errorType] || 0) + 1;
    });

    // Calculate recovery success rate
    const totalFailed = analysis.failedDevices + analysis.recoveredDevices;
    if (totalFailed > 0) {
      analysis.recoverySuccessRate = (analysis.recoveredDevices / totalFailed) * 100;
    }

    return analysis;
  }
}

export const recoveryService = new RecoveryService();
