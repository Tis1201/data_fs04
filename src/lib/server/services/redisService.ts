import { logger } from '$lib/server/logger';
import type Redis from 'ioredis';

/**
 * Redis service for common operations
 * This follows the project pattern of creating service classes for reusable functionality
 */
export class RedisService {
  private _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }
  
  /**
   * Get the Redis client instance
   * This is exposed for special operations that aren't covered by the standard methods
   * Should be used with caution and only in admin contexts
   */
  get client(): Redis {
    return this._redis;
  }

  /**
   * Set a value with optional expiration
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    try {
      if (ttlSeconds) {
        return await this._redis.set(key, value, 'EX', ttlSeconds);
      }
      return await this._redis.set(key, value);
    } catch (error) {
      logger.error(`Redis set error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return null;
    }
  }

  /**
   * Get a value
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this._redis.get(key);
    } catch (error) {
      logger.error(`Redis get error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    try {
      return await this._redis.del(key);
    } catch (error) {
      logger.error(`Redis del error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this._redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis exists error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return false;
    }
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this._redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      logger.error(`Redis expire error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    try {
      return await this._redis.incr(key);
    } catch (error) {
      logger.error(`Redis incr error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return 0;
    }
  }

  /**
   * Add to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this._redis.sadd(key, ...members);
    } catch (error) {
      logger.error(`Redis sadd error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this._redis.smembers(key);
    } catch (error) {
      logger.error(`Redis smembers error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        key
      });
      return [];
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this._redis.publish(channel, message);
    } catch (error) {
      logger.error(`Redis publish error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        channel
      });
      return 0;
    }
  }

  /**
   * Subscribe to the default channel from environment variable
   * Returns the subscription object for handling messages
   */
  subscribeToDefaultChannel(messageHandler: (message: string) => void): Redis {
    const channelName = process.env.REDIS_SUBSCRIBE_CHANNEL_NAME || 'device_status_changes';
    
    try {
      // Create a duplicate client for subscription (Redis clients that subscribe cannot issue commands)
      const subscriber = this._redis.duplicate();
      
      subscriber.on('message', (_channel, message) => {
        try {
          messageHandler(message);
        } catch (error) {
          logger.error(`Error handling Redis message: ${error.message}`, {
            error: error.message,
            stack: error.stack
          });
        }
      });
      
      subscriber.on('error', (err) => {
        logger.error(`Redis subscriber error: ${err.message}`, {
          error: err.message,
          stack: err.stack
        });
      });
      
      subscriber.subscribe(channelName, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to Redis channel ${channelName}: ${err.message}`, {
            error: err.message,
            stack: err.stack
          });
        } else {
          logger.info(`Subscribed to Redis channel: ${channelName}`);
        }
      });
      
      return subscriber;
    } catch (error) {
      logger.error(`Redis subscribe error: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Subscribe to a specific channel
   * Returns the subscription object for handling messages
   */
  subscribeToChannel(channel: string, messageHandler: (message: string) => void): Redis {
    try {
      // Create a duplicate client for subscription (Redis clients that subscribe cannot issue commands)
      const subscriber = this._redis.duplicate();
      
      subscriber.on('message', (_channel, message) => {
        try {
          messageHandler(message);
        } catch (error) {
          logger.error(`Error handling Redis message: ${error.message}`, {
            error: error.message,
            stack: error.stack
          });
        }
      });
      
      subscriber.on('error', (err) => {
        logger.error(`Redis subscriber error: ${err.message}`, {
          error: err.message,
          stack: err.stack
        });
      });
      
      subscriber.subscribe(channel, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to Redis channel ${channel}: ${err.message}`, {
            error: err.message,
            stack: err.stack
          });
        } else {
          logger.info(`Subscribed to Redis channel: ${channel}`);
        }
      });
      
      return subscriber;
    } catch (error) {
      logger.error(`Redis subscribe error: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

/**
 * Create a RedisService instance from the locals object
 * Returns null if Redis is not available (USE_PUSHPIN is not true)
 */
export function getRedisService(locals: App.Locals): RedisService | null {
  if (!locals.redis) {
    logger.debug('Redis service not available because USE_PUSHPIN is not set to true');
    return null;
  }
  return new RedisService(locals.redis);
}
