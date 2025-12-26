/**
 * Background Job System - BullMQ Queue Client
 * 
 * Exports the shared queue instance and helper functions for adding jobs.
 * Creates a separate Redis connection for BullMQ with required configuration.
 */

import { Queue, type JobsOptions } from 'bullmq';
import Redis from 'ioredis';
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

// BullMQ requires maxRetriesPerRequest: null
// Create a separate Redis connection for BullMQ
let bullmqRedis: Redis | null = null;
let jobQueue: Queue | null = null;

function getBullMQRedis(): Redis {
    if (!bullmqRedis) {
        const connectionUrl = process.env.REDIS_URL;
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379', 10);
        const password = process.env.REDIS_PASSWORD;

        if (!connectionUrl && !host) {
            throw new Error('Redis is not available. Cannot create job queue.');
        }

        // BullMQ requires maxRetriesPerRequest: null
        const options: Redis.RedisOptions = {
            maxRetriesPerRequest: null, // Required by BullMQ
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        };

        bullmqRedis = connectionUrl
            ? new Redis(connectionUrl, options)
            : new Redis({
                host,
                port,
                password: password || undefined,
                ...options
            });

        bullmqRedis.on('error', (err) => {
            logger.error(`[Jobs/BullMQ] Redis client error: ${err.message}`);
        });

        bullmqRedis.on('connect', () => {
            logger.info('[Jobs/BullMQ] Redis client connected');
        });

        logger.info('[Jobs/BullMQ] Created Redis connection for BullMQ');
    }
    return bullmqRedis;
}

function getQueue(): Queue {
    if (!jobQueue) {
        const redis = getBullMQRedis();
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
