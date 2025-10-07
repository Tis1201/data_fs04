import type { RedisService } from '$lib/server/services/redisService';
import { logger } from '$lib/server/logger';

/**
 * MessageRelay handles Redis Pub/Sub message broadcasting for Pushpin
 * Publishes messages to Redis channels that sidecars can consume
 */
export class MessageRelay {
  private redisService: RedisService;
  private publishChannel: string;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.publishChannel = process.env.REDIS_PUSHPIN_CHANNEL_NAME || 'pushpin_publish';
  }

  /**
   * Publish a message to a specific device channel
   */
  async publishToDevice(deviceId: string, message: unknown): Promise<void> {
    const channel = `device:${deviceId}`;
    const payload = {
      channel,
      payload: message,
      timestamp: Date.now(),
      type: 'device_message'
    };

    await this.redisService.publish(this.publishChannel, JSON.stringify(payload));
    logger.debug(`Published message to device ${deviceId} via Redis Pub/Sub`);
    logger.debug(`Published message ${ JSON.stringify(payload)} via Redis Pub/Sub`);
  }

  /**
   * Publish a broadcast message to all devices
   */
  async publishBroadcast(message: unknown): Promise<void> {
    const payload = {
      channel: 'broadcast',
      payload: message,
      timestamp: Date.now(),
      type: 'broadcast_message'
    };

    await this.redisService.publish(this.publishChannel, JSON.stringify(payload));
    logger.debug('Published broadcast message via Redis Pub/Sub');
  }

  /**
   * Publish a message to a specific channel
   */
  async publishToChannel(channel: string, message: unknown): Promise<void> {
    const payload = {
      channel,
      payload: message,
      timestamp: Date.now(),
      type: 'channel_message'
    };

    await this.redisService.publish(this.publishChannel, JSON.stringify(payload));
    logger.debug(`Published message to channel ${channel} via Redis Pub/Sub`);
    logger.debug(`Published message ${ JSON.stringify(payload)} via Redis Pub/Sub`);
  }

  /**
   * Publish device status change
   */
  async publishDeviceStatus(deviceId: string, status: 'online' | 'offline', connectionId?: string): Promise<void> {
    const message = {
      deviceId,
      status,
      connectionId,
      timestamp: new Date().toISOString()
    };

    await this.publishToChannel(`device:${deviceId}:status`, message);
    logger.debug(`Published device status change: ${deviceId} -> ${status}`);
  }

  /**
   * Publish bundle status update
   */
  async publishBundleStatus(bundleId: string, waveId: string, deviceId: string, status: string, progress?: number): Promise<void> {
    const message = {
      bundleId,
      waveId,
      deviceId,
      status,
      progress,
      timestamp: new Date().toISOString()
    };

    await this.publishToChannel(`bundle:${bundleId}:status`, message);
    await this.publishToChannel(`wave:${waveId}:status`, message);
    logger.debug(`Published bundle status: ${bundleId}/${waveId}/${deviceId} -> ${status}`);
  }

  /**
   * Get subscriber count for the publish channel
   */
  async getSubscriberCount(): Promise<number> {
    try {
      const result = await this.redisService.client.pubsub('NUMSUB', this.publishChannel);
      const countValue = Array.isArray(result) ? result[1] : 0;
      return parseInt(String(countValue ?? 0), 10);
    } catch (err) {
      logger.error('Failed to get subscriber count', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      return 0;
    }
  }
}
