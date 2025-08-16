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
import { sseService } from '$lib/server/sse/sseService';

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
    case 'bundleStatus':
      await handleBundleStatus(message);
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
  // Ensure outgoing message has a valid scope. Default to this device's subscription channel if missing.
  const deviceIdForScope = (payload as any)?.deviceId as string | undefined;
  const defaultScope = (message as any)?.scope
    || (deviceIdForScope ? `subscription:device:${deviceIdForScope}` : `user:${message.userInfo.id}`);
  const overrides: any = { systemGenerated: true, sudo: true, scope: defaultScope, ...computeEchoSettings(message, isResponse, isConnScoped) };

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

async function handleBundleStatus(message: InMessage): Promise<void> {
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
      await sseService.broadcast({
        type: 'device:bundleStatus',
        scope: `subscription:device:${deviceId}`,
        payload: { deviceId, waveId, status, progress }
      } as any);
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

    // Broadcast wave status change to UI
    try {
      const waveStatusMsg = MessageFactory.createSystemMessage(
        'bundle:waveStatus',
        `subscription:bundle:${(targetProgress as any).bundleId}`,
        { 
          action: 'waveStatus', 
          bundleId: (targetProgress as any).bundleId, 
          waveId,
          status: waveStatus,
          devicesTotal,
          devicesCompleted,
          devicesFailed,
          progress: waveProgress,
          endTime: waveStatus !== 'IN_PROGRESS' ? new Date().toISOString() : undefined
        },
              SystemUser,
              { echoToSender: false }
            );
      await publisher.publish(waveStatusMsg);
      logger.info(`[WaveStatus] Broadcasted wave status update for wave ${waveId}: ${waveStatus}`);
    } catch (broadcastErr: any) {
      logger.warn(`[WaveStatus] Failed to broadcast wave status: ${broadcastErr?.message || String(broadcastErr)}`);
    }

    // If wave reached terminal status (completed or failed), try to start the next wave automatically
    if (waveStatus === 'COMPLETED' || waveStatus === 'FAILED') {
      const bundleId: string = (targetProgress as any).bundleId;
      logger.info(`[AutoStart] Wave ${waveId} reached terminal status: ${waveStatus}, attempting to start next wave for bundle ${bundleId}`);
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

    // Broadcast to UI via messaging pipeline
    const routing = MessageFactory.createSystemMessage(
      'device:bundleStatus',
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
        devicesFailed
      },
      SystemUser,
      { echoToSender: false }
    );
    await publisher.publish(routing);
  } catch (e: any) {
    logger.warn(`[DeviceHandler] Failed to process bundleStatus: ${String(e?.message || e)}`);
  }
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

