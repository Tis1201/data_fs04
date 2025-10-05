import Redlock from 'redlock';
import type { Lock } from 'redlock';
import { logger } from '$lib/server/logger';

/**
 * Distributed Lock Manager for Scheduler Coordination
 * 
 * Prevents duplicate execution of schedulers across multiple server instances
 * using Redis distributed locking with automatic TTL and failover.
 */
class DistributedLockManager {
  private redlock: Redlock | null;
  private isInitialized = false;

  constructor() {
    // Will be initialized when Redis is available
    this.redlock = null as any;
  }

  /**
   * Initialize the lock manager with Redis connection
   */
  async initialize(redisService: { client: unknown }): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create Redlock instance with Redis client
      this.redlock = new Redlock([redisService.client as any], {
        // The expected clock drift; for more details see:
        // http://redis.io/topics/distlock
        driftFactor: 0.01, // multiplied by lock ttl to determine drift time

        // The max number of times Redlock will attempt to lock a resource
        // before erroring.
        retryCount: 3,

        // the time in ms between attempts
        retryDelay: 200, // time in ms

        // the max time in ms randomly added to retries
        // to improve performance under high contention
        // see https://www.awsarchitectureblog.com/2015/03/backoff.html
        retryJitter: 200, // time in ms
      });

      this.isInitialized = true;
      logger.info('[DistributedLock] Initialized with Redis connection');
    } catch (error) {
      logger.error('[DistributedLock] Failed to initialize', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Try to acquire a distributed lock
   * @param resource - The lock resource name (e.g., 'scheduler:bundle-publish')
   * @param ttl - Time to live in milliseconds
   * @returns Lock object if acquired, null if already locked
   */
  async tryAcquireLock(resource: string, ttl: number): Promise<Lock | null> {
    if (!this.isInitialized) {
      logger.warn('[DistributedLock] Not initialized, skipping lock acquisition');
      return null;
    }

    try {
      const lock = await (this.redlock as Redlock).acquire([resource], ttl);
      // FIX: Remove noisy debug log - only log on contention/errors
      return lock;
    } catch (error: any) {
      // Lock acquisition failed (another instance has the lock)
      // FIX: Only log when there's actual contention (not just normal skip)
      if (error?.message && !error.message.includes('already locked')) {
        logger.debug(`[DistributedLock] Failed to acquire lock: ${resource} - ${error?.message || String(error)}`);
      }
      return null;
    }
  }

  /**
   * Acquire a lock with automatic retry
   * @param resource - The lock resource name
   * @param ttl - Time to live in milliseconds
   * @param maxWaitTime - Maximum time to wait for lock (default: 5 seconds)
   * @returns Lock object if acquired, null if timeout
   */
  async acquireLockWithRetry(
    resource: string, 
    ttl: number, 
    maxWaitTime: number = 5000
  ): Promise<Lock | null> {
    if (!this.isInitialized) {
      logger.warn('[DistributedLock] Not initialized, skipping lock acquisition');
      return null;
    }

    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const lock = await this.tryAcquireLock(resource, ttl);
      if (lock) {
        return lock;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.warn(`[DistributedLock] Timeout waiting for lock: ${resource}`);
    return null;
  }

  /**
   * Release a distributed lock
   * @param lock - The lock object to release
   */
  async releaseLock(lock: Lock): Promise<void> {
    if (!lock) return;

    try {
      await lock.release();
      // FIX: Remove noisy debug log - only log on errors
    } catch (error: any) {
      logger.warn(`[DistributedLock] Failed to release lock: ${error?.message || String(error)}`);
    }
  }

  /**
   * Check if the lock manager is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get lock statistics for monitoring
   */
  async getStats(): Promise<{ isReady: boolean; redisConnected: boolean }> {
    return {
      isReady: this.isInitialized,
      redisConnected: this.isInitialized
    };
  }
}

// Export singleton instance
export const distributedLockManager = new DistributedLockManager();

/**
 * Convenience function to execute a task with distributed locking
 * @param resource - Lock resource name
 * @param ttl - Lock TTL in milliseconds
 * @param task - Function to execute if lock is acquired
 * @param options - Additional options
 */
export async function withDistributedLock<T>(
  resource: string,
  ttl: number,
  task: () => Promise<T>,
  options: {
    maxWaitTime?: number;
    skipIfLocked?: boolean;
  } = {}
): Promise<T | null> {
  const { maxWaitTime = 5000, skipIfLocked = true } = options;
  
  let lock: Lock | null = null;
  
  try {
    // Try to acquire lock
    if (skipIfLocked) {
      lock = await distributedLockManager.tryAcquireLock(resource, ttl);
    } else {
      lock = await distributedLockManager.acquireLockWithRetry(resource, ttl, maxWaitTime);
    }

    if (!lock) {
      // FIX: Remove noisy debug - it's normal for another instance to have the lock
      return null;
    }

    // Execute the task (removed noisy logs)
    const result = await task();
    
    return result;
  } catch (error) {
    logger.error(
      `[DistributedLock] Task failed with lock: ${resource}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  } finally {
    // Always release the lock
    if (lock) {
      await distributedLockManager.releaseLock(lock);
    }
  }
}

/**
 * Lock configuration constants
 */
export const LOCK_CONFIG = {
  // Bundle auto-publish scheduler
  BUNDLE_AUTO_PUBLISH: {
    RESOURCE: 'lock:scheduler:bundle-auto-publish',
    TTL: 25000, // 25 seconds (83% of 30s interval)
    INTERVAL: 30000 // 30 seconds
  },
  
  // File status poller
  FILE_STATUS_POLLER: {
    RESOURCE: 'lock:scheduler:file-status-poller',
    TTL: 8000, // 8 seconds (80% of 10s interval)
    INTERVAL: 10000 // 10 seconds
  },
  
  // Bundle status scheduler
  BUNDLE_STATUS_SCHEDULER: {
    RESOURCE: 'lock:scheduler:bundle-status',
    TTL: 8000, // 8 seconds (80% of 10s interval)
    INTERVAL: 10000 // 10 seconds
  }
} as const;
