import type { InMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { DeviceManager } from '$lib/server/device/deviceManager';

export async function handleClaim(message: InMessage): Promise<void> {
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
