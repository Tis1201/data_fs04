import type { InMessage } from '../../interfaces/message';
import { logger } from '$lib/server/logger';
import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
import prisma from '$lib/server/prisma';

export async function handleDeviceConnection(message: InMessage): Promise<void> {
  const { payload } = message;
  const { deviceId, connected, connectedAt, disconnectedAt } = payload as any;

  if (!deviceId) {
    logger.warn('[ConnectionHandler] No deviceId provided in connection message');
    return;
  }

  try {
    // Create a mock locals object with prisma for DeviceStatusManager
    const locals = { prisma } as any;

    if (connected === true) {
      // Device is connecting
      await DeviceStatusManager.setDeviceOnline(deviceId, locals, message.connectionId);
      logger.info(`[ConnectionHandler] Device ${deviceId} marked as online`);
    } else if (connected === false) {
      // Device is disconnecting
      await DeviceStatusManager.setDeviceOffline(deviceId, locals, message.connectionId);
      logger.info(`[ConnectionHandler] Device ${deviceId} marked as offline`);
    } else {
      logger.warn(`[ConnectionHandler] Unknown connection status: ${connected} for device ${deviceId}`);
    }
  } catch (error) {
    logger.error(`[ConnectionHandler] Failed to update device ${deviceId} connection status: ${error}`);
  }
}
