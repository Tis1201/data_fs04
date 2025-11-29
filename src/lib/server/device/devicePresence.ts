// Device presence tracking using pushpin-tracker
// The pushpin-tracker sidecar automatically maintains presence keys in Redis
// based on Pushpin's stats feed. No device-side code needed!

import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';

/**
 * Check if a device is currently online
 * @param deviceId The device ID to check
 * @returns true if device is online, false otherwise
 */
export async function isDeviceOnline(deviceId: string): Promise<boolean> {
  try {
    if (!redis) {
      logger.warn('[DevicePresence] Redis not available (USE_PUSHPIN not enabled)');
      return false;
    }
    const exists = await redis.exists(`presence:device:${deviceId}`);
    logger.debug(`[DevicePresence] device online: ${exists} `);
    return exists === 1;
  } catch (error) {
    logger.error('[DevicePresence] Failed to check device online status', {
      error: error instanceof Error ? error.message : String(error),
      deviceId
    });
    return false;
  }
}

/**
 * Get device presence details
 * @param deviceId The device ID to check
 * @returns Presence details or null if offline
 */
export async function getDevicePresence(deviceId: string): Promise<{
  channel: string;
  source: string;
  mode: string;
  subscribers: number;
  ttl: number;
} | null> {
  try {
    if (!redis) {
      logger.warn('[DevicePresence] Redis not available (USE_PUSHPIN not enabled)');
      return null;
    }
    const key = `presence:device:${deviceId}`;
    
    const [presence, ttl] = await Promise.all([
      redis.hgetall(key),
      redis.ttl(key)
    ]);
    
    if (!presence || Object.keys(presence).length === 0) {
      return null;
    }
    
    return {
      channel: presence.channel || '',
      source: presence.source || '',
      mode: presence.mode || '',
      subscribers: parseInt(presence.subscribers || '0', 10),
      ttl
    };
  } catch (error) {
    logger.error('[DevicePresence] Failed to get device presence', {
      error: error instanceof Error ? error.message : String(error),
      deviceId
    });
    return null;
  }
}

/**
 * Get all online devices
 * @returns Array of online device IDs
 */
export async function getAllOnlineDevices(): Promise<string[]> {
  try {
    if (!redis) {
      logger.warn('[DevicePresence] Redis not available (USE_PUSHPIN not enabled)');
      return [];
    }
    
    // Use SCAN instead of KEYS for better performance
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const result = await redis.scan(cursor, 'MATCH', 'presence:device:*', 'COUNT', '100');
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    
    // Extract device IDs from keys
    return keys.map((key: string) => key.replace('presence:device:', ''));
  } catch (error) {
    logger.error('[DevicePresence] Failed to get all online devices', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/**
 * Batch check if multiple devices are online
 * @param deviceIds Array of device IDs to check
 * @returns Map of deviceId -> boolean (true if online)
 */
export async function areDevicesOnline(deviceIds: string[]): Promise<Map<string, boolean>> {
  try {
    if (!redis) {
      logger.warn('[DevicePresence] Redis not available (USE_PUSHPIN not enabled)');
      return new Map(deviceIds.map(id => [id, false]));
    }
    
    if (deviceIds.length === 0) {
      return new Map();
    }
    
    // Build keys for all devices
    const keys = deviceIds.map(id => `presence:device:${id}`);
    
    // Use pipeline to batch all EXISTS commands at once (much faster than sequential calls)
    const pipeline = redis.pipeline();
    keys.forEach(key => {
      pipeline.exists(key);
    });
    
    const results = await pipeline.exec();
    
    // Build result map
    const result = new Map<string, boolean>();
    deviceIds.forEach((deviceId, index) => {
      // results is an array of [error, result] tuples
      const exists = results?.[index]?.[1] === 1;
      result.set(deviceId, exists);
    });
    
    return result;
  } catch (error) {
    logger.error('[DevicePresence] Failed to batch check device online status', {
      error: error instanceof Error ? error.message : String(error),
      deviceCount: deviceIds.length
    });
    // Return all false on error
    return new Map(deviceIds.map(id => [id, false]));
  }
}

/**
 * Get count of online devices
 * @returns Number of online devices
 */
export async function getOnlineDeviceCount(): Promise<number> {
  try {
    const devices = await getAllOnlineDevices();
    return devices.length;
  } catch (error) {
    logger.error('[DevicePresence] Failed to get online device count', {
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

