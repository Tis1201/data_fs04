import type { InMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { logger } from '$lib/server/logger';

// Import individual handlers
import { 
  handleClaim, 
  handleRegistration, 
  handleStatusUpdate, 
  handleGetLogs, 
  handleGetLogsResponse, 
  handleDeviceMessage
} from './device';
import { handleProgressUpdate } from './device/progressHandler';

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
      case 'progressUpdate':
        await handleProgressUpdate(message);
        break;
      case 'getLogs':
        // Check if this is a response from the device (has logs data, logId, or chunk data)
        if ((payload as any)?.logs || (payload as any)?.logsData || (payload as any)?.logId || (payload as any)?.chunkData) {
          await handleGetLogsResponse(message);
        } else {
          await handleGetLogs(message);
        }
        break;
      case 'pushFile':
        // These actions should be handled by the unified action API, not SSE dispatcher
        logger.warn(`[DeviceHandler] push_file action should use unified action API, not SSE dispatcher`);
        break;
      case 'pullFile':
        // These actions should be handled by the unified action API, not SSE dispatcher
        logger.warn(`[DeviceHandler] pull_file action should use unified action API, not SSE dispatcher`);
        break;
      case 'installApp':
        // These actions should be handled by the unified action API, not SSE dispatcher
        logger.warn(`[DeviceHandler] install_app action should use unified action API, not SSE dispatcher`);
        break;
      case 'updateFirmware':
        // These actions should be handled by the unified action API, not SSE dispatcher
        logger.warn(`[DeviceHandler] updateFirmware action should use unified action API, not SSE dispatcher`);
        break;
      case 'message':
        await handleDeviceMessage(message);
        break;
      default:
        logger.warn(`[DeviceHandler] Unhandled device action: ${action}`);
    }
  },
};
