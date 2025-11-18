import { createClient, type RedisClientType } from 'redis';
import { logger } from '$lib/server/logger';
import type { BundleProcessingStateData, StateManager } from './types';
import { BundleProcessingState } from './types';
import { getAdminPrisma } from '$lib/server/prisma';

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
      const failedCancelledBundles: Array<{ bundleId: string; state: BundleProcessingStateData }> = [];

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
        // TIMEOUT_PENDING bundles use fixed grace period
        else if (state.state === BundleProcessingState.TIMEOUT_PENDING) {
          const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
            this.gracePeriodHours * 60 * 60 * 1000);
          
          if (now <= gracePeriodEnd) {
            processableBundles.push(bundleId);
          }
        }
        // FAILED and CANCELLED bundles use bundle's active period (not fixed grace period)
        else if (state.state === BundleProcessingState.FAILED || state.state === BundleProcessingState.CANCELLED) {
          failedCancelledBundles.push({ bundleId, state });
        }
      }

      // Batch fetch bundle data for FAILED/CANCELLED bundles to check active period
      if (failedCancelledBundles.length > 0) {
        try {
          const prisma = getAdminPrisma();
          const bundleIds = failedCancelledBundles.map(b => b.bundleId);
          
          // Batch fetch bundle data
          const bundleData = await (prisma as any).bundle.findMany({
            where: { id: { in: bundleIds } },
            select: { id: true, scheduledAt: true, activePeriodDays: true }
          });
          
          // Batch fetch first wave start times
          const firstWaves = await (prisma as any).bundleWave.findMany({
            where: { bundleId: { in: bundleIds } },
            select: { bundleId: true, startTime: true },
            orderBy: { startTime: 'asc' }
          });
          
          // Group first waves by bundleId (get the earliest startTime for each bundle)
          const firstWaveMap = new Map<string, Date>();
          for (const wave of firstWaves) {
            if (wave.startTime && (!firstWaveMap.has(wave.bundleId) || wave.startTime < firstWaveMap.get(wave.bundleId)!)) {
              firstWaveMap.set(wave.bundleId, wave.startTime);
            }
          }
          
          // Create bundle data map
          const bundleDataMap = new Map(bundleData.map((b: any) => [b.id, b]));
          
          // Check active period for each FAILED/CANCELLED bundle
          for (const { bundleId, state } of failedCancelledBundles) {
            const bundle = bundleDataMap.get(bundleId);
            if (!bundle) {
              // Bundle not found, use fallback grace period
              const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
                this.gracePeriodHours * 60 * 60 * 1000);
              if (now <= gracePeriodEnd) {
                processableBundles.push(bundleId);
              }
              continue;
            }
            
            // Get actual start time (first wave's startTime - when deployment actually began)
            const actualStartTime = firstWaveMap.get(bundleId) || bundle.scheduledAt;
            const activePeriodDays = (bundle.activePeriodDays ?? 1); // Default to 1 day if null
            
            let activePeriodEnd: Date;
            if (actualStartTime) {
              activePeriodEnd = new Date(
                actualStartTime.getTime() + 
                (activePeriodDays * 24 * 60 * 60 * 1000)
              );
            } else {
              // Fallback: bundle was never actually started, use bundle state updatedAt + default active period
              activePeriodEnd = new Date(
                state.updatedAt.getTime() + 
                (1 * 24 * 60 * 60 * 1000) // 1 day default
              );
            }
            
            // Include bundle if still within active period
            if (now <= activePeriodEnd) {
              processableBundles.push(bundleId);
            }
          }
        } catch (error) {
          logger.warn(`[RedisStateManager] Failed to check active period for FAILED/CANCELLED bundles: ${error instanceof Error ? error.message : String(error)}`);
          // Fallback: use grace period for all FAILED/CANCELLED bundles
          for (const { bundleId, state } of failedCancelledBundles) {
            const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
              this.gracePeriodHours * 60 * 60 * 1000);
            if (now <= gracePeriodEnd) {
              processableBundles.push(bundleId);
            }
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
