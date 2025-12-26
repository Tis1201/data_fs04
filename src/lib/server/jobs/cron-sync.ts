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

/**
 * Sync all ACTIVE CronJobs from DB to BullMQ.
 * - Recurring jobs: Added as repeatable jobs with cron schedules
 * - One-time jobs: Added as delayed jobs (run once)
 * - Removes jobs that are no longer active
 */
export async function syncCronJobs(): Promise<void> {
    logger.info('[Jobs/CronSync] Starting sync...');

    try {
        const queue = getQueue();
        const prisma = getAdminPrisma();

        // 1. Get all ACTIVE CronJobs from DB (skip COMPLETED one-time jobs)
        const cronJobs = await (prisma as any).cronJob.findMany({
            where: { status: 'ACTIVE' },
        });

        logger.debug(`[Jobs/CronSync] Found ${cronJobs.length} active cronjobs`);

        // 2. Process recurring jobs (use schedulers)
        const recurringJobs = cronJobs.filter((job: any) => job.isRecurring);
        const oneTimeJobs = cronJobs.filter((job: any) => !job.isRecurring);

        logger.debug(`[Jobs/CronSync] Recurring: ${recurringJobs.length}, One-time: ${oneTimeJobs.length}`);

        // 3. Sync recurring jobs to BullMQ repeatable jobs
        for (const cronJob of recurringJobs) {
            // Validate handler exists
            if (!hasHandler(cronJob.functionName)) {
                logger.warn(
                    `[Jobs/CronSync] Skipping CronJob "${cronJob.name}" - handler "${cronJob.functionName}" not registered`
                );
                continue;
            }

            if (!cronJob.cronExpression) {
                logger.warn(
                    `[Jobs/CronSync] Skipping recurring job "${cronJob.name}" - no cron expression`
                );
                continue;
            }

            const jobData: CronJobData = {
                cronJobId: cronJob.id,
                args: cronJob.args as Record<string, unknown> | undefined,
            };

            // Use upsertJobScheduler for recurring jobs
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

            logger.debug(`[Jobs/CronSync] Scheduled recurring: "${cronJob.name}" (${cronJob.cronExpression})`);
        }

        // 4. Sync one-time jobs to BullMQ as delayed jobs
        for (const cronJob of oneTimeJobs) {
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

            // Calculate delay from now until nextRunAt
            const now = new Date();
            const nextRunAt = cronJob.nextRunAt ? new Date(cronJob.nextRunAt) : now;
            const delay = Math.max(0, nextRunAt.getTime() - now.getTime());

            // Add as a one-time delayed job
            await queue.add(
                cronJob.functionName,
                jobData,
                {
                    jobId: cronJob.id, // Use cronJob ID as BullMQ job ID for tracking
                    delay,
                    attempts: cronJob.maxRetries,
                    ...(cronJob.timeout ? { timeout: cronJob.timeout } : {}),
                }
            );

            logger.debug(`[Jobs/CronSync] Scheduled one-time: "${cronJob.name}" (delay: ${delay}ms)`);
        }

        // 5. Remove stale repeatable jobs (recurring jobs in BullMQ but not in DB)
        const activeRecurringIds = new Set(recurringJobs.map((job: any) => job.id));
        const schedulers = await queue.getJobSchedulers();

        for (const scheduler of schedulers) {
            if (scheduler.id && !activeRecurringIds.has(scheduler.id)) {
                await queue.removeJobScheduler(scheduler.id);
                logger.info(`[Jobs/CronSync] Removed stale scheduler: ${scheduler.id}`);
            }
        }

        logger.info(`[Jobs/CronSync] Sync complete. Recurring: ${recurringJobs.length}, One-time: ${oneTimeJobs.length}`);
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
    const cronJob = await (prisma as any).cronJob.findUnique({
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
