/**
 * Background Job System - BullMQ Queue Client
 * 
 * Exports the shared queue instance and helper functions for adding jobs.
 * Reuses the existing Redis connection from $lib/server/redis.
 */

import { Queue, type JobsOptions } from 'bullmq';
import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';
import type { AddJobOptions } from './types';

const QUEUE_NAME = 'main-jobs';

// Default job options
const DEFAULT_JOB_OPTIONS: JobsOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 24 * 60 * 60 }, // 24 hours
    removeOnFail: { count: 1000 },
};

// Create queue only if Redis is available
let jobQueue: Queue | null = null;

function getQueue(): Queue {
    if (!jobQueue) {
        if (!redis) {
            throw new Error('Redis is not available. Cannot create job queue.');
        }
        jobQueue = new Queue(QUEUE_NAME, {
            connection: redis,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        logger.info(`[Jobs] Queue "${QUEUE_NAME}" initialized`);
    }
    return jobQueue;
}

/**
 * Add an async job to the queue.
 * @param name - Job name (must be registered in the registry)
 * @param data - Data to pass to the job handler
 * @param options - Optional job configuration
 * @returns The created job
 */
export async function addJob<T extends Record<string, unknown>>(
    name: string,
    data: T,
    options?: AddJobOptions
) {
    const queue = getQueue();
    const job = await queue.add(name, data, options);
    logger.info(`[Jobs] Added job: ${name} (id=${job.id})`);
    return job;
}

/**
 * Get a job by ID for status polling.
 */
export async function getJobById(jobId: string) {
    const queue = getQueue();
    return queue.getJob(jobId);
}

/**
 * Get the queue instance (for advanced use cases).
 */
export { getQueue, QUEUE_NAME };