// Helper function to update bundle status based on wave states
async function updateBundleStatus(bundleId: string) {
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
      
      // Broadcast status update for terminal states
      if (bundleStatus === 'COMPLETED' || bundleStatus === 'FAILED' || bundleStatus === 'CANCELLED') {
        try {
          const routing = MessageFactory.createSystemMessage(
            'bundle:status',
            `subscription:bundle:${bundleId}`,
            { 
              action: 'bundleStatus', 
              bundleId, 
              status: bundleStatus,
              reason,
              waveCounts
            },
            SystemUser,
            { echoToSender: false }
          );
          await publisher.publish(routing);
          logger.info(`[BundleStatus] Broadcasted bundle status update: ${bundleStatus} (${reason})`);
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
        
        // Broadcast wave status update to UI
        try {
          const waveStatusMsg = MessageFactory.createSystemMessage(
            'bundle:waveStatus',
            `subscription:bundle:${bundleId}`,
            { 
              action: 'waveStatus', 
              bundleId, 
              waveId: nextWave.id,
              status: 'IN_PROGRESS',
              startTime: new Date().toISOString()
            },
            SystemUser,
            { echoToSender: false }
          );
          await publisher.publish(waveStatusMsg);
          logger.info(`[AutoStart] Broadcasted wave status update for wave ${nextWave.id}`);
        } catch (broadcastErr: any) {
          logger.warn(`[AutoStart] Failed to broadcast wave status: ${broadcastErr?.message || String(broadcastErr)}`);
        }
        
        // Send install commands to devices in the next wave
        const nextWaveProgresses = await (prisma as any).bundleDeviceProgress.findMany({
          where: { bundleId, waveId: nextWave.id },
          include: { bundleDevice: true }
        });
        
        const bundle = await (prisma as any).bundle.findUnique({
          where: { id: bundleId },
          include: { 
            apps: { 
              include: { resource: true }, 
              orderBy: { order: 'asc' } 
            } 
          }
        });
        
        for (const prog of nextWaveProgresses) {
          const deviceId = prog.bundleDevice.deviceId;
          
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
          
          try {
            logger.info(`[AutoStart] Sending bundle_install command to device ${deviceId} for wave ${nextWave.id}`);
            logger.info(`[AutoStart] Command details:`, {
              sessionId: command.sessionId,
              batchId: command.batchId,
              deviceId: command.deviceId,
              bundlesCount: command.bundles.length,
              appsCount: command.bundles[0]?.apps?.length || 0,
              options: command.options,
              apps: command.bundles[0]?.apps?.map((app: any) => ({
                name: app.name,
                path: app.path,
                format: app.format,
                size: app.size,
                autoOpen: app.autoOpen
              }))
            });
            
            // Check if device is online first
            const device = await (prisma as any).device.findUnique({ 
              where: { id: deviceId }, 
              select: { connected: true, name: true } 
            });
            
            if (!device) {
              logger.warn(`[AutoStart] Device ${deviceId} not found in database`);
              continue;
            }
            
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
            
            try {
              logger.info(`[AutoStart] Sending bundle_install command to device ${deviceId} for wave ${nextWave.id}`);
              logger.info(`[AutoStart] Command details:`, {
                sessionId: command.sessionId,
                batchId: command.batchId,
                deviceId: command.deviceId,
                bundlesCount: command.bundles.length,
                appsCount: command.bundles[0]?.apps?.length || 0,
                options: command.options,
                apps: command.bundles[0]?.apps?.map((app: any) => ({
                  name: app.name,
                  path: app.path,
                  format: app.format,
                  size: app.size,
                  autoOpen: app.autoOpen
                }))
              });
              
              // Use the same messaging system as manual publish
              const routing = MessageFactory.createSystemMessage('device', `subscription:device:${deviceId}`, command, SystemUser, { echoToSender: false });
              await publisher.publish(routing);
              
              logger.info(`[AutoStart] Successfully sent bundle_install command to device ${deviceId} (${device.name})`);
            } catch (sseErr: any) {
              logger.warn(`[AutoStart] Failed to send bundle_install to device ${deviceId} for wave ${nextWave.id}: ${sseErr?.message || String(sseErr)}`);
            }
            
            // Set up timeout for this device progress (5 minutes per app)
            const bundleApps = await (prisma as any).bundleApp.findMany({
              where: { bundleId },
              select: { id: true }
            });
            const numApps = bundleApps.length;
            const timeoutMs = numApps * 1 * 60 * 1000; // 1 minute per app (as you changed it)
            
            logger.info(`[AutoStart] Set up ${timeoutMs}ms timeout for device ${deviceId} in wave ${nextWave.id} (${numApps} apps)`);
            
            setTimeout(async () => {
              try {
                const current = await (prisma as any).bundleDeviceProgress.findUnique({ 
                  where: { id: prog.id } 
                });
                if (!current) return;
                
                if (current.status === 'PENDING' || current.status === 'IN_PROGRESS') {
                  // Mark this device as failed due to timeout
                  await (prisma as any).bundleDeviceProgress.update({ 
                    where: { id: current.id }, 
                    data: { 
                      status: 'FAILED', 
                      completedAt: new Date(), 
                      errorDetails: 'timeout' 
                    } 
                  });
                  
                  // Recompute wave status after timeout
                  const allForWave = await (prisma as any).bundleDeviceProgress.findMany({ 
                    where: { waveId: nextWave.id } 
                  });
                  const devicesTotal = allForWave.length;
                  const devicesCompleted = allForWave.filter((r: any) => r.status === 'COMPLETED').length;
                  const devicesFailed = allForWave.filter((r: any) => r.status === 'FAILED').length;
                  const waveProgress = devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0;
                  const waveStatus = devicesCompleted + devicesFailed >= devicesTotal && devicesTotal > 0 
                    ? (devicesFailed > 0 ? 'FAILED' : 'COMPLETED') 
                    : 'IN_PROGRESS';
                  
                  await (prisma as any).bundleWave.update({ 
                    where: { id: nextWave.id }, 
                    data: { 
                      status: waveStatus, 
                      endTime: waveStatus !== 'IN_PROGRESS' ? new Date() : undefined 
                    } 
                  });
                  
                  // Recompute bundle status after wave status change
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
                      
                      // Determine bundle status with priority order
                      let bundleStatus;
                      if (anyInProgress) {
                        bundleStatus = 'IN_PROGRESS';
                      } else if (anyFailed) {
                        bundleStatus = 'FAILED';
                      } else if (anyCancelled && allTerminal) {
                        bundleStatus = 'CANCELLED';
                      } else if (allCompleted) {
                        bundleStatus = 'COMPLETED';
                      } else if (anyPending) {
                        bundleStatus = 'PUBLISHED';
                      } else {
                        bundleStatus = 'PUBLISHED';
                      }
                      
                      await (prisma as any).bundle.update({ where: { id: bundleId }, data: { status: bundleStatus } });
                      logger.info(`[Timeout] Updated bundle ${bundleId} status to: ${bundleStatus}`);
                      
                      // Broadcast bundle status update
                      if (bundleStatus === 'COMPLETED' || bundleStatus === 'FAILED' || bundleStatus === 'CANCELLED') {
                        try {
                          const bundleStatusMsg = MessageFactory.createSystemMessage(
                            'bundle:status',
                            `subscription:bundle:${bundleId}`,
                            { 
                              action: 'bundleStatus', 
                              bundleId, 
                              status: bundleStatus,
                              waveCounts
                            },
                            SystemUser,
                            { echoToSender: false }
                          );
                          await publisher.publish(bundleStatusMsg);
                          logger.info(`[Timeout] Broadcasted bundle status update: ${bundleStatus}`);
                        } catch (bundleBroadcastErr: any) {
                          logger.warn(`[Timeout] Failed to broadcast bundle status: ${bundleBroadcastErr?.message || String(bundleBroadcastErr)}`);
                        }
                      }
                    }
                  } catch (bundleErr: any) {
                    logger.warn(`[Timeout] Failed to recompute bundle status: ${bundleErr?.message || String(bundleErr)}`);
                  }
                  
                  // Broadcast wave status update to UI
                  try {
                    const waveStatusMsg = MessageFactory.createSystemMessage(
                      'bundle:waveStatus',
                      `subscription:bundle:${bundleId}`,
                      { 
                        action: 'waveStatus', 
                        bundleId, 
                        waveId: nextWave.id,
                        status: waveStatus,
                        endTime: waveStatus !== 'IN_PROGRESS' ? new Date().toISOString() : undefined
                      },
                      SystemUser,
                      { echoToSender: false }
                    );
                    await publisher.publish(waveStatusMsg);
                    logger.info(`[Timeout] Broadcasted wave status update for wave ${nextWave.id}: ${waveStatus}`);
                  } catch (broadcastErr: any) {
                    logger.warn(`[Timeout] Failed to broadcast wave status: ${broadcastErr?.message || String(broadcastErr)}`);
                  }
                  
                  // Also broadcast device status update
                  try {
                    const deviceStatusMsg = MessageFactory.createSystemMessage(
                      'device:bundleStatus',
                      `subscription:device:${deviceId}`,
                      {
                        action: 'bundleStatus',
                        deviceId,
                        waveId: nextWave.id,
                        status: 'FAILED',
                        progress: waveProgress,
                        devicesTotal,
                        devicesCompleted,
                        devicesFailed,
                        error: 'timeout'
                      },
                      SystemUser,
                      { echoToSender: false }
                    );
                    await publisher.publish(deviceStatusMsg);
                    logger.info(`[Timeout] Broadcasted device status update for device ${deviceId} in wave ${nextWave.id}`);
                  } catch (deviceBroadcastErr: any) {
                    logger.warn(`[Timeout] Failed to broadcast device status: ${deviceBroadcastErr?.message || String(deviceBroadcastErr)}`);
                  }
                  
                  logger.info(`[Timeout] Device ${deviceId} in wave ${nextWave.id} timed out after ${timeoutMs}ms`);
                }
              } catch (timeoutErr: any) {
                logger.warn(`[Timeout] Failed to handle timeout for device ${deviceId} in wave ${nextWave.id}: ${timeoutErr?.message || String(timeoutErr)}`);
              }
            }, timeoutMs);
            
          } catch (sendErr: any) {
            logger.warn(`Failed to send bundle_install to device ${deviceId} for wave ${nextWave.id}: ${sendErr?.message || String(sendErr)}`);
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



