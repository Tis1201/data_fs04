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
import { syncCronJobs } from '$lib/server/jobs/cron-sync';

// Import registry to ensure handlers are registered
import '$lib/server/jobs/registry';

let isShuttingDown = false;

async function main(): Promise<void> {
    logger.info('[JobWorker] Starting job worker process...');

    try {
        // Start the worker
        createWorker();

        // Sync CronJobs from DB to BullMQ
        logger.info('[JobWorker] Syncing CronJobs...');
        await syncCronJobs();

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
