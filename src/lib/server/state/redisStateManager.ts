import { createClient, type RedisClientType } from 'redis';
import { logger } from '$lib/server/logger';
import type { BundleProcessingStateData, StateManager } from './types';
import { BundleProcessingState } from './types';

export class RedisStateManager implements StateManager {
  private client: RedisClientType | null = null;
  private readonly gracePeriodHours: number;
  private readonly keyPrefix = 'bundle_state:';
  private readonly processableBundlesKey = 'processable_bundles';

  constructor() {
    this.gracePeriodHours = Number(process.env.GRACE_PERIOD_HOURS || 2);
  }

  async initialize(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD || undefined;

      this.client = createClient({
        url: redisUrl,
        password: redisPassword
      });

      this.client.on('error', (err) => {
        logger.error(`[RedisStateManager] Redis client error: ${err.message}`);
      });

      this.client.on('connect', () => {
        logger.info('[RedisStateManager] Connected to Redis');
      });

      this.client.on('disconnect', () => {
        logger.warn('[RedisStateManager] Disconnected from Redis');
      });

      await this.client.connect();
      logger.info(`[RedisStateManager] Initialized with Redis URL: ${redisUrl}`);
    } catch (error) {
      logger.error(`[RedisStateManager] Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  // Expose Redis client for timeout manager
  get redisClient(): RedisClientType | null {
    return this.client;
  }

  async getBundleState(bundleId: string): Promise<BundleProcessingStateData | null> {
    if (!this.client) return null;

    try {
      const key = `${this.keyPrefix}${bundleId}`;
      const data = await this.client.get(key);
      
      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        timeoutAt: parsed.timeoutAt ? new Date(parsed.timeoutAt) : null,
        lastDeviceResponse: parsed.lastDeviceResponse ? new Date(parsed.lastDeviceResponse) : null,
        updatedAt: new Date(parsed.updatedAt)
      };
    } catch (error) {
      logger.error(`[RedisStateManager] Failed to get bundle state for ${bundleId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async setBundleState(bundleId: string, state: BundleProcessingStateData): Promise<void> {
    if (!this.client) return;

    try {
      const key = `${this.keyPrefix}${bundleId}`;
      const stateWithTimestamp = {
        ...state,
        updatedAt: new Date()
      };

      // Serialize dates to strings for Redis storage
      const serializableState = {
        ...stateWithTimestamp,
        timeoutAt: stateWithTimestamp.timeoutAt?.toISOString() || null,
        lastDeviceResponse: stateWithTimestamp.lastDeviceResponse?.toISOString() || null,
        updatedAt: stateWithTimestamp.updatedAt.toISOString()
      };

      // Store with 24-hour expiration
      await this.client.setEx(key, 24 * 60 * 60, JSON.stringify(serializableState));

      // Update processable bundles set
      await this.updateProcessableBundles(bundleId, stateWithTimestamp.state);

      logger.debug(`[RedisStateManager] Updated state for bundle ${bundleId}: ${stateWithTimestamp.state}`);
    } catch (error) {
      logger.error(`[RedisStateManager] Failed to set bundle state for ${bundleId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteBundleState(bundleId: string): Promise<void> {
    if (!this.client) return;

    try {
      const key = `${this.keyPrefix}${bundleId}`;
      await this.client.del(key);
      await this.client.sRem(this.processableBundlesKey, bundleId);
      logger.debug(`[RedisStateManager] Deleted state for bundle ${bundleId}`);
    } catch (error) {
      logger.error(`[RedisStateManager] Failed to delete bundle state for ${bundleId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProcessableBundles(): Promise<string[]> {
    if (!this.client) return [];

    try {
      const bundles = await this.client.sMembers(this.processableBundlesKey);
      const now = new Date();
      
      // FIX: Use Promise.all() to parallelize Redis calls instead of blocking loop
      const statePromises = bundles.map(bundleId => this.getBundleState(bundleId));
      const states = await Promise.all(statePromises);
      
      const processableBundles: string[] = [];

      for (let i = 0; i < bundles.length; i++) {
        const bundleId = bundles[i];
        const state = states[i];
        
        if (!state) continue;

        // ACTIVE bundles are always processable
        if (state.state === BundleProcessingState.ACTIVE) {
          processableBundles.push(bundleId);
        }
        // COMPLETED bundles are never processable
        else if (state.state === BundleProcessingState.COMPLETED) {
          continue;
        }
        // All other statuses (TIMEOUT_PENDING, FAILED, CANCELLED) are processable within grace period
        else {
          const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
            this.gracePeriodHours * 60 * 60 * 1000);
          
          if (now <= gracePeriodEnd) {
            processableBundles.push(bundleId);
          }
        }
      }

      return processableBundles;
    } catch (error) {
      logger.error(`[RedisStateManager] Failed to get processable bundles: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async cleanupExpiredStates(): Promise<void> {
    if (!this.client) return;

    try {
      const bundles = await this.client.sMembers(this.processableBundlesKey);
      const now = new Date();
      let cleanedCount = 0;

      for (const bundleId of bundles) {
        const state = await this.getBundleState(bundleId);
        if (!state) continue;

        if (state.state === BundleProcessingState.TIMEOUT_PENDING && state.timeoutAt) {
          const gracePeriodEnd = new Date(state.timeoutAt.getTime() + 
            this.gracePeriodHours * 60 * 60 * 1000);
          
          if (now > gracePeriodEnd) {
            const updatedState = {
              ...state,
              state: BundleProcessingState.FAILED,
              updatedAt: now
            };
            
            await this.setBundleState(bundleId, updatedState);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`[RedisStateManager] Cleaned up ${cleanedCount} expired states`);
      }
    } catch (error) {
      logger.error(`[RedisStateManager] Failed to cleanup expired states: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateProcessableBundles(bundleId: string, state: BundleProcessingState): Promise<void> {
    if (!this.client) return;

    try {
      // Add to processable bundles if not COMPLETED
      if (state !== BundleProcessingState.COMPLETED) {
        await this.client.sAdd(this.processableBundlesKey, bundleId);
      } else {
        // Remove from processable bundles if COMPLETED
        await this.client.sRem(this.processableBundlesKey, bundleId);
      }
    } catch (error) {
      logger.error(`[RedisStateManager] Failed to update processable bundles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
