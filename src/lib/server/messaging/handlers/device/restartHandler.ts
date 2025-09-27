import type { InMessage, RoutingMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { SystemUser } from '../../interfaces/message';

export async function handleRestart(message: InMessage): Promise<void> {
  const { userInfo, requestId, protocol, connectionId, scope } = message as any;
  const { deviceId } = ((message as any).payload ?? {}) as any;

  // Basic validation
  if (!userInfo?.id) {
    await publishRestartAck(message, false, 'Unauthorized', 'Missing user context');
    return;
  }
  if (!deviceId) {
    await publishRestartAck(message, false, 'Validation Failed', 'deviceId is required');
    return;
  }

  // Create initiated action log
  let logId: string | undefined;
  try {
    const created = await ActionLogger.createInitiated({
      deviceId,
      actionType: 'restart',
      initiatedBy: userInfo.id,
      requestId,
      connectionId,
      protocol,
      metadata: {},
      initialMessage: 'Initiating device restart'
    });
    logId = created.id;
  } catch (e: any) {
    logger.error(`[DeviceHandler] Failed to create restart action log: ${String(e)}`);
  }

  try {
    // If device is offline, immediately fail and notify
    try {
      const device = await (prisma as any).device.findUnique({ where: { id: deviceId }, select: { connected: true } });
      if (device && device.connected === false) {
        if (logId) {
          await ActionLogger.finalize(logId, 'failed', 'Device is offline');
        }
        // Publish a restartStatus event so UI updates immediately
        try {
          const routing = MessageFactory.createSystemMessage(
            'device:restartStatus',
            `subscription:device:${deviceId}`,
            {
              action: 'restartStatus',
              deviceId,
              status: 'failed',
              message: 'Device is offline',
              error: 'offline',
              logId,
              timestamp: new Date().toISOString()
            },
            SystemUser,
            { echoToSender: false }
          );
          await publisher.publish(routing);
        } catch {}
        // Ack failure back to initiator
        await publishRestartAck(message, false, 'Device is offline', undefined, deviceId);
        return;
      }
    } catch (checkErr) {
      logger.warn(`[DeviceHandler] Device online check failed: ${String(checkErr)}`);
    }

    // Dispatch to device subscribers
    // Include logId in payload so the device can report status against the same log
    const messageWithLog: InMessage = {
      ...(message as InMessage),
      payload: {
        ...((message as any).payload ?? {}),
        logId
      }
    } as InMessage;
    const routingMessage: RoutingMessage = (messageWithLog);
    await publisher.publish(routingMessage);

    // Mark in-progress
    if (logId) {
      await ActionLogger.markInProgress(logId, 'Sending restart command to device…');
      // Schedule a timeout to mark as failed after 2 minutes if not completed
      setTimeout(async () => {
        try {
          const current = await (prisma as any).deviceActionLog.findUnique({ where: { id: logId }, select: { status: true } });
          if (!current) return;
          if (current.status === 'initiated' || current.status === 'in_progress') {
            await ActionLogger.finalize(logId as string, 'failed', 'Timed out after 2 minutes');
            try {
              const routing = MessageFactory.createSystemMessage(
                'device:restartStatus',
                `subscription:device:${deviceId}`,
                {
                  action: 'restartStatus',
                  deviceId,
                  status: 'failed',
                  message: 'Timed out after 2 minutes',
                  logId,
                  timestamp: new Date().toISOString()
                },
                SystemUser,
                { echoToSender: false }
              );
              await publisher.publish(routing);
            } catch {}
          }
        } catch (timeoutErr) {
          logger.warn(`[DeviceHandler] Failed to process restart timeout for ${logId}: ${String(timeoutErr)}`);
        }
      }, 2 * 60 * 1000);
    }

    // Ack success to sender (echo via same scope subscriptions). No message needed (UI will toast)
    await publishRestartAck(message, true, undefined, undefined, deviceId);
  } catch (err: any) {
    logger.error(`[DeviceHandler] Restart dispatch failed: ${String(err)}`);
    if (logId) {
      await ActionLogger.finalize(logId, 'failed', 'Dispatch failed', String(err?.message || err));
    }
    await publishRestartAck(message, false, 'Dispatch Failed', String(err?.message || err));
  }
}

export async function handleRestartResponse(message: InMessage): Promise<void> {
  const { userInfo, requestId, protocol, connectionId, scope } = message as any;
  const { deviceId, success, message: responseMessage, durationMs } = ((message as any).payload ?? {}) as any;

  logger.info(`[DeviceHandler] Received restart response from device ${deviceId}: success=${success}`);

  try {
    // Find the original action log by requestId
    const originalLog = await (prisma as any).deviceActionLog.findFirst({
      where: { 
        requestId: requestId || (message as any).requestId,
        actionType: 'restart'
      },
      orderBy: { initiatedAt: 'desc' }
    });

    if (originalLog) {
      if (success) {
        await ActionLogger.finalize(originalLog.id, 'success', responseMessage || 'Device restart completed successfully');
        
        // Publish success status to UI
        const routing = MessageFactory.createSystemMessage(
          'device:restartStatus',
          `subscription:device:${deviceId}`,
          {
            action: 'restartStatus',
            deviceId,
            status: 'success',
            message: responseMessage || 'Device restart completed successfully',
            logId: originalLog.id,
            durationMs: durationMs || null,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(routing);
      } else {
        await ActionLogger.finalize(originalLog.id, 'failed', responseMessage || 'Device restart failed');
        
        // Publish failure status to UI
        const routing = MessageFactory.createSystemMessage(
          'device:restartStatus',
          `subscription:device:${deviceId}`,
          {
            action: 'restartStatus',
            deviceId,
            status: 'failed',
            message: responseMessage || 'Device restart failed',
            logId: originalLog.id,
            durationMs: durationMs || null,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(routing);
      }
    }
  } catch (err: any) {
    logger.error(`[DeviceHandler] Failed to process restart response: ${String(err)}`);
  }
}

async function publishRestartAck(
  message: InMessage, 
  success: boolean, 
  error?: string, 
  messageText?: string, 
  deviceId?: string
): Promise<void> {
  try {
    const routing = MessageFactory.createSystemMessage(
      'device:restartAck',
      message.scope,
      {
        action: 'restartAck',
        deviceId: deviceId || (message.payload as any)?.deviceId,
        success,
        error,
        message: messageText,
        timestamp: new Date().toISOString()
      },
      SystemUser,
      { echoToSender: true }
    );
    await publisher.publish(routing);
  } catch (err: any) {
    logger.error(`[DeviceHandler] Failed to publish restart ack: ${String(err)}`);
  }
}
