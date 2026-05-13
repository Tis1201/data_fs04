// Device presence tracking via MQTT + Redis
// Redis provides fast presence checks with TTL auto-expiry
// Database provides fallback and historical data

import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';
import { getAdminPrisma } from '$lib/server/prisma';

/**
 * Check if a device is currently online
 * @param deviceId The device ID to check
 * @returns true if device is online, false otherwise
 * 
 * Priority: Redis (fast) → Database (fallback)
 */
export async function isDeviceOnline(deviceId: string): Promise<boolean> {
  try {
    // Primary: Check Redis for real-time presence (0.1-1ms)
    if (redis) {
      try {
        const exists = await redis.exists(`presence:device:${deviceId}`);
        logger.debug(`[DevicePresence] Redis check - device ${deviceId} online: ${exists === 1}`);
        return exists === 1;
      } catch (redisError) {
        logger.warn('[DevicePresence] Redis check failed, falling back to database', {
          error: redisError instanceof Error ? redisError.message : String(redisError),
          deviceId
        });
        // Fall through to database check
      }
    }
    
    // Fallback: Check database (10-50ms, but reliable)
    logger.debug('[DevicePresence] Using database fallback for device presence check');
    const prisma = getAdminPrisma();
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { 
        connected: true,
        disconnectedAt: true 
      }
    });
    
    if (!device) {
      logger.warn(`[DevicePresence] Device ${deviceId} not found in database`);
      return false;
    }
    
    // Additional validation: if disconnectedAt is very recent (< 30s), might be stale
    // This handles edge case where device disconnected but DB hasn't updated yet
    if (device.connected && device.disconnectedAt) {
      const disconnectAge = Date.now() - new Date(device.disconnectedAt).getTime();
      if (disconnectAge < 30000) { // Less than 30 seconds
        logger.debug(`[DevicePresence] Device ${deviceId} recently disconnected (${disconnectAge}ms ago), treating as offline`);
        return false;
      }
    }
    
    return device.connected ?? false;
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
 * 
 * Priority: Redis (fast batch) → Database (fallback batch)
 */
export async function areDevicesOnline(deviceIds: string[]): Promise<Map<string, boolean>> {
  try {
    if (deviceIds.length === 0) {
      return new Map();
    }
    
    // Primary: Check Redis with pipeline (very fast for batch operations)
    if (redis) {
      try {
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
        
        logger.debug(`[DevicePresence] Redis batch check completed for ${deviceIds.length} devices`);
        return result;
      } catch (redisError) {
        logger.warn('[DevicePresence] Redis batch check failed, falling back to database', {
          error: redisError instanceof Error ? redisError.message : String(redisError),
          deviceCount: deviceIds.length
        });
        // Fall through to database check
      }
    }
    
    // Fallback: Batch check database
    logger.debug(`[DevicePresence] Using database fallback for batch presence check (${deviceIds.length} devices)`);
    const prisma = getAdminPrisma();
    const devices = await prisma.device.findMany({
      where: { 
        id: { in: deviceIds }
      },
      select: { 
        id: true,
        connected: true,
        disconnectedAt: true
      }
    });
    
    // Build result map from database
    const result = new Map<string, boolean>();
    const now = Date.now();
    
    for (const deviceId of deviceIds) {
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        result.set(deviceId, false);
        continue;
      }
      
      // Additional validation: check for recent disconnects
      let isOnline = device.connected ?? false;
      if (isOnline && device.disconnectedAt) {
        const disconnectAge = now - new Date(device.disconnectedAt).getTime();
        if (disconnectAge < 30000) { // Less than 30 seconds
          isOnline = false;
        }
      }
      
      result.set(deviceId, isOnline);
    }
    
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

