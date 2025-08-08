import type { InMessage, RoutingMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { MessageFactory } from '../interfaces/message';
import { publisher } from '../core/publisher';
import { logger } from '$lib/server/logger';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { messageHandler } from './messageHandler';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { SystemUser } from '../interfaces/message';

export const deviceHandler: Handler = {
  supports(type: string): boolean {
    return type === 'device';
  },

  async handle(message: InMessage): Promise<void> {
    const { payload } = message;
    const { action } = payload;

    // Compact, structured logging instead of dumping whole message
    logger.debug('[DeviceHandler] Received message', {
      action,
      payloadType: (payload as any)?.type,
      deviceId: (payload as any)?.deviceId,
      requestId: (message as any)?.requestId,
      connectionId: (message as any)?.connectionId,
      protocol: (message as any)?.protocol,
    });

    switch (action) {
      case 'claim':
        await handleClaim(message);
        break;
      case 'register':
        await handleRegistration(message);
        break;
      case 'status':
        await handleStatusUpdate(message);
        break;
      case 'updateFirmware':
        await handleFirmwareUpdate(message);
        break;
      case 'message':
        await handleDeviceMessage(message);
        break;
      default:
        logger.warn(`[DeviceHandler] Unhandled device action: ${action}`);
    }
  },
};

// Private function expressions
function computeEchoSettings(base: InMessage, isResponse: boolean, isConnectionScoped: boolean) {
  const scopeStr = String((base as any)?.scope || '');
  const echo = isResponse || isConnectionScoped;
  const senderConn = (base as any)?.senderConnectionId
    || (base as any)?.connectionId
    || (scopeStr.startsWith('connection:') ? scopeStr.split(':')[1] : undefined);
  return echo ? { echoToSender: true, senderConnectionId: senderConn } : {};
}

async function publishDeviceStatus(topic: 'snapshot' | 'terminal', deviceId: string, data: Record<string, unknown>) {
  const type = topic === 'snapshot' ? 'device:snapshotStatus' : 'device:terminalStatus';
  const payload = topic === 'snapshot' ? { action: 'snapshotStatus', ...data } : { action: 'terminalStatus', ...data };
  const routing = MessageFactory.createSystemMessage(
    type,
    `subscription:device:${deviceId}`,
    payload,
    SystemUser,
    { echoToSender: false }
  );
  await publisher.publish(routing);
}

async function handleDeviceMessage(message: InMessage): Promise<void> {
  const payload: any = (message as any).payload || {};
  const type: string = payload.type || '';
  const isKnown = typeof type === 'string' && (type.startsWith('webrtc:') || type.startsWith('screenshot:') || type.startsWith('terminal:'));
  if (!isKnown) {
    logger.info(`[DeviceHandler] Delegating to messageHandler for non-WebRTC/screenshot message`);
    await messageHandler.handle(message);
    return;
  }

  logger.info(`[DeviceHandler] Handling ${type.split(':')[0]} message: ${type}`);

  const isResponse = type.endsWith(':response');
  const isConnScoped = String((message as any)?.scope || '').startsWith('connection:') && type.startsWith('webrtc:');
  const overrides: any = { systemGenerated: true, sudo: true, ...computeEchoSettings(message, isResponse, isConnScoped) };

  // Terminal: begin action on connect, handle offline + timeout
  if (type === 'webrtc:connect') {
    try {
      const deviceId = payload?.deviceId as string | undefined;
      const connId = (message as any).connectionId as string | undefined;
      const prot = (message as any).protocol as any;
      if (deviceId) {
        const created = await ActionLogger.createInitiated({
          deviceId,
          actionType: 'terminal',
          initiatedBy: message.userInfo.id,
          requestId: message.requestId,
          connectionId: connId,
          protocol: prot,
          initialMessage: 'Opening terminal…'
        });
        await ActionLogger.markInProgress(created.id, 'Connecting to terminal…');

        // offline fast-fail
        try {
          const device = await (prisma as any).device.findUnique({ where: { id: deviceId }, select: { connected: true } });
          if (device && device.connected === false) {
            const fin = await ActionLogger.finalize(created.id, 'failed', 'Device is offline', 'offline');
            await publishDeviceStatus('terminal', deviceId, {
              deviceId,
              status: 'failed',
              message: 'Device is offline',
              logId: fin?.id ?? created.id,
              completedAt: fin?.completedAt,
              durationMs: fin?.durationMs,
              timestamp: new Date().toISOString()
            });
          }
        } catch {}

        // 3-minute timeout
        setTimeout(async () => {
          try {
            const current = await (prisma as any).deviceActionLog.findUnique({ where: { id: created.id }, select: { status: true } });
            if (!current) return;
            if (current.status === 'initiated' || current.status === 'in_progress') {
              const finTO = await ActionLogger.finalize(created.id, 'failed', 'Timed out after 3 minutes');
              await publishDeviceStatus('terminal', deviceId, {
                deviceId,
                status: 'failed',
                message: 'Timed out after 3 minutes',
                logId: finTO?.id ?? created.id,
                completedAt: finTO?.completedAt,
                durationMs: finTO?.durationMs,
                timestamp: new Date().toISOString()
              });
            }
          } catch (timeoutErr) {
            logger.warn(`[DeviceHandler] Failed to process terminal timeout for ${created.id}: ${String(timeoutErr)}`);
          }
        }, 3 * 60 * 1000);
      }
    } catch (e: any) {
      logger.warn(`[DeviceHandler] Failed to create terminal action log: ${String(e)}`);
    }
  }

  // Snapshot: begin action on request
  if (type === 'screenshot:request') {
    try {
      const connId = (message as any).connectionId as string | undefined;
      const prot = (message as any).protocol as any;
      const deviceId = payload?.deviceId as string | undefined;
      const created = await ActionLogger.createInitiated({
        deviceId: deviceId || 'unknown',
        actionType: 'snapshot',
        initiatedBy: message.userInfo.id,
        requestId: message.requestId,
        connectionId: connId,
        protocol: prot,
        metadata: { quality: payload?.quality ?? null },
        initialMessage: 'Initiating device snapshot'
      });
      await ActionLogger.markInProgress(created.id, 'Capturing screenshot…');
    } catch (e: any) {
      logger.warn(`[DeviceHandler] Failed to create snapshot action log: ${String(e)}`);
    }
  }

  const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(message, overrides);
  await publisher.publish(routingMessage);

  // Snapshot finalize
  if (type === 'screenshot:response') {
    try {
      const deviceId = payload?.deviceId as string | undefined;
      const hasImage = !!payload?.image;
      const updated = await ActionLogger.finalizeByRequestId(
        deviceId || 'unknown',
        message.requestId || '',
        hasImage ? 'success' : 'failed',
        hasImage ? 'Snapshot received' : 'Snapshot response missing image',
        hasImage ? undefined : 'No image'
      );
      await publishDeviceStatus('snapshot', deviceId!, {
        deviceId,
        status: hasImage ? 'success' : 'failed',
        message: hasImage ? 'Snapshot received' : 'Snapshot response missing image',
        requestId: message.requestId,
        logId: updated?.id,
        completedAt: updated?.completedAt,
        durationMs: updated?.durationMs
      });
    } catch (e: any) {
      logger.warn(`[DeviceHandler] Failed to finalize snapshot action log: ${String(e)}`);
    }
  }

  // Terminal success
  if (type === 'terminal:connected') {
    try {
      const deviceId = payload?.deviceId as string | undefined;
      // finalize last in-progress terminal action if present (avoid duplicate create)
      try {
        const updated = await (prisma as any).deviceActionLog.findFirst({
          where: { deviceId, actionType: 'terminal', OR: [{ status: 'initiated' }, { status: 'in_progress' }] },
          orderBy: { initiatedAt: 'desc' },
          select: { id: true }
        });
        if (updated?.id) {
          const fin = await ActionLogger.finalize(updated.id, 'success', 'Terminal session established');
          await publishDeviceStatus('terminal', deviceId!, {
            deviceId,
            status: 'success',
            message: 'Terminal session established',
            logId: fin?.id ?? updated.id,
            completedAt: fin?.completedAt,
            durationMs: fin?.durationMs,
            timestamp: new Date().toISOString()
          });
          return;
        }
      } catch {}

      // Fallback: create and finalize if none in progress
      const created = await ActionLogger.createInitiated({
        deviceId: deviceId || 'unknown',
        actionType: 'terminal',
        initiatedBy: message.userInfo.id,
        connectionId: (message as any).senderConnectionId || (message as any).connectionId,
        protocol: (message as any).protocol,
        initialMessage: 'Opening terminal'
      });
      await ActionLogger.markInProgress(created.id, 'Terminal connected');
      const fin = await ActionLogger.finalize(created.id, 'success', 'Terminal session established');
      await publishDeviceStatus('terminal', deviceId!, {
        deviceId,
        status: 'success',
        message: 'Terminal session established',
        logId: fin?.id ?? created.id,
        completedAt: fin?.completedAt,
        durationMs: fin?.durationMs,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      logger.warn(`[DeviceHandler] Failed to log terminal connected: ${String(e)}`);
    }
  }
}
async function handleClaim(message: InMessage): Promise<void> {
  const { payload, userInfo } = message;
  const pin = ((payload as any)?.pin ?? '') as string;

  try {
    if (!userInfo?.id) {
      throw new Error('Authentication Required');
    }

    if (!pin || typeof pin !== 'string') {
      throw new Error('PIN is required');
    }

    logger.info(`[DeviceHandler] User ${userInfo.id} attempting to claim device with PIN: ${pin}`);

    
    // Claim the device using the device manager
    // Pass the WebSocket connection ID and protocol from the client
    const accId = (message as any).accountId as string | undefined;
    const connId = (message as any).connectionId as string | undefined;
    const prot = (message as any).protocol as any;
    const device = await DeviceManager.claimDevice(pin, userInfo, accId as any, connId as any, prot as any);

    if (!device) {
      const errorMessage = 'The PIN you entered doesn\'t match any available device. Please verify the 6-digit PIN and try again.';
      logger.warn(`[DeviceHandler] No device found with PIN ${pin}`);
      
      const errorResponse = MessageFactory.toRoutingMessage({
        ...message,
        type: 'device',
        payload: {
          action: 'error',
          success: false,
          error: 'Verification Failed',
          details: errorMessage,
          code: 'INVALID_PIN',
          requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
          timestamp: new Date().toISOString()
        }
      } as InMessage);

      await publisher.publish(errorResponse);
      return;
    }

    logger.info(`[DeviceHandler] Device registered, next step wait for device to connect: ${device.id} by user ${userInfo.id}`);

    // Send success response to the client with the original requestId
    const successResponse = MessageFactory.toRoutingMessage({
      ...message,
      type: 'device',
      requestId: message.requestId, // Preserve the original requestId for client promise resolution
      payload: {
        action: 'claim',
        success: true,
        message: {
          type: 'success',
          text: 'Device claimed successfully!',
          timestamp: new Date().toISOString()
        },
        device: {
          id: device.id,
          name: device.name,
          deviceType: device.deviceType,
          status: device.status
        },
        timestamp: new Date().toISOString()
      }
    } as InMessage, {
      systemGenerated: true,
      echoToSender: true
    });

    await publisher.publish(successResponse);

  } catch (error:any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[DeviceHandler] Device claim failed:`, { error: errorMessage });
    
    // Send error response with the original requestId
    const errorResponse = MessageFactory.toRoutingMessage({
      ...message,
      type: 'device',
      requestId: message.requestId, // Preserve the original requestId for client promise resolution
      payload: {
        action: 'claim',
        success: false,
        error: 'Claim Failed',
        details: errorMessage,
        code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      }
    } as InMessage, {
      systemGenerated: true,
      echoToSender: true
    });

    await publisher.publish(errorResponse);
  }
}

async function handleRegistration(message: InMessage): Promise<void> {
  const { payload, userInfo } = message;
  const { deviceId, pin, deviceInfo } = payload;

  try {
    // TODO: Validate device registration
    // - Verify PIN is valid and not expired
    // - Check if device is already registered
    // - Create/update device record in database

    const response = MessageFactory.toRoutingMessage({
      ...message,
      type: 'device:registered',
      payload: {
        action: 'registered',
        deviceId,
        timestamp: new Date().toISOString()
        // Add any additional registration response data
      }
    } as InMessage);

    // Send response back to device
    await publisher.publish(response);

    // Notify admin UI about new device registration
    if (userInfo?.id) {
      const adminNotification = MessageFactory.toRoutingMessage({
        ...message,
        type: 'device:registered',
        payload: {
          action: 'device:registered',
          deviceId,
          deviceInfo,
          timestamp: new Date().toISOString()
        }
      } as InMessage);
      
      await publisher.publish(adminNotification);
    }

    logger.info(`[DeviceHandler] Device registered: ${deviceId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[DeviceHandler] Registration failed for device ${deviceId}:`, { error: errorMessage });
    
    // Send error response
    const errorResponse = MessageFactory.toRoutingMessage({
      ...message,
      type: 'device:register_error',
      payload: {
        action: 'device:register_error',
        success: false,
        error: 'Registration Failed',
        details: errorMessage,
        code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
        timestamp: new Date().toISOString()
      }
    } as InMessage);

    await publisher.publish(errorResponse);
  }
}

async function handleStatusUpdate(message: InMessage): Promise<void> {
  const { deviceId, status } = message.payload as any;
  logger.info(`[DeviceHandler] Status update from ${deviceId}:`, { status });

  // TODO: Update device status in database
  // TODO: Notify relevant users about status change
}

async function handleFirmwareUpdate(message: InMessage): Promise<void> {
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



