import type { InMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { logger } from '$lib/server/logger';

// Import individual handlers
import { 
  handleClaim, 
  handleRegistration, 
  handleStatusUpdate, 
  handleFirmwareUpdate, 
  handleGetLogs, 
  handleGetLogsResponse, 
  handleDeviceMessage, 
  handleBundleStatus 
} from './device';

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
      case 'getLogs':
        // Check if this is a response from the device (has logs data)
        if ((payload as any)?.logs || (payload as any)?.logsData) {
          await handleGetLogsResponse(message);
        } else {
          await handleGetLogs(message);
        }
        break;
      case 'message':
        await handleDeviceMessage(message);
        break;
      default:
        logger.warn(`[DeviceHandler] Unhandled device action: ${action}`);
    }
  },
};