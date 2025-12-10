import { getRedisService } from '$lib/server/services/redisService';
import { logger } from '$lib/server/logger';

/**
 * PresenceManager handles device presence tracking in Redis
 * Uses TTL-based presence keys for automatic cleanup
 */
export class PresenceManager {
  private redisService: ReturnType<typeof getRedisService>;
  private presenceTTL: number;

  constructor(redisService: ReturnType<typeof getRedisService>) {
    this.redisService = redisService;
    this.presenceTTL = parseInt(process.env.PRESENCE_TTL || '300'); // 5 minutes default
  }

  /**
   * Set device as online with TTL
   */
  async setDeviceOnline(deviceId: string): Promise<void> {
    if (!this.redisService) {
      throw new Error('Redis service not initialized');
    }
    const presenceKey = `presence:${deviceId}`;
    await this.redisService.setEx(presenceKey, this.presenceTTL, '1');
    logger.debug(`Device ${deviceId} presence set online (TTL: ${this.presenceTTL}s)`);
  }

  /**
   * Set device as offline (remove presence key)
   */
  async setDeviceOffline(deviceId: string): Promise<void> {
    if (!this.redisService) {
      throw new Error('Redis service not initialized');
    }
    const presenceKey = `presence:${deviceId}`;
    await this.redisService.del(presenceKey);
    logger.debug(`Device ${deviceId} presence set offline`);
  }

  /**
   * Check if device is online
   */
  async isDeviceOnline(deviceId: string): Promise<boolean> {
    if (!this.redisService) {
      throw new Error('Redis service not initialized');
    }
    const presenceKey = `presence:${deviceId}`;
    const result = await this.redisService.get(presenceKey);
    return result === '1';
  }

  /**
   * Get all online devices
   */
  async getOnlineDevices(): Promise<string[]> {
    if (!this.redisService) {
      throw new Error('Redis service not initialized');
    }
    const keys = await this.redisService.client.keys('presence:*');
    return keys.map(key => key.replace('presence:', ''));
  }

  /**
   * Refresh device presence (extend TTL)
   */
  async refreshPresence(deviceId: string): Promise<void> {
    if (!this.redisService) {
      throw new Error('Redis service not initialized');
    }
    const presenceKey = `presence:${deviceId}`;
    await this.redisService.expire(presenceKey, this.presenceTTL);
    logger.debug(`Device ${deviceId} presence refreshed`);
  }

  /**
   * Get presence count
   */
  async getPresenceCount(): Promise<number> {
    if (!this.redisService) {
      throw new Error('Redis service not initialized');
    }
    const keys = await this.redisService.client.keys('presence:*');
    return keys.length;
  }

  /**
   * Get presence info for a specific device
   */
  async getPresenceInfo(deviceId: string): Promise<{ online: boolean; ttl: number }> {
    if (!this.redisService) {
      throw new Error('Redis service not initialized');
    }
    const presenceKey = `presence:${deviceId}`;
    const exists = await this.redisService.exists(presenceKey);
    const ttl = exists ? await this.redisService.client.ttl(presenceKey) : -1;
    
    return {
      online: Boolean(exists),
      ttl: ttl > 0 ? ttl : 0
    };
  }
}
