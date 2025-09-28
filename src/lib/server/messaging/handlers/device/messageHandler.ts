import type { InMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';

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
  const routingMessage = MessageFactory.toRoutingMessage(message, { scope });
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
  const requestId = (payload as any)?.requestId;

  logger.debug('[DeviceMessageHandler] Handling screenshot message', { type, deviceId, requestId });

  // For screenshot responses, send back to the specific connection that requested it
  if (type === 'screenshot:response' && requestId) {
    // Extract connection ID from the message scope (format: connection:{connectionId})
    const originalScope = message.scope || '';
    const connectionMatch = originalScope.match(/connection:(.+)/);
    const connectionId = connectionMatch ? connectionMatch[1] : null;
    
    if (connectionId) {
      const scope = `connection:${connectionId}`;
      
      logger.debug('[DeviceMessageHandler] Sending screenshot response to connection', { connectionId, requestId, originalScope });
      
      // Use sudo to bypass authorization check for screenshot responses
      const routingMessage = MessageFactory.toRoutingMessage(message, { scope, sudo: true });
      await publisher.publish(routingMessage);
    } else {
      logger.warn('[DeviceMessageHandler] Could not extract connection ID from scope for screenshot response', { originalScope, requestId });
      // Fallback to device scope
      const scope = `subscription:device:${deviceId}`;
      const routingMessage = MessageFactory.toRoutingMessage(message, { scope });
      await publisher.publish(routingMessage);
    }
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
