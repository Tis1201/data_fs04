/**
 * GCloud cleanup background job
 * Handles: Cleanup of orphaned pull files and logs from GCloud storage
 * Run with: npm run gcloud:cleanup
 */

import { logger } from "$lib/server/logger";
import { cleanupOrphanedPullFiles } from "$lib/server/jobs/cleanup-pull-files";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export async function initializeGCloudCleanupProcess() {
    logger.info('🧹 Starting GCloud cleanup background job...');

    try {
        // Run cleanup immediately on startup (optional)
        logger.info('Running initial cleanup...');
        try {
            await cleanupOrphanedPullFiles();
            logger.info('✅ Initial cleanup completed');
        } catch (e: any) {
            logger.warn(`⚠️  Initial cleanup failed: ${e?.message || String(e)}`);
        }

        // Schedule periodic cleanup (every hour)
        setInterval(async () => {
            try {
                logger.info('[CleanupScheduler] Running scheduled cleanup...');
                await cleanupOrphanedPullFiles();
                logger.info('[CleanupScheduler] Scheduled cleanup completed');
            } catch (e: any) {
                logger.error(`[CleanupScheduler] Cleanup job failed: ${e?.message || String(e)}`);
            }
        }, CLEANUP_INTERVAL_MS);

        logger.info(`✅ GCloud cleanup scheduler started (runs every ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes)`);
    } catch (error: unknown) {
        const e = error as any;
        logger.error('❌ Error in GCloud cleanup process initialization', { 
            error: e?.message, 
            stack: e?.stack 
        });
        throw error;
    }
}

