import { logger } from '$lib/server/logger';
import { calculateNextRun, validateCronExpression } from '$lib/server/cron/cronParser';
import { hasFunction } from '$lib/server/cron/registry';
import { invalidateCache } from '$lib/server/cron/cache';

/**
 * Options for creating/updating a cronjob
 */
export interface CronJobOptions {
  /**
   * Unique name for the cronjob (used to find existing jobs)
   */
  name: string;
  
  /**
   * Function name from the registry
   */
  functionName: string;
  
  /**
   * Arguments to pass to the function
   */
  args?: any;
  
  /**
   * Cron expression (e.g., "0 0 * * *" for daily at midnight)
   */
  cronExpression?: string;
  
  /**
   * Optional: Target date/time for one-time execution
   * If provided, cronExpression will be calculated to run at this time
   */
  targetDate?: Date;
  
  /**
   * Status of the cronjob
   */
  status?: 'SCHEDULED' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  
  /**
   * Maximum retries on failure
   */
  maxRetries?: number;
  
  /**
   * Timeout in milliseconds
   */
  timeout?: number | null;
  
  /**
   * User ID creating/updating the cronjob (optional for system cronjobs)
   */
  userId?: string | null;
  
  /**
   * Optional account ID
   */
  accountId?: string | null;
  
  /**
   * Optional description
   */
  description?: string;
}

/**
 * Generic function to create or update a cronjob
 * Can be used from any part of the application
 * 
 * @param prisma - Prisma client instance
 * @param options - Cronjob options
 * @returns The created/updated cronjob or null if error
 */
export async function upsertCronJob(
  prisma: any,
  options: CronJobOptions
): Promise<any | null> {
  try {
    const {
      name,
      functionName,
      args = {},
      cronExpression,
      targetDate,
      status = 'SCHEDULED',
      maxRetries = 3,
      timeout = null,
      userId = null,
      accountId = null,
      description
    } = options;

    // Validate function exists in registry
    if (!hasFunction(functionName)) {
      logger.error(`[CronJobService] Function '${functionName}' not found in registry`);
      return null;
    }

    // Determine cron expression and next run time
    let finalCronExpression: string;
    let nextRunAt: Date | null;

    if (targetDate) {
      // If targetDate is provided, use daily cron starting from that date
      // Default to daily at midnight UTC
      finalCronExpression = '0 0 * * *'; // Daily at midnight UTC
      
      // Ensure targetDate is treated as UTC
      const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
      const now = new Date();
      
      // Calculate next run time in UTC
      if (target <= now) {
        // Target is in the past, run in 1 minute
        nextRunAt = new Date(now.getTime() + 60 * 1000);
      } else {
        // Create date in UTC explicitly
        // Get UTC components from target date
        const targetUTC = new Date(Date.UTC(
          target.getUTCFullYear(),
          target.getUTCMonth(),
          target.getUTCDate(),
          0, 0, 0, 0
        ));
        
        // If target is today, ensure it runs at least 1 minute from now
        if (targetUTC <= now) {
          nextRunAt = new Date(now.getTime() + 60 * 1000);
        } else {
          nextRunAt = targetUTC;
        }
      }
    } else if (cronExpression) {
      // Use provided cron expression
      if (!validateCronExpression(cronExpression)) {
        logger.error(`[CronJobService] Invalid cron expression: ${cronExpression}`);
        return null;
      }
      finalCronExpression = cronExpression;
      nextRunAt = calculateNextRun(cronExpression);
    } else {
      logger.error('[CronJobService] Either cronExpression or targetDate must be provided');
      return null;
    }

    if (!nextRunAt) {
      logger.error('[CronJobService] Failed to calculate next run time');
      return null;
    }

    // Check if cronjob already exists
    const existingCronjob = await (prisma as any).cronJob.findFirst({
      where: {
        name
      }
    });

    const cronJobData: any = {
      name,
      functionName,
      args,
      cronExpression: finalCronExpression,
      status,
      nextRunAt,
      maxRetries,
      timeout,
      createdBy: userId,
      accountId
    };

    let cronjob;
    if (existingCronjob) {
      // Update existing cronjob
      cronjob = await (prisma as any).cronJob.update({
        where: { id: existingCronjob.id },
        data: {
          ...cronJobData,
          // Preserve original creator on update
          createdBy: existingCronjob.createdBy
        }
      });
      logger.info(`[CronJobService] Updated cronjob: ${name} (${cronjob.id})`);
    } else {
      // Create new cronjob
      cronjob = await (prisma as any).cronJob.create({
        data: cronJobData
      });
      logger.info(`[CronJobService] Created cronjob: ${name} (${cronjob.id})`);
    }

    // Invalidate cache
    await invalidateCache();

    return cronjob;
  } catch (error) {
    logger.error(`[CronJobService] Error upserting cronjob '${options.name}':`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

/**
 * Delete a cronjob by name
 * 
 * @param prisma - Prisma client instance
 * @param name - Cronjob name
 */
export async function deleteCronJobByName(
  prisma: any,
  name: string
): Promise<void> {
  try {
    const cronjob = await (prisma as any).cronJob.findFirst({
      where: { name }
    });

    if (cronjob) {
      await (prisma as any).cronJob.delete({
        where: { id: cronjob.id }
      });

      // Invalidate cache
      await invalidateCache();

      logger.info(`[CronJobService] Deleted cronjob: ${name} (${cronjob.id})`);
    }
  } catch (error) {
    logger.error(`[CronJobService] Error deleting cronjob '${name}':`, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Delete a cronjob by ID
 * 
 * @param prisma - Prisma client instance
 * @param id - Cronjob ID
 */
export async function deleteCronJobById(
  prisma: any,
  id: string
): Promise<void> {
  try {
    await (prisma as any).cronJob.delete({
      where: { id }
    });

    // Invalidate cache
    await invalidateCache();

    logger.info(`[CronJobService] Deleted cronjob: ${id}`);
  } catch (error) {
    logger.error(`[CronJobService] Error deleting cronjob '${id}':`, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Update cronjob status
 * 
 * @param prisma - Prisma client instance
 * @param name - Cronjob name
 * @param status - New status
 */
export async function updateCronJobStatus(
  prisma: any,
  name: string,
  status: 'SCHEDULED' | 'COMPLETED' | 'FAILED' | 'PAUSED'
): Promise<void> {
  try {
    const cronjob = await (prisma as any).cronJob.findFirst({
      where: { name }
    });

    if (cronjob) {
      await (prisma as any).cronJob.update({
        where: { id: cronjob.id },
        data: { status }
      });

      // Invalidate cache
      await invalidateCache();

      logger.info(`[CronJobService] Updated cronjob status: ${name} -> ${status}`);
    }
  } catch (error) {
    logger.error(`[CronJobService] Error updating cronjob status '${name}':`, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

