/**
 * Job Worker Entry Point
 * 
 * Standalone process for processing background jobs.
 * Run with: npm run job:worker
 */

import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { logger } from '$lib/server/logger';
import { createWorker, stopWorker } from '$lib/server/jobs/worker';
import { syncCronJobs, reconcileCronJobsWithRedis } from '$lib/server/jobs/cron-sync';
import { timeoutProfileApplying } from '$lib/server/jobs/handlers/timeout-profile-applying';

// Import registry to ensure handlers are registered
import '$lib/server/jobs/registry';

const RECONCILE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const PROFILE_APPLYING_TIMEOUT_INTERVAL_MS = 1 * 60 * 1000; // 1 minute (so timeout job runs often; handler marks APPLYING older than 3 min as FAILED)

let isShuttingDown = false;
let reconcileIntervalId: ReturnType<typeof setInterval> | null = null;
let profileApplyingTimeoutIntervalId: ReturnType<typeof setInterval> | null = null;

async function main(): Promise<void> {
    logger.info('[JobWorker] Starting job worker process...');

    try {
        // Start the worker
        createWorker();

        // Sync CronJobs from DB to BullMQ
        logger.info('[JobWorker] Syncing CronJobs...');
        await syncCronJobs();

        // Reconcile: re-add one-time jobs that never ran (totalRuns=0) if missing from Redis
        logger.info('[JobWorker] Running initial reconciliation (DB vs Redis)...');
        await reconcileCronJobsWithRedis();

        // Run reconciliation every hour so jobs added while worker/Redis was down get re-queued
        reconcileIntervalId = setInterval(() => {
            reconcileCronJobsWithRedis().catch((err) => {
                logger.error(`[JobWorker] Hourly reconciliation failed: ${err}`);
            });
        }, RECONCILE_INTERVAL_MS);
        logger.info(`[JobWorker] Hourly reconciliation scheduled (every ${RECONCILE_INTERVAL_MS / 60000} min)`);

        // Mark device profile assignments stuck in APPLYING as FAILED (e.g. device never reported back)
        await timeoutProfileApplying({}, null as any);
        profileApplyingTimeoutIntervalId = setInterval(() => {
            timeoutProfileApplying({}, null as any).catch((err) => {
                logger.error(`[JobWorker] Profile applying timeout check failed: ${err}`);
            });
        }, PROFILE_APPLYING_TIMEOUT_INTERVAL_MS);
        logger.info(`[JobWorker] Profile applying timeout check scheduled (every ${PROFILE_APPLYING_TIMEOUT_INTERVAL_MS / 60000} min)`);

        logger.info('[JobWorker] Worker is running. Press Ctrl+C to stop.');
    } catch (error) {
        logger.error(`[JobWorker] Failed to start: ${error}`);
        process.exit(1);
    }
}

async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[JobWorker] Received ${signal}, shutting down gracefully...`);

    try {
        if (reconcileIntervalId) {
            clearInterval(reconcileIntervalId);
            reconcileIntervalId = null;
        }
        if (profileApplyingTimeoutIntervalId) {
            clearInterval(profileApplyingTimeoutIntervalId);
            profileApplyingTimeoutIntervalId = null;
        }
        await stopWorker();
        logger.info('[JobWorker] Shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error(`[JobWorker] Error during shutdown: ${error}`);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Run if this is the entry point
if (process.argv[1]) {
    const entryHref = pathToFileURL(process.argv[1]).href;
    if (import.meta.url === entryHref) {
        main();
    }
}

export { main, shutdown };
