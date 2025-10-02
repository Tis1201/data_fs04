import { logger } from '$lib/server/logger';
import { distributedLockManager, withDistributedLock, LOCK_CONFIG } from './distributedLock';

// Simple in-process scheduler to auto-publish scheduled bundles.
// Note: for production, move to a durable worker/cron.
export function startBundleAutoPublishScheduler(prisma: any, publisherFn: (bundleId: string) => Promise<void>) {
  const INTERVAL_MS = 30_000; // check every 30s
  let timer: ReturnType<typeof setInterval> | null = null;
  let lockManagerInitialized = false;

  // Initialize distributed lock manager if Redis is available
  const initializeLockManager = async () => {
    try {
      // Try to get Redis connection from global state or environment
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD || undefined;
      
      // Create a simple Redis client for distributed locking
      const IORedis = (await import('ioredis')).default;
      const redisClient = new IORedis(redisUrl);
      
      const redisService = { client: redisClient };
      await distributedLockManager.initialize(redisService);
      lockManagerInitialized = true;
      logger.info('[AutoPublish] Distributed lock manager initialized');
    } catch (error) {
      logger.warn(`[AutoPublish] Failed to initialize distributed lock manager: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  async function tick() {
    // Use distributed locking if available, otherwise run without a lock
    if (lockManagerInitialized) {
      await withDistributedLock(
        LOCK_CONFIG.BUNDLE_AUTO_PUBLISH.RESOURCE,
        LOCK_CONFIG.BUNDLE_AUTO_PUBLISH.TTL,
        tickWithoutLock,
        { skipIfLocked: true }
      );
    } else {
      // Fallback to running without lock (single instance or Redis unavailable)
      await tickWithoutLock();
    }
  }

  async function tickWithoutLock() {
    try {
      const now = new Date();
      // Find bundles scheduled in the past that are still DRAFT
      const due = await prisma.bundle.findMany({
        where: {
          status: 'DRAFT',
          scheduledAt: { lte: now }
        },
        select: { id: true, name: true }
      });
      for (const b of due) {
        try {
          logger.info(`[AutoPublish] Publishing scheduled bundle ${b.id} (${b.name || ''})`);
          await publisherFn(b.id);
        } catch (e: any) {
          logger.warn(`[AutoPublish] Failed to publish bundle ${b.id}: ${e?.message || String(e)}`);
        }
      }
    } catch (e: any) {
      logger.warn(`[AutoPublish] Tick failed: ${e?.message || String(e)}`);
    }
  }

  if (!timer) {
    // Initialize lock manager before starting timer
    initializeLockManager().then(() => {
      timer = setInterval(tick, INTERVAL_MS);
      logger.info(`[AutoPublish] Scheduler started (interval=${INTERVAL_MS}ms)`);
    });
  }

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    logger.info('[AutoPublish] Scheduler stopped');
  };
}
