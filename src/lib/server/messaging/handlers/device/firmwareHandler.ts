import type { InMessage, RoutingMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { SystemUser } from '../../interfaces/message';

export async function handleFirmwareUpdate(message: InMessage): Promise<void> {
  const { userInfo, requestId, protocol, connectionId, scope } = message as any;
  const { deviceId, firmware, options } = ((message as any).payload ?? {}) as any;

  // Basic validation
  if (!userInfo?.id) {
    await publishAck(message, false, 'Unauthorized', 'Missing user context');
    return;
  }
  if (!deviceId || !firmware) {
    await publishAck(message, false, 'Validation Failed', 'deviceId and firmware are required');
    return;
  }
  if (!firmware.resourceId || !firmware.resourceName || typeof firmware.size !== 'number' || !firmware.path) {
    await publishAck(message, false, 'Validation Failed', 'Firmware fields missing (resourceId, resourceName, size, path)');
    return;
  }
  // Optional: scope consistency check
  try {
    const [kind, type, id] = scope?.split(':') || [];
    if (!(kind === 'subscription' && type === 'device' && id === deviceId)) {
      logger.warn(`[DeviceHandler] Scope/deviceId mismatch: scope=${scope}, deviceId=${deviceId}`);
    }
  } catch {}

  // Create initiated action log
  let logId: string | undefined;
  try {
    const created = await ActionLogger.createInitiated({
      deviceId,
      actionType: 'firmware_update',
      initiatedBy: userInfo.id,
      requestId,
      connectionId,
      protocol,
      metadata: {
        firmware: {
          resourceId: firmware.resourceId,
          resourceName: firmware.resourceName,
          packageName: firmware.packageName ?? null,
          sizeBytes: firmware.size,
          path: firmware.path,
          version: firmware.version ?? null,
          format: firmware.format ?? null
        },
        options: options ?? null
      },
      initialMessage: 'Queued firmware update dispatch'
    });
    logId = created.id;
  } catch (e: any) {
    logger.error(`[DeviceHandler] Failed to create action log: ${String(e)}`);
  }

  try {
    // If device is offline, immediately fail and notify
    try {
      const device = await (prisma as any).device.findUnique({ where: { id: deviceId }, select: { connected: true } });
      if (device && device.connected === false) {
        if (logId) {
          await ActionLogger.finalize(logId, 'failed', 'Device is offline');
        }
        // Publish a firmwareStatus event so UI updates immediately
        try {
          const routing = MessageFactory.createSystemMessage(
            'device:firmwareStatus',
            `subscription:device:${deviceId}`,
            {
              action: 'firmwareStatus',
              deviceId,
              status: 'failed',
              progress: 0,
              message: 'Device is offline',
              firmwareResourceId: firmware.resourceId,
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
        await publishAck(message, false, 'Device is offline', undefined, deviceId, firmware.resourceId);
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
      await ActionLogger.markInProgress(logId, 'Initiating firmware update…');
      // Schedule a timeout to mark as failed after 10 minutes if not completed
      setTimeout(async () => {
        try {
          const current = await (prisma as any).deviceActionLog.findUnique({ where: { id: logId }, select: { status: true } });
          if (!current) return;
          if (current.status === 'initiated' || current.status === 'in_progress') {
            await ActionLogger.finalize(logId as string, 'failed', 'Timed out after 10 minutes');
            try {
              const routing = MessageFactory.createSystemMessage(
                'device:firmwareStatus',
                `subscription:device:${deviceId}`,
                {
                  action: 'firmwareStatus',
                  deviceId,
                  status: 'failed',
                  message: 'Timed out after 10 minutes',
                  firmwareResourceId: firmware.resourceId,
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
          logger.warn(`[DeviceHandler] Failed to process firmware timeout for ${logId}: ${String(timeoutErr)}`);
        }
      }, 10 * 60 * 1000);
    }

    // Ack success to sender (echo via same scope subscriptions). No message needed (UI will toast)
    await publishAck(message, true, undefined, undefined, deviceId, firmware.resourceId);
  } catch (err: any) {
    logger.error(`[DeviceHandler] Firmware dispatch failed: ${String(err)}`);
    if (logId) {
      await ActionLogger.finalize(logId, 'failed', 'Dispatch failed', String(err?.message || err));
    }
    await publishAck(message, false, 'Dispatch Failed', String(err?.message || err));
  }
}

async function publishAck(
  base: InMessage,
  success: boolean,
  title?: string,
  details?: string,
  deviceId?: string,
  resourceId?: string
) {
  const payload: Record<string, unknown> = {
    action: 'updateFirmware',
    success,
    error: success ? undefined : title,
    details,
    deviceId,
    firmware: resourceId ? { resourceId } : undefined,
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
