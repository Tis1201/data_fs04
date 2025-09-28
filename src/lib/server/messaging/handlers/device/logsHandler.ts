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
    await publishLogsAck(message, false, 'Unauthorized', 'Missing user context', undefined, undefined);
    return;
  }
  if (!deviceId) {
    await publishLogsAck(message, false, 'Validation Failed', 'deviceId is required', undefined, undefined);
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
        await publishLogsAck(message, false, 'Device is offline', undefined, deviceId, undefined);
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
              
              // Also publish logsAck for real-time UI
              const timeoutMessage = {
                id: `timeout-${logId}`,
                type: 'device',
                scope: `subscription:device:${deviceId}`,
                payload: {
                  action: 'getLogs',
                  deviceId,
                  success: false,
                  message: 'Timed out after 5 minutes'
                },
                userInfo: { id: 'system', email: 'system@internal', name: 'System', systemRole: 'ADMIN', source: 'apiKey' },
                requestId: `timeout-${logId}`,
                protocol: 'system',
                connectionId: ''
              } as InMessage;
              await publishLogsAck(timeoutMessage, false, 'Timed out after 5 minutes', undefined, deviceId, 5 * 60 * 1000);
            } catch {}
          }
        } catch (timeoutErr) {
          logger.warn(`[DeviceHandler] Failed to process logs timeout for ${logId}: ${String(timeoutErr)}`);
        }
      }, 5 * 60 * 1000);
    }

    // Don't ack immediately - wait for device response
  } catch (err: any) {
    logger.error(`[DeviceHandler] Logs dispatch failed: ${String(err)}`);
    if (logId) {
      await ActionLogger.finalize(logId, 'failed', 'Dispatch failed', String(err?.message || err));
    }
    await publishLogsAck(message, false, 'Dispatch Failed', String(err?.message || err), undefined, undefined);
  }
}

export async function handleGetLogsResponse(message: InMessage): Promise<void> {
  const { userInfo, requestId, protocol, connectionId, scope } = message as any;
  const { deviceId, success, message: responseMessage, logs, logsData, format, durationMs, logId, chunkData, chunkIndex, chunkCount, totalSize, fileName } = ((message as any).payload ?? {}) as any;

  logger.info(`[DeviceHandler] Received logs response from device ${deviceId}: success=${success}, logId=${logId}, chunkData=${!!chunkData}`);

  try {
    // Find the original action log by requestId
    const originalLog = await (prisma as any).deviceActionLog.findFirst({
      where: { 
        requestId: requestId || (message as any).requestId,
        actionType: 'logs'
      },
      orderBy: { initiatedAt: 'desc' }
    });

    // Only process actual completion messages (with logs data or final success)
    // Ignore progress-only messages that don't have completion data
    const isCompletionMessage = success === true && (logs !== undefined || logsData !== undefined || responseMessage?.includes('completed'));
    const isProgressMessage = success === true && !isCompletionMessage;
    
    if (isProgressMessage) {
      logger.debug(`[DeviceHandler] Ignoring progress message for device ${deviceId}: ${responseMessage}`);
      return;
    }
    
    // Only process completion messages if we have an original log
    if (success === undefined && !originalLog) {
      logger.debug(`[DeviceHandler] Ignoring message without original action log for device ${deviceId}`);
      return;
    }

    // Forward streaming messages (metadata, chunks) to UI
    if (logId && (chunkData !== undefined || totalSize !== undefined)) {
      logger.info(`[DeviceHandler] Forwarding streaming message to UI: logId=${logId}, chunkIndex=${chunkIndex}, chunkCount=${chunkCount}`);
      
      // Forward the streaming message to the UI
      const streamingMessage = MessageFactory.createSystemMessage(
        'device',
        `subscription:device:${deviceId}`,
        {
          action: 'getLogs',
          deviceId,
          success: success || true,
          message: responseMessage || 'Streaming logs...',
          format: format || 'zip',
          logId: logId,
          chunkData: chunkData || null,
          chunkIndex: chunkIndex || null,
          chunkCount: chunkCount || null,
          totalSize: totalSize || null,
          fileName: fileName ? (() => {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
            return `device_logs_${dateStr}_${timeStr}.zip`;
          })() : null,
          requestId: requestId || (message as any).requestId,
          timestamp: new Date().toISOString()
        },
        SystemUser,
        { echoToSender: false }
      );
      await publisher.publish(streamingMessage);
      logger.info(`[DeviceHandler] Streaming message forwarded to UI`);
    }

    if (originalLog) {
      // Calculate duration if not provided
      const calculatedDurationMs = durationMs || (new Date().getTime() - new Date(originalLog.initiatedAt).getTime());
      
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
            durationMs: calculatedDurationMs,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(routing);
        
        // Also publish logsAck with duration for real-time UI
        await publishLogsAck(message, true, responseMessage || 'Logs retrieved successfully', undefined, deviceId, calculatedDurationMs);
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
            durationMs: calculatedDurationMs,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(routing);
        
        // Also publish logsAck with duration for real-time UI
        await publishLogsAck(message, false, responseMessage || 'Failed to retrieve logs', undefined, deviceId, calculatedDurationMs);
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
  deviceId?: string,
  durationMs?: number
) {
  const payload: Record<string, unknown> = {
    action: 'getLogs',
    success,
    error: success ? undefined : title,
    details,
    deviceId,
    durationMs: durationMs || null,
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
