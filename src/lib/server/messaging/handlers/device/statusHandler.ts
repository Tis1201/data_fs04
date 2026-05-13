import type { InMessage } from '../../interfaces/message';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { publisher } from '../../core/publisher';
import { MessageFactory, SystemUser } from '../../interfaces/message';

export async function handleStatusUpdate(message: InMessage): Promise<void> {
  const { deviceId, logId, action, status, message: statusMessage, progress } = message.payload as any;
  
  logger.info(`[StatusHandler] Device status update from ${deviceId}:`, { 
    action, 
    status, 
    logId,
    progress 
  });

  try {
    let durationMs: number | null = null;
    
    // Update action log if logId is provided
    if (logId) {
      if (status === 'complete' || status === 'success') {
        const updated = await ActionLogger.finalize(logId, 'success', statusMessage || `${action} completed successfully`);
        durationMs = updated.durationMs;
      } else if (status === 'failed' || status === 'error') {
        const updated = await ActionLogger.finalize(logId, 'failed', statusMessage || `${action} failed`);
        durationMs = updated.durationMs;
      } else if (status === 'in_progress') {
        await ActionLogger.markInProgress(logId, statusMessage || `${action} in progress`);
      }
    }

    // Publish unified status update to frontend
    await publishDeviceStatusUpdate(deviceId, {
      action,
      logId,
      status,
      message: statusMessage,
      progress,
      durationMs,
      timestamp: new Date().toISOString()
    });

    logger.info(`[StatusHandler] Published status update for device ${deviceId}, action ${action}, status ${status}`);
  } catch (error) {
    logger.error(`[StatusHandler] Error processing status update: ${String(error)}`);
  }
}

async function publishDeviceStatusUpdate(deviceId: string, statusData: any): Promise<void> {
  try {
    const routing = MessageFactory.createSystemMessage(
      'device:statusUpdate',
      `subscription:device:${deviceId}`,
      statusData,
      SystemUser,
      { echoToSender: false }
    );
    await publisher.publish(routing);
  } catch (err) {
    logger.error(`[StatusHandler] Failed to publish device status update: ${String(err)}`);
  }
}
