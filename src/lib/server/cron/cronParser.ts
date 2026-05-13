import { Cron } from 'croner';
import { logger } from '$lib/server/logger';

/**
 * Validate a cron expression
 * @param cronExpression - Cron expression to validate
 * @returns true if valid, false otherwise
 */
export function validateCronExpression(cronExpression: string): boolean {
  try {
    new Cron(cronExpression, { timezone: 'UTC' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Calculate next run time from cron expression
 * @param cronExpression - Cron expression
 * @param fromDate - Optional date to calculate from (defaults to now)
 * @returns Next run date or null if invalid
 */
export function calculateNextRun(cronExpression: string, fromDate?: Date): Date | null {
  try {
    const cron = new Cron(cronExpression, {
      timezone: 'UTC'
    });
    const next = cron.nextRun(fromDate);
    return next ? new Date(next) : null;
  } catch (error) {
    logger.error(`[CronParser] Invalid cron expression: ${cronExpression}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

