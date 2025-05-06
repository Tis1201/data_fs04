import type { InMessage, RoutingMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { MessageFactory } from '../interfaces/message';
import { publisher } from '../core/publisher';
import { logger } from '$lib/server/logger';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { messageHandler } from './messageHandler';

export const deviceHandler: Handler = {
  supports(type: string): boolean {
    return type === 'device';
  },

  async handle(message: InMessage): Promise<void> {
    const { type, payload, scope } = message;
    const { action } = payload;


    logger.debug(`[DeviceHandler] Received message: ${JSON.stringify(message)}, ${action}`);

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
      case 'message':
        await messageHandler.handle(message);
        break;
      default:
        logger.warn(`[DeviceHandler] Unhandled device action: ${action}`);
    }
  },
};

// Private function expressions
async function handleClaim(message: InMessage): Promise<void> {
  const { payload, userInfo, connectionId, protocol } = message;
  const { pin } = payload;

  try {
    if (!userInfo?.id) {
      throw new Error('Authentication Required');
    }

    if (!pin) {
      throw new Error('PIN is required');
    }

    logger.info(`[DeviceHandler] User ${userInfo.id} attempting to claim device with PIN: ${pin}`);

    
    // Claim the device using the device manager
    // Pass the WebSocket connection ID and protocol from the client
    const device = await DeviceManager.claimDevice(pin, userInfo, connectionId, protocol);

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

    // Send success response to the client
    // const response = MessageFactory.toRoutingMessage({
    //   ...message,
    //   type: 'device',
    //   payload: {
    //     action: 'device',
    //     success: true,
    //     message: {
    //       type: 'success',
    //       text: 'Device claimed successfully!',
    //       timestamp: new Date().toISOString()
    //     },
    //     device: {
    //       id: device.id,
    //       name: device.name,
    //       deviceType: device.deviceType,
    //       status: device.status
    //     },
    //     timestamp: new Date().toISOString()
    //   }
    // } as InMessage);

    // await publisher.publish(response);

  } catch (error:any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[DeviceHandler] Device claim failed:`, errorMessage);
    
    // Send error response
    const errorResponse = MessageFactory.toRoutingMessage({
      ...message,
      type: 'device',
      payload: {
        action: 'device',
        success: false,
        error: 'Claim Failed',
        details: errorMessage,
        code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
        timestamp: new Date().toISOString()
      }
    } as InMessage);

    await publisher.publish(errorResponse);
  }
}

async function handleRegistration(message: InMessage): Promise<void> {
  const { payload, userInfo, connectionId } = message;
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
    logger.error(`[DeviceHandler] Registration failed for device ${deviceId}:`, errorMessage);
    
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
  const { deviceId, status } = message.payload;
  logger.info(`[DeviceHandler] Status update from ${deviceId}:`, status);

  // TODO: Update device status in database
  // TODO: Notify relevant users about status change
}



