import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

import { logger } from '$lib/server/logger';
import { getActiveCronjobs, deserializeCronJob, type CachedCronJob } from '$lib/server/cron/cache';
import { executeFunction, hasFunction } from '$lib/server/cron/registry';
import { distributedLockManager, withDistributedLock } from '$lib/server/scheduler/distributedLock';
import { Cron } from 'croner';

export const adminPrisma = new PrismaClient();

// Worker state
let started = false;
let pollInterval: NodeJS.Timeout | null = null;
let lockManagerInitialized = false;

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize distributed lock manager with Redis
 */
async function initializeLockManager() {
  if (lockManagerInitialized) return;

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    const redisClient = new IORedis(redisUrl, {
      password: redisPassword
    });

    const redisService = { client: redisClient };
    await distributedLockManager.initialize(redisService);
    lockManagerInitialized = true;
    logger.info('[CronWorker] Distributed lock manager initialized');
  } catch (error) {
    logger.warn(
      `[CronWorker] Failed to initialize distributed lock manager: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Calculate next run time from cron expression
 */
function calculateNextRun(cronExpression: string, fromDate?: Date): Date | null {
  try {
    const cron = new Cron(cronExpression, {
      timezone: 'UTC'
    });
    const next = cron.nextRun(fromDate);
    return next ? new Date(next) : null;
  } catch (error) {
    logger.error(`[CronWorker] Invalid cron expression: ${cronExpression}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Execute a single cronjob
 */
async function executeCronJob(cachedJob: CachedCronJob): Promise<void> {
  const job = deserializeCronJob(cachedJob);
  const lockResource = `lock:cronjob:${job.id}`;
  const startTime = Date.now();

  logger.info(`[CronWorker] Processing job: ${job.name} (${job.id})`);

  // Use distributed lock to prevent duplicate execution
  await withDistributedLock(
    lockResource,
    LOCK_TTL_MS,
    async () => {
      try {
        // Double-check job is still active and not running
        const currentJob = await (adminPrisma as any).cronJob.findUnique({
          where: { id: job.id }
        });

        if (!currentJob || currentJob.status !== 'SCHEDULED' || currentJob.isRunning) {
          logger.debug(`[CronWorker] Job ${job.id} is no longer eligible for execution`);
          return;
        }

        // Mark as running
        await (adminPrisma as any).cronJob.update({
          where: { id: job.id },
          data: { isRunning: true }
        });

        // Create execution record
        const execution = await (adminPrisma as any).cronJobExecution.create({
          data: {
            cronJobId: job.id,
            status: 'RUNNING',
            startedAt: new Date()
          }
        });

        let executionResult: any = { success: true };
        let executionError: string | null = null;

        try {
          // Validate function exists
          if (!hasFunction(job.functionName)) {
            throw new Error(`Function '${job.functionName}' not found in registry`);
          }

          // Prepare execution context
          const context = {
            prisma: adminPrisma,
            logger,
            jobId: job.id,
            jobName: job.name
          };

          // Execute with timeout if specified
          if (job.timeout && job.timeout > 0) {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Job timeout after ${job.timeout}ms`)), job.timeout!);
            });

            const executionPromise = executeFunction(job.functionName, job.args, context);

            executionResult = await Promise.race([executionPromise, timeoutPromise]);
          } else {
            executionResult = await executeFunction(job.functionName, job.args, context);
          }

          if (!executionResult.success) {
            executionError = executionResult.error || executionResult.message || 'Unknown error';
            throw new Error(executionError || 'Unknown error');
          }
        } catch (error) {
          executionError = error instanceof Error ? error.message : String(error);
          executionResult = {
            success: false,
            error: executionError
          };
          throw error;
        } finally {
          const duration = Date.now() - startTime;
          const nextRunAt = calculateNextRun(job.cronExpression);

          // Update job status
          await (adminPrisma as any).cronJob.update({
            where: { id: job.id },
            data: {
              isRunning: false,
              lastRunAt: new Date(),
              nextRunAt: nextRunAt,
              lastResult: executionError || executionResult.message || 'Success',
              retryCount: executionResult.success ? 0 : (job.retryCount + 1)
            }
          });

          // Update execution record
          await (adminPrisma as any).cronJobExecution.update({
            where: { id: execution.id },
            data: {
              status: executionResult.success ? 'SUCCESS' : 'FAILED',
              completedAt: new Date(),
              duration,
              result: executionResult.success ? executionResult.message : null,
              error: executionError,
              metadata: executionResult.metadata ? JSON.parse(JSON.stringify(executionResult.metadata)) : null
            }
          });

          // Handle retries if failed
          if (!executionResult.success && job.retryCount < job.maxRetries) {
            logger.warn(
              `[CronWorker] Job ${job.id} failed, will retry (${job.retryCount + 1}/${job.maxRetries})`
            );
            // Reset isRunning to allow retry on next poll
            await (adminPrisma as any).cronJob.update({
              where: { id: job.id },
              data: { isRunning: false }
            });
          } else if (!executionResult.success) {
            logger.error(
              `[CronWorker] Job ${job.id} failed after ${job.maxRetries} retries, marking as failed`
            );
            // Mark job as FAILED after exhausting retries
            await (adminPrisma as any).cronJob.update({
              where: { id: job.id },
              data: { status: 'FAILED' }
            });
          }

          logger.info(`[CronWorker] Job ${job.id} completed in ${duration}ms`, {
            success: executionResult.success,
            duration
          });
        }
      } catch (error) {
        logger.error(`[CronWorker] Error executing job ${job.id}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        // Ensure isRunning is reset on error
        try {
          await (adminPrisma as any).cronJob.update({
            where: { id: job.id },
            data: { isRunning: false }
          });
        } catch (updateError) {
          logger.error(`[CronWorker] Failed to reset isRunning for job ${job.id}:`, {
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        }
      }
    },
    { skipIfLocked: true }
  );
}

/**
 * Poll for due cronjobs and execute them
 */
async function pollAndExecute(): Promise<void> {
  try {
    // Get active cronjobs from cache
    const cachedJobs = await getActiveCronjobs();
    const now = new Date();

    // Filter jobs that are due for execution
    const dueJobs = cachedJobs.filter((job) => {
      logger.debug(`[CronWorker] Checking job: ${job.name} (${job.id})`, {
        status: job.status,
        isRunning: job.isRunning,
        nextRunAt: job.nextRunAt,
        now: now.toISOString()
      });

      if (job.status !== 'SCHEDULED') {
        logger.debug(`[CronWorker] Job ${job.name} filtered: status is ${job.status} (not SCHEDULED)`);
        return false;
      }
      if (job.isRunning) {
        logger.debug(`[CronWorker] Job ${job.name} filtered: isRunning is true`);
        return false;
      }

      // Parse nextRunAt as UTC (PostgreSQL stores timestamps in UTC)
      // If the string doesn't have timezone info, assume it's UTC
      let nextRunAt: Date | null = null;
      if (job.nextRunAt) {
        const nextRunAtStr = job.nextRunAt;
        // Check if string already has timezone indicator (Z, +, or -)
        if (nextRunAtStr.endsWith('Z') || nextRunAtStr.includes('+') || (nextRunAtStr.includes('-') && nextRunAtStr.length > 10)) {
          // Already has timezone info, parse as-is
          nextRunAt = new Date(nextRunAtStr);
        } else {
          // No timezone info - assume UTC (PostgreSQL default)
          // Handle both ISO format (with T) and SQL format (with space)
          const utcStr = nextRunAtStr.includes('T') ? nextRunAtStr + 'Z' : nextRunAtStr.replace(' ', 'T') + 'Z';
          nextRunAt = new Date(utcStr);
        }
      }
      
      if (!nextRunAt) {
        logger.debug(`[CronWorker] Job ${job.name} filtered: nextRunAt is null`);
        return false;
      }

      const isDue = nextRunAt <= now;
      
      logger.debug(`[CronWorker] Job ${job.name} due check:`, {
        nextRunAt: nextRunAt.toISOString(),
        now: now.toISOString(),
        nextRunAtTimestamp: nextRunAt.getTime(),
        nowTimestamp: now.getTime(),
        isDue: isDue
      });

      return isDue;
    });

    if (dueJobs.length === 0) {
      logger.debug(`[CronWorker] No due jobs found (checked ${cachedJobs.length} active jobs)`, {
        now: now.toISOString(),
        nowLocal: now.toString(),
        jobsChecked: cachedJobs.map(j => ({
          name: j.name,
          nextRunAt: j.nextRunAt,
          status: j.status,
          isRunning: j.isRunning
        }))
      });
      return;
    }

    logger.info(`[CronWorker] Found ${dueJobs.length} due job(s) to execute`);

    // Execute jobs in parallel (with distributed locking preventing duplicates)
    await Promise.allSettled(dueJobs.map((job) => executeCronJob(job)));
  } catch (error) {
    logger.error(`[CronWorker] Error in poll cycle:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

/**
 * Start the cron worker
 */
export function startCronWorker(): void {
  if (started) {
    logger.info('[CronWorker] Worker already running');
    return;
  }

  logger.info('[CronWorker] Starting cron worker...');
  started = true;

  (async () => {
    try {
      // Initialize distributed lock manager
      await initializeLockManager();

      // Start polling loop
      logger.info(`[CronWorker] Starting poll loop (interval: ${POLL_INTERVAL_MS}ms)`);
      
      // Initial poll after 5 seconds
      setTimeout(() => {
        pollAndExecute().catch((err) => {
          logger.error(`[CronWorker] Initial poll failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      }, 5000);

      // Set up periodic polling
      pollInterval = setInterval(() => {
        pollAndExecute().catch((err) => {
          logger.error(`[CronWorker] Poll cycle failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      }, POLL_INTERVAL_MS);

      logger.info('[CronWorker] Cron worker started successfully');
    } catch (error) {
      logger.error(`[CronWorker] Failed to start worker: ${error instanceof Error ? error.message : String(error)}`);
      started = false;
    }
  })();

  // Graceful shutdown
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info(`[CronWorker] Caught ${signal}, shutting down...`);
    
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    started = false;
    
    // Clean up running jobs (reset isRunning flag for any stuck jobs)
    (async () => {
      try {
        const runningJobs = await (adminPrisma as any).cronJob.findMany({
          where: { isRunning: true }
        });

        if (runningJobs.length > 0) {
          logger.warn(`[CronWorker] Resetting ${runningJobs.length} stuck job(s) on shutdown`);
          await (adminPrisma as any).cronJob.updateMany({
            where: { isRunning: true },
            data: { isRunning: false }
          });
        }
      } catch (error) {
        logger.error(`[CronWorker] Error cleaning up jobs: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        await adminPrisma.$disconnect();
        process.exit(0);
      }
    })();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

// Auto-start if run directly
if (process.argv[1]) {
  const entryHref = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryHref) {
    startCronWorker();
  }
}

