import type { InMessage, RoutingMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { MessageFactory } from '../interfaces/message';
import { publisher } from '../core/publisher';
import { logger } from '$lib/server/logger';

export const deviceHandler: Handler = {
  supports(type: string): boolean {
    return type === 'device';
  },

  async handle(message: InMessage): Promise<void> {
    const { payload } = message;
    const { action } = payload;

    switch (action) {
      case 'register':
        await this.handleRegistration(message);
        break;
      case 'status':
        await this.handleStatusUpdate(message);
        break;
      default:
        logger.warn(`[DeviceHandler] Unhandled device action: ${action}`);
    }
  },

  handleRegistration: async function(message: InMessage): Promise<void> {
    const { payload, userInfo, connectionId } = message;
    const { deviceId, pin, deviceInfo } = payload;

    try {
      // TODO: Validate device registration
      // - Verify PIN is valid and not expired
      // - Check if device is already registered
      // - Create/update device record in database

      const response = {
        ...message,
        payload: {
          action: 'registered',
          deviceId,
          timestamp: new Date().toISOString(),
          // Add any additional registration response data
        },
      };

      // Send response back to device
      const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(response);
      await publisher.publish({
        ...routingMessage,
        scope: `device:${deviceId}`,
      });

      // Notify admin UI about new device registration
      if (userInfo?.id) {
        await publisher.publish({
          ...routingMessage,
          scope: `user:${userInfo.id}`,
          payload: {
            ...routingMessage.payload,
            action: 'device:registered',
            deviceInfo,
          },
        });
      }

      logger.info(`[DeviceHandler] Device registered: ${deviceId}`);
    } catch (error) {
      logger.error(`[DeviceHandler] Registration failed for device ${deviceId}:`, error);
      // Send error response
      const errorResponse = MessageFactory.toRoutingMessage({
        ...message,
        payload: {
          action: 'error',
          error: 'Registration failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      await publisher.publish({
        ...errorResponse,
        scope: connectionId ? `connection:${connectionId}` : undefined,
      });
    }
  },

  handleStatusUpdate: async function(message: InMessage): Promise<void> {
    const { deviceId, status } = message.payload;
    logger.info(`[DeviceHandler] Status update from ${deviceId}:`, status);
    
    // TODO: Update device status in database
    // TODO: Notify relevant users about status change
  },
};
