import type { InMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';

export async function handleRegistration(message: InMessage): Promise<void> {
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
