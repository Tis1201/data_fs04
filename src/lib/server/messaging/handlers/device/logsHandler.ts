import type { InMessage, RoutingMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { SystemUser } from '../../interfaces/message';

export async function handleGetLogs(message: InMessage): Promise<void> {
  const { userInfo, requestId, protocol, connectionId, scope } = message as any;
  const { deviceId, format } = ((message as any).payload ?? {}) as any;

  // Basic validation
  if (!userInfo?.id) {
    await publishLogsAck(message, false, 'Unauthorized', 'Missing user context');
    return;
  }
  if (!deviceId) {
    await publishLogsAck(message, false, 'Validation Failed', 'deviceId is required');
    return;
  }

  // Create initiated action log
  let logId: string | undefined;
  try {
    const created = await ActionLogger.createInitiated({
      deviceId,
      actionType: 'logs',
      initiatedBy: userInfo.id,
      requestId,
      connectionId,
      protocol,
      metadata: {
        format: format || 'zip'
      },
      initialMessage: 'Requesting device logs'
    });
    logId = created.id;
  } catch (e: any) {
    logger.error(`[DeviceHandler] Failed to create logs action log: ${String(e)}`);
  }

  try {
    // If device is offline, immediately fail and notify
    try {
      const device = await (prisma as any).device.findUnique({ where: { id: deviceId }, select: { connected: true } });
      if (device && device.connected === false) {
        if (logId) {
          await ActionLogger.finalize(logId, 'failed', 'Device is offline');
        }
        // Publish a logsStatus event so UI updates immediately
        try {
          const routing = MessageFactory.createSystemMessage(
            'device:logsStatus',
            `subscription:device:${deviceId}`,
            {
              action: 'logsStatus',
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
        await publishLogsAck(message, false, 'Device is offline', undefined, deviceId);
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
    const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(messageWithLog);
    await publisher.publish(routingMessage);

    // Mark in-progress
    if (logId) {
      await ActionLogger.markInProgress(logId, 'Requesting logs from device…');
      // Schedule a timeout to mark as failed after 5 minutes if not completed
      setTimeout(async () => {
        try {
          const current = await (prisma as any).deviceActionLog.findUnique({ where: { id: logId }, select: { status: true } });
          if (!current) return;
          if (current.status === 'initiated' || current.status === 'in_progress') {
            await ActionLogger.finalize(logId as string, 'failed', 'Timed out after 5 minutes');
            try {
              const routing = MessageFactory.createSystemMessage(
                'device:logsStatus',
                `subscription:device:${deviceId}`,
                {
                  action: 'logsStatus',
                  deviceId,
                  status: 'failed',
                  message: 'Timed out after 5 minutes',
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
          logger.warn(`[DeviceHandler] Failed to process logs timeout for ${logId}: ${String(timeoutErr)}`);
        }
      }, 5 * 60 * 1000);
    }

    // Ack success to sender (echo via same scope subscriptions). No message needed (UI will toast)
    await publishLogsAck(message, true, undefined, undefined, deviceId);
  } catch (err: any) {
    logger.error(`[DeviceHandler] Logs dispatch failed: ${String(err)}`);
    if (logId) {
      await ActionLogger.finalize(logId, 'failed', 'Dispatch failed', String(err?.message || err));
    }
    await publishLogsAck(message, false, 'Dispatch Failed', String(err?.message || err));
  }
}

export async function handleGetLogsResponse(message: InMessage): Promise<void> {
  const { userInfo, requestId, protocol, connectionId, scope } = message as any;
  const { deviceId, success, message: responseMessage, logs, logsData, format, durationMs } = ((message as any).payload ?? {}) as any;

  logger.info(`[DeviceHandler] Received logs response from device ${deviceId}: success=${success}`);

  try {
    // Find the original action log by requestId
    const originalLog = await (prisma as any).deviceActionLog.findFirst({
      where: { 
        requestId: requestId || (message as any).requestId,
        actionType: 'logs'
      },
      orderBy: { initiatedAt: 'desc' }
    });

    if (originalLog) {
      if (success) {
        await ActionLogger.finalize(originalLog.id, 'success', responseMessage || 'Logs retrieved successfully');
        
        // Publish success status to UI
        const routing = MessageFactory.createSystemMessage(
          'device:logsStatus',
          `subscription:device:${deviceId}`,
          {
            action: 'logsStatus',
            deviceId,
            status: 'success',
            message: responseMessage || 'Logs retrieved successfully',
            format: format || 'text',
            logs: logs || [],
            logsData: logsData || null,
            logId: originalLog.id,
            durationMs: durationMs || null,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(routing);
      } else {
        await ActionLogger.finalize(originalLog.id, 'failed', responseMessage || 'Failed to retrieve logs');
        
        // Publish failure status to UI
        const routing = MessageFactory.createSystemMessage(
          'device:logsStatus',
          `subscription:device:${deviceId}`,
          {
            action: 'logsStatus',
            deviceId,
            status: 'failed',
            message: responseMessage || 'Failed to retrieve logs',
            error: 'device_error',
            logId: originalLog.id,
            durationMs: durationMs || null,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(routing);
      }
    } else {
      logger.warn(`[DeviceHandler] No original log found for requestId: ${requestId || (message as any).requestId}`);
    }

    // Send a direct response back to the original request (for sendRequest)
    if (originalLog && originalLog.connectionId) {
      logger.info(`[DeviceHandler] Sending direct response to connection: ${originalLog.connectionId}`);
      const directResponsePayload = {
        action: 'getLogs',
        deviceId,
        success: success,
        message: responseMessage || (success ? 'Logs generated successfully' : 'Failed to generate logs'),
        format: format || 'zip',
        logsData: logsData || null,
        logs: logs || [],
        requestId: requestId || (message as any).requestId,
        logId: originalLog.id,
        durationMs: durationMs || null,
        timestamp: new Date().toISOString()
      };
      logger.info(`[DeviceHandler] Direct response payload:`, directResponsePayload);
      
      const directResponse = MessageFactory.createSystemMessage(
        'device:response',
        `connection:${originalLog.connectionId}`,
        directResponsePayload,
        SystemUser,
        { echoToSender: true }
      );
      await publisher.publish(directResponse);
      logger.info(`[DeviceHandler] Direct response sent successfully`);
    } else {
      logger.warn(`[DeviceHandler] Cannot send direct response: originalLog=${!!originalLog}, connectionId=${originalLog?.connectionId}`);
    }

    // Don't echo the response back to the device - the device doesn't need to receive its own response
    // The logsStatus message above already notifies the web UI

  } catch (err: any) {
    logger.error(`[DeviceHandler] Failed to process logs response: ${String(err)}`);
  }
}

async function publishLogsAck(
  base: InMessage,
  success: boolean,
  title?: string,
  details?: string,
  deviceId?: string
) {
  const payload: Record<string, unknown> = {
    action: 'getLogs',
    success,
    error: success ? undefined : title,
    details,
    deviceId,
    timestamp: new Date().toISOString()
  };

  if (title) {
    (payload as any).message = title;
  }

  const ack = MessageFactory.toRoutingMessage({
    ...base,
    type: 'device',
    requestId: base.requestId,
    payload
  } as InMessage, {
    systemGenerated: true,
    echoToSender: true,
    // Route directly back to the sender's connection so the client receives the ack
    scope: base.connectionId ? `connection:${base.connectionId}` : base.scope
  });

  await publisher.publish(ack);
}
