import type { InMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';

/**
 * Handles device messages including WebRTC, terminal, and other device communications
 */
export async function handleDeviceMessage(message: InMessage): Promise<void> {
  const { payload } = message;
  const { type } = payload as any;

  logger.debug('[DeviceMessageHandler] Handling device message', {
    messageType: type,
    deviceId: (payload as any)?.deviceId,
    requestId: (message as any)?.requestId,
  });

  try {
    // Handle different message types
    if (type?.startsWith('webrtc:')) {
      await handleWebRTCMessage(message);
    } else if (type?.startsWith('terminal:')) {
      await handleTerminalMessage(message);
    } else if (type?.startsWith('screenshot:')) {
      await handleScreenshotMessage(message);
    } else {
      // Default handling for other device messages
      await handleGenericDeviceMessage(message);
    }
  } catch (error) {
    logger.error('[DeviceMessageHandler] Error handling device message', { error, message });
    throw error;
  }
}

/**
 * Handles WebRTC-related messages
 */
async function handleWebRTCMessage(message: InMessage): Promise<void> {
  const { payload } = message;
  const deviceId = (payload as any)?.deviceId;
  const type = (payload as any)?.type;

  logger.debug('[DeviceMessageHandler] Handling WebRTC message', { type, deviceId });

  // Forward WebRTC message to appropriate scope
  const scope = `subscription:device:${deviceId}`;
  const routingMessage = MessageFactory.toRoutingMessage(message, { scope, sudo: true });
  await publisher.publish(routingMessage);
}

/**
 * Handles terminal-related messages
 */
async function handleTerminalMessage(message: InMessage): Promise<void> {
  const { payload } = message;
  const deviceId = (payload as any)?.deviceId;
  const type = (payload as any)?.type;

  logger.debug('[DeviceMessageHandler] Handling terminal message', { type, deviceId });

  // Forward terminal message to appropriate scope
  const scope = `subscription:device:${deviceId}`;
  const routingMessage = MessageFactory.toRoutingMessage(message, { scope });
  await publisher.publish(routingMessage);
}

/**
 * Handles screenshot-related messages
 */
async function handleScreenshotMessage(message: InMessage): Promise<void> {
  const { payload } = message;
  const deviceId = (payload as any)?.deviceId;
  const type = (payload as any)?.type;
  const requestId = (payload as any)?.requestId || (message as any)?.requestId;

  logger.debug('[DeviceMessageHandler] Handling screenshot message', { type, deviceId, requestId, messageScope: message.scope });

  // For screenshot responses, save to database and send back to the specific connection that requested it
  if (type === 'screenshot:response' && requestId && deviceId) {
    logger.info('[DeviceMessageHandler] Processing screenshot:response', { deviceId, requestId, hasImage: !!(payload as any)?.image });
    // Save screenshot action to database
    try {
      // Try to find existing action log by requestId
      let actionLog = await ActionLogger.findByRequestId(deviceId, requestId);
      
      if (!actionLog) {
        // Create new action log if not found
        // Use 'snapshot' as actionType to match frontend usage
        const userInfo = message.userInfo;
        if (userInfo?.id) {
          actionLog = await ActionLogger.createInitiated({
            deviceId,
            actionType: 'snapshot',
            initiatedBy: userInfo.id,
            requestId,
            connectionId: message.connectionId || 'device',
            protocol: message.protocol || 'sse',
            metadata: {
              requestId,
              format: (payload as any)?.format || 'jpeg',
              hasImage: !!(payload as any)?.data || !!(payload as any)?.image
            },
            initialMessage: 'Screenshot captured'
          });
          logger.info('[DeviceMessageHandler] Created new screenshot action log', { logId: actionLog.id, requestId, deviceId });
        } else {
          logger.warn('[DeviceMessageHandler] Cannot create action log: missing userInfo', { deviceId, requestId });
        }
      }
      
      // Update action log with success status
      if (actionLog) {
        await ActionLogger.finalize(actionLog.id, 'success', 'Screenshot captured successfully');
        logger.info('[DeviceMessageHandler] Updated screenshot action log to success', { logId: actionLog.id, requestId, deviceId });
      }
    } catch (error) {
      logger.error('[DeviceMessageHandler] Error saving screenshot action log', { error, deviceId, requestId });
      // Don't fail the whole operation if DB save fails
    }

    // Publish to device scope so SSE store can match by requestId
    // The SSE connection is subscribed to subscription:device:{deviceId}
    const deviceScope = `subscription:device:${deviceId}`;
    
    logger.info('[DeviceMessageHandler] Publishing screenshot response', { 
      deviceId, 
      requestId, 
      scope: deviceScope,
      hasImage: !!(payload as any)?.image,
      imageLength: (payload as any)?.image ? String((payload as any).image).length : 0
    });
    
    // Ensure requestId is preserved at top level for SSE store matching
    // The device sends requestId in payload.requestId, but SSE store needs it at message root level
    const routingMessage = MessageFactory.toRoutingMessage(message, { 
      scope: deviceScope, 
      sudo: true,
      requestId: requestId || message.requestId // Ensure requestId is at top level
    });
    
    // Preserve the image data and format in the payload (device sends image in payload.image)
    routingMessage.payload = {
      ...routingMessage.payload,
      type: 'screenshot:response',
      requestId: requestId || routingMessage.payload.requestId
    };
    
    logger.debug('[DeviceMessageHandler] Routing message structure', {
      requestId: routingMessage.requestId,
      payloadType: routingMessage.payload.type,
      payloadRequestId: routingMessage.payload.requestId,
      hasImage: !!(routingMessage.payload as any)?.image
    });
    
    await publisher.publish(routingMessage);
    logger.info('[DeviceMessageHandler] Screenshot response published successfully', { deviceId, requestId });
  } else if (type === 'screenshot:error' && requestId && deviceId) {
    // Handle screenshot errors - update action log if exists
    try {
      const actionLog = await ActionLogger.findByRequestId(deviceId, requestId);
      if (actionLog) {
        const errorMessage = (payload as any)?.error || 'Screenshot failed';
        await ActionLogger.finalize(actionLog.id, 'failed', errorMessage);
        logger.info('[DeviceMessageHandler] Updated screenshot action log to failed', { logId: actionLog.id, requestId, deviceId });
      }
    } catch (error) {
      logger.error('[DeviceMessageHandler] Error updating screenshot action log on error', { error, deviceId, requestId });
    }
    
    // Forward error message
    const scope = `subscription:device:${deviceId}`;
    const routingMessage = MessageFactory.toRoutingMessage(message, { scope });
    await publisher.publish(routingMessage);
  } else if (type === 'screenshot:request' && deviceId) {
    // For screenshot requests, forward directly to the device connection
    // Use device connection scope and sudo to bypass authorization (device needs to receive the request)
    const deviceConnectionScope = `connection:${deviceId}`;
    
    logger.debug('[DeviceMessageHandler] Forwarding screenshot request to device', { deviceId, requestId, scope: deviceConnectionScope });
    
    const routingMessage = MessageFactory.toRoutingMessage(message, { 
      scope: deviceConnectionScope,
      sudo: true // Bypass authorization - device needs to receive screenshot requests
    });
    
    await publisher.publish(routingMessage);
  } else {
    // For other screenshot messages, forward to device scope
    const scope = `subscription:device:${deviceId}`;
    const routingMessage = MessageFactory.toRoutingMessage(message, { scope });
    await publisher.publish(routingMessage);
  }
}

/**
 * Handles generic device messages
 */
async function handleGenericDeviceMessage(message: InMessage): Promise<void> {
  const { payload } = message;
  const deviceId = (payload as any)?.deviceId;

  logger.debug('[DeviceMessageHandler] Handling generic device message', { deviceId });

  // Forward generic message to appropriate scope
  const scope = `subscription:device:${deviceId}`;
  const routingMessage = MessageFactory.toRoutingMessage(message, { scope });
  await publisher.publish(routingMessage);
}
