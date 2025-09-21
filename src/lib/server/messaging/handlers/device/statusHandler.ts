import type { InMessage } from '../../interfaces/message';
import { logger } from '$lib/server/logger';

export async function handleStatusUpdate(message: InMessage): Promise<void> {
  const { deviceId, status } = message.payload as any;
  logger.info(`[DeviceHandler] Status update from ${deviceId}:`, { status });

  // TODO: Update device status in database
  // TODO: Notify relevant users about status change
}
