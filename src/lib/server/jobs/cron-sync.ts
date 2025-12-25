/**
 * Background Job System - CronJob Sync
 * 
 * Synchronizes CronJob definitions from the database to BullMQ repeatable jobs.
 * Run on worker startup to ensure schedules are active.
 */

import { getQueue } from './client';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { hasHandler } from './registry';
import type { CronJobData } from './types';
import type { CronJob } from '@prisma/client';

/**
 * Sync all ACTIVE CronJobs from DB to BullMQ repeatable jobs.
 * - Adds new jobs
 * - Updates changed schedules
 * - Removes jobs that are no longer active
 */
export async function syncCronJobs(): Promise<void> {
    logger.info('[Jobs/CronSync] Starting sync...');

    try {
        const queue = getQueue();
        const prisma = getAdminPrisma();

        // 1. Get all ACTIVE CronJobs from DB
        const cronJobs = await prisma.cronJob.findMany({
            where: { status: 'ACTIVE' },
        });

        // 2. Get all existing repeatable jobs from BullMQ
        const existingRepeatables = await queue.getRepeatableJobs();
        const existingKeys = new Set(existingRepeatables.map((r) => r.key));

        // 3. Build expected keys map
        const expectedKeys = new Map<string, CronJob>();
        for (const cronJob of cronJobs) {
            // BullMQ repeatable key format: `${name}:::${cron}:::${tz}`
            const key = `${cronJob.functionName}:::${cronJob.cronExpression}:::${cronJob.timezone ?? 'UTC'}`;
            expectedKeys.set(key, cronJob);
        }

        // 4. Add or update jobs
        for (const cronJob of cronJobs) {
            // Validate handler exists
            if (!hasHandler(cronJob.functionName)) {
                logger.warn(
                    `[Jobs/CronSync] Skipping CronJob "${cronJob.name}" - handler "${cronJob.functionName}" not registered`
                );
                continue;
            }

            const jobData: CronJobData = {
                cronJobId: cronJob.id,
                args: cronJob.args as Record<string, unknown> | undefined,
            };

            // Use upsertJobScheduler for idempotent scheduling
            await queue.upsertJobScheduler(
                cronJob.id, // Unique scheduler ID
                {
                    pattern: cronJob.cronExpression,
                    tz: cronJob.timezone ?? 'UTC',
                },
                {
                    name: cronJob.functionName,
                    data: jobData,
                    opts: {
                        attempts: cronJob.maxRetries,
                        ...(cronJob.timeout ? { timeout: cronJob.timeout } : {}),
                    },
                }
            );

            logger.debug(`[Jobs/CronSync] Scheduled: "${cronJob.name}" (${cronJob.cronExpression})`);
        }

        // 5. Remove stale repeatables (jobs in BullMQ but not in DB)
        const activeIds = new Set(cronJobs.map((job: CronJob) => job.id));
        const schedulers = await queue.getJobSchedulers();

        for (const scheduler of schedulers) {
            if (scheduler.id && !activeIds.has(scheduler.id)) {
                await queue.removeJobScheduler(scheduler.id);
                logger.info(`[Jobs/CronSync] Removed stale scheduler: ${scheduler.id}`);
            }
        }

        logger.info(`[Jobs/CronSync] Sync complete. Active crons: ${cronJobs.length}`);
    } catch (error) {
        logger.error(`[Jobs/CronSync] Sync failed: ${error}`);
        throw error;
    }
}

/**
 * Remove a specific CronJob from BullMQ.
 */
export async function removeCronJob(cronJobId: string): Promise<void> {
    const queue = getQueue();
    await queue.removeJobScheduler(cronJobId);
    logger.info(`[Jobs/CronSync] Removed scheduler: ${cronJobId}`);
}

/**
 * Trigger a CronJob immediately (ad-hoc execution).
 */
export async function triggerCronJob(cronJobId: string): Promise<string | undefined> {
    const prisma = getAdminPrisma();
    const cronJob = await prisma.cronJob.findUnique({
        where: { id: cronJobId },
    });

    if (!cronJob) {
        throw new Error(`CronJob not found: ${cronJobId}`);
    }

    const queue = getQueue();
    const job = await queue.add(cronJob.functionName, {
        cronJobId: cronJob.id,
        args: cronJob.args,
    });

    logger.info(`[Jobs/CronSync] Triggered: "${cronJob.name}" (jobId=${job.id})`);
    return job.id;
}
