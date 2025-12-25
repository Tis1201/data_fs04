/**
 * Background Job System - BullMQ Worker
 * 
 * Processes jobs from the queue using registered handlers.
 * Also updates CronJob records in the database for scheduled tasks.
 */

import { Worker, type Job } from 'bullmq';
import redis from '$lib/server/redis';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { getHandler, hasHandler } from './registry';
import { QUEUE_NAME } from './client';
import type { CronJobData } from './types';

// Worker configuration
const WORKER_CONCURRENCY = 5;

let worker: Worker | null = null;

/**
 * Create and start the BullMQ worker.
 */
export function createWorker(): Worker {
    if (worker) {
        logger.warn('[Jobs/Worker] Worker already running');
        return worker;
    }

    if (!redis) {
        throw new Error('Redis is not available. Cannot create job worker.');
    }

    worker = new Worker(
        QUEUE_NAME,
        async (job: Job) => {
            const jobName = job.name;
            const isCronJob = job.opts.repeat !== undefined;

            logger.info(`[Jobs/Worker] Processing: ${jobName} (id=${job.id}, cron=${isCronJob})`);

            // Check if handler exists
            if (!hasHandler(jobName)) {
                const error = `No handler registered for job: ${jobName}`;
                logger.error(`[Jobs/Worker] ${error}`);
                throw new Error(error);
            }

            const handler = getHandler(jobName)!;
            const cronJobId = (job.data as CronJobData)?.cronJobId;

            // Mark CronJob as running (if applicable)
            if (isCronJob && cronJobId) {
                await updateCronJobStatus(cronJobId, { isRunning: true });
            }

            try {
                // Execute the handler
                const result = await handler(job.data, job);

                // Update CronJob on success
                if (isCronJob && cronJobId) {
                    await updateCronJobStatus(cronJobId, {
                        isRunning: false,
                        lastRunAt: new Date(),
                        lastResult: 'success',
                        lastError: null,
                        retryCount: 0,
                        totalRuns: { increment: 1 },
                        successCount: { increment: 1 },
                    });
                }

                logger.info(`[Jobs/Worker] Completed: ${jobName} (id=${job.id})`);
                return result;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;

                // Update CronJob on failure
                if (isCronJob && cronJobId) {
                    await updateCronJobStatus(cronJobId, {
                        isRunning: false,
                        lastResult: 'failed',
                        lastError: errorStack ?? errorMessage,
                        retryCount: { increment: 1 },
                        totalRuns: { increment: 1 },
                        failureCount: { increment: 1 },
                    });
                }

                logger.error(`[Jobs/Worker] Failed: ${jobName} (id=${job.id}) - ${errorMessage}`);
                throw error; // Re-throw for BullMQ retry handling
            }
        },
        {
            connection: redis,
            concurrency: WORKER_CONCURRENCY,
        }
    );

    // Worker event listeners
    worker.on('completed', (job) => {
        logger.debug(`[Jobs/Worker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[Jobs/Worker] Job ${job?.id} failed: ${err.message}`);
    });

    worker.on('error', (err) => {
        logger.error(`[Jobs/Worker] Worker error: ${err.message}`);
    });

    logger.info(`[Jobs/Worker] Started (concurrency=${WORKER_CONCURRENCY})`);
    return worker;
}

/**
 * Stop the worker gracefully.
 */
export async function stopWorker(): Promise<void> {
    if (worker) {
        logger.info('[Jobs/Worker] Stopping...');
        await worker.close();
        worker = null;
        logger.info('[Jobs/Worker] Stopped');
    }
}

/**
 * Helper to update CronJob status in the database.
 */
async function updateCronJobStatus(
    cronJobId: string,
    data: Record<string, unknown>
): Promise<void> {
    try {
        const prisma = getAdminPrisma();
        await prisma.cronJob.update({
            where: { id: cronJobId },
            data,
        });
    } catch (error) {
        logger.error(`[Jobs/Worker] Failed to update CronJob ${cronJobId}: ${error}`);
    }
}

export { worker };
