// src/lib/server/device/deviceEventPublisher.ts
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { logger } from '$lib/server/logger';
import type { Device } from '@prisma/client';

interface DeviceStatusEvent {
  deviceId: string;
  connected: boolean;
  timestamp: string;
  reason?: string;
}

/**
 * Publishes device status events to multiple subscription channels:
 * 1. Device-specific channel (backward compatibility)
 * 2. Account-level channel (for account members)
 * 3. Admin channel (for admin users)
 * 
 * This ensures real-time updates reach all users who should see them,
 * regardless of pagination, filtering, or which devices they're viewing.
 */
export async function publishDeviceStatusEvent(
  device: Pick<Device, 'id' | 'name' | 'accountId' | 'createdBy'>,
  event: DeviceStatusEvent
): Promise<void> {
  const eventType = event.connected ? 'device:connection' : 'device:disconnection';
  
  // Prepare channels to publish to
  const channels: string[] = [
    // 1. Device-specific (existing, backward compatibility)
    `subscription:device:${device.id}`,
  ];
  
  // 2. Account-level (if device has accountId)
  if (device.accountId) {
    channels.push(`subscription:account:${device.accountId}:devices`);
  }
  
  // 3. Admin channel (always - admins see all devices)
  channels.push(`subscription:admin:devices`);
  
  // System user for publishing
  const systemUser = {
    id: 'system',
    email: 'system@system',
    name: 'System',
    systemRole: 'SUPER_ADMIN' as const,
    source: 'session' as const
  };
  
  // Payload with device information
  const payload = {
    deviceId: device.id,
    deviceName: device.name,
    connected: event.connected,
    timestamp: event.timestamp,
    reason: event.reason,
    accountId: device.accountId,
    userId: device.createdBy
  };
  
  // Publish to each channel
  for (const channel of channels) {
    try {
      const message = MessageFactory.createSystemMessage(
        eventType,
        channel,
        payload,
        systemUser,
        { 
          echoToSender: false, 
          excludeDevices: true 
        }
      );
      
      await publisher.publish(message);
      logger.debug(`[DeviceEventPublisher] Published ${eventType} to ${channel}`);
    } catch (error) {
      logger.error(`[DeviceEventPublisher] Failed to publish to ${channel}:`, error);
    }
  }
  
  logger.info(`[DeviceEventPublisher] Published ${eventType} for device ${device.id} to ${channels.length} channels`);
}

