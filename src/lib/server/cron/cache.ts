import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';
import { PrismaClient } from '@prisma/client';

const CRONJOB_CACHE_KEY = 'cronjobs:active';

// Use raw Prisma client for cache operations (no Zenstack enhancement)
// This allows the cache to work in both SvelteKit and standalone worker contexts
const prisma = new PrismaClient();

/**
 * CronJob cache entry type
 */
export type CachedCronJob = {
  id: string;
  name: string;
  functionName: string;
  args: any;
  cronExpression: string;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: string | null;
  retryCount: number;
  maxRetries: number;
  timeout: number | null;
  isRunning: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  accountId: string | null;
};

/**
 * Get all active cronjobs from Redis cache
 * Falls back to database if Redis is unavailable or cache miss
 * @returns Array of active cronjob records
 */
export async function getActiveCronjobs(): Promise<CachedCronJob[]> {
  // Try to get from cache first
  if (redis) {
    try {
      const cached = await redis.get(CRONJOB_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedCronJob[];
        logger.debug(`[CronJobCache] Cache hit - found ${parsed.length} active cronjobs`);
        return parsed;
      }
    } catch (error) {
      logger.warn(
        `[CronJobCache] Error reading from cache: ${error instanceof Error ? error.message : String(error)}`
      );
      // Fall through to database query
    }
  }

  // Cache miss or Redis unavailable - query database
  logger.debug('[CronJobCache] Cache miss, querying database for active cronjobs');
  try {
    // Type assertion needed until Prisma generates types after migration
    const cronjobs = await (prisma as any).cronJob.findMany({
      where: {
        status: 'ACTIVE'
      },
      orderBy: {
        nextRunAt: 'asc'
      }
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serialized = cronjobs.map((job: any) => ({
      id: job.id,
      name: job.name,
      functionName: job.functionName,
      args: job.args,
      cronExpression: job.cronExpression,
      status: job.status,
      lastRunAt: job.lastRunAt?.toISOString() ?? null,
      nextRunAt: job.nextRunAt?.toISOString() ?? null,
      lastResult: job.lastResult,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      timeout: job.timeout,
      isRunning: job.isRunning,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      createdBy: job.createdBy,
      accountId: job.accountId
    }));

    // Cache the result if Redis is available
    if (redis) {
      try {
        // No TTL - cache persists until manually invalidated
        await redis.set(CRONJOB_CACHE_KEY, JSON.stringify(serialized));
        logger.debug(`[CronJobCache] Cached ${serialized.length} active cronjobs`);
      } catch (error) {
        // Don't fail the request if caching fails
        logger.warn(
          `[CronJobCache] Error caching cronjobs: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return serialized;
  } catch (error) {
    logger.error(
      `[CronJobCache] Error querying database: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * Invalidate the cronjob cache
 * Call this when cronjobs are created, updated, or deleted
 */
export async function invalidateCache(): Promise<void> {
  if (!redis) {
    logger.debug('[CronJobCache] Redis not available, skipping cache invalidation');
    return;
  }

  try {
    await redis.del(CRONJOB_CACHE_KEY);
    logger.debug('[CronJobCache] Invalidated cache');
  } catch (error) {
    logger.warn(
      `[CronJobCache] Error invalidating cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Refresh the cache by reloading from database
 * Useful for manual cache refresh or after bulk operations
 */
export async function refreshCache(): Promise<void> {
  logger.debug('[CronJobCache] Refreshing cache from database');
  await invalidateCache();
  await getActiveCronjobs();
  logger.debug('[CronJobCache] Cache refreshed');
}

/**
 * Convert cached cronjob back to format with Date objects
 * Useful when working with cached data that needs Date objects
 */
export function deserializeCronJob(cached: CachedCronJob) {
  return {
    ...cached,
    lastRunAt: cached.lastRunAt ? new Date(cached.lastRunAt) : null,
    nextRunAt: cached.nextRunAt ? new Date(cached.nextRunAt) : null,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt)
  };
}

