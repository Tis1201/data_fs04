import { logger } from '$lib/server/logger';

// Simple in-process scheduler to auto-publish scheduled bundles.
// Note: for production, move to a durable worker/cron.
export function startBundleAutoPublishScheduler(prisma: any, publisherFn: (bundleId: string) => Promise<void>) {
  const INTERVAL_MS = 30_000; // check every 30s
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick() {
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
    timer = setInterval(tick, INTERVAL_MS);
    logger.info(`[AutoPublish] Scheduler started (interval=${INTERVAL_MS}ms)`);
  }

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    logger.info('[AutoPublish] Scheduler stopped');
  };
}
