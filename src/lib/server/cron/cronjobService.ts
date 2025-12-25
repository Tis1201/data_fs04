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
   * Required for recurring jobs, optional for one-time jobs
   */
  cronExpression?: string;
  
  /**
   * Optional: Target date/time for one-time execution
   * If provided, creates a one-time job (isRecurring = false)
   */
  targetDate?: Date;
  
  /**
   * Whether this is a recurring job (default: true)
   * Set to false for one-time jobs
   */
  isRecurring?: boolean;
  
  /**
   * Status of the cronjob
   */
  status?: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'COMPLETED';
  
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
      isRecurring,
      status = 'ACTIVE',
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

    // Determine job type, cron expression, and next run time
    let finalCronExpression: string | null;
    let finalIsRecurring: boolean;
    let nextRunAt: Date | null;

    if (targetDate) {
      // One-time job with target date
      finalIsRecurring = isRecurring ?? false; // Default to one-time if targetDate provided
      finalCronExpression = null; // No cron expression for one-time jobs
      
      // Ensure targetDate is treated as UTC
      const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
      const now = new Date();
      
      // Calculate next run time in UTC
      if (target <= now) {
        // Target is in the past, run in 1 minute
        nextRunAt = new Date(now.getTime() + 60 * 1000);
      } else {
        // Use the target date as-is
        nextRunAt = target;
      }
    } else if (cronExpression) {
      // Recurring job with cron expression
      finalIsRecurring = isRecurring ?? true; // Default to recurring if cronExpression provided
      
      // Validate cron expression
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
      isRecurring: finalIsRecurring,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`[CronJobService] Error upserting cronjob '${options.name}': ${errorMessage}`, {
      error: errorMessage,
      stack: errorStack
    });
    console.error('[CronJobService] Full error:', error);
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
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'COMPLETED'
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

