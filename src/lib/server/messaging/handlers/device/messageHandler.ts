import type { InMessage, RoutingMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { SystemUser } from '../../interfaces/message';
import { messageHandler } from '../messageHandler';

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

export async function handleDeviceMessage(message: InMessage): Promise<void> {
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
    
    // Forward webrtc:connect message to device immediately
    const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(message, overrides);
    await publisher.publish(routingMessage);
    return; // Don't process further
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

      // 2-minute timeout for screenshot
      setTimeout(async () => {
        try {
          const current = await (prisma as any).deviceActionLog.findUnique({ where: { id: created.id }, select: { status: true } });
          if (!current) return;
          if (current.status === 'initiated' || current.status === 'in_progress') {
            const finTO = await ActionLogger.finalize(created.id, 'failed', 'Timed out after 2 minutes');
            await publishDeviceStatus('snapshot', deviceId!, {
              deviceId,
              status: 'failed',
              message: 'Timed out after 2 minutes',
              logId: finTO?.id ?? created.id,
              completedAt: finTO?.completedAt,
              durationMs: finTO?.durationMs,
              timestamp: new Date().toISOString()
            });
          }
        } catch (timeoutErr) {
          logger.warn(`[DeviceHandler] Failed to process screenshot timeout for ${created.id}: ${String(timeoutErr)}`);
        }
      }, 2 * 60 * 1000); // 2 minutes
    } catch (e: any) {
      logger.warn(`[DeviceHandler] Failed to create snapshot action log: ${String(e)}`);
    }
    
    // Forward screenshot:request message to device immediately
    const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(message, overrides);
    await publisher.publish(routingMessage);
    return; // Don't process further
  }

  // Forward other WebRTC messages to device (answer, ice-candidate, etc.)
  if (type.startsWith('webrtc:') && type !== 'webrtc:connect') {
    const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(message, overrides);
    await publisher.publish(routingMessage);
    return; // Don't process further
  }

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
      
      // Add status information to the screenshot response payload
      // This ensures the client gets both the image data and status in one message
      const enhancedPayload = {
        ...payload,
        status: hasImage ? 'success' : 'failed',
        message: hasImage ? 'Snapshot received' : 'Snapshot response missing image',
        logId: updated?.id,
        completedAt: updated?.completedAt,
        durationMs: updated?.durationMs
      };
      
      // Create enhanced message with status info
      const enhancedMessage = {
        ...message,
        payload: enhancedPayload
      };
      
      // Forward the enhanced screenshot response (with image data + status) back to the client
      // Don't override the scope - the device has already set it to the correct connection scope
      const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(enhancedMessage, {
        systemGenerated: true,
        sudo: true,
        // Don't override scope - keep the original connection scope from device
        ...computeEchoSettings(message, isResponse, isConnScoped)
      });
      await publisher.publish(routingMessage);
      
      // Also publish status update for UI (for action history, etc.)
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

  // Snapshot error handling
  if (type === 'screenshot:error') {
    try {
      const deviceId = payload?.deviceId as string | undefined;
      const errorMessage = payload?.error as string || 'Unknown screenshot error';
      
      // Finalize the action log with error status
      const updated = await ActionLogger.finalizeByRequestId(
        deviceId || 'unknown',
        message.requestId || '',
        'failed',
        `Screenshot failed: ${errorMessage}`,
        errorMessage
      );
      
      // Forward the error response back to the client
      const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(message, {
        systemGenerated: true,
        sudo: true,
        ...computeEchoSettings(message, isResponse, isConnScoped)
      });
      await publisher.publish(routingMessage);
      
      // Also publish status update for UI (for action history, etc.)
      await publishDeviceStatus('snapshot', deviceId!, {
        deviceId,
        status: 'failed',
        message: `Screenshot failed: ${errorMessage}`,
        requestId: message.requestId,
        logId: updated?.id,
        completedAt: updated?.completedAt,
        durationMs: updated?.durationMs
      });
    } catch (e: any) {
      logger.warn(`[DeviceHandler] Failed to finalize screenshot error action log: ${String(e)}`);
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
