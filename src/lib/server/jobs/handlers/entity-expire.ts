/**
 * Entity Expire Handler for BullMQ Job System
 * 
 * This handler adapts the entity-expire cronjob function to work with BullMQ.
 * It bridges the old CronFunction signature with the new JobHandler signature.
 */

import type { JobHandler } from '../types';
import { entityExpire } from '$lib/server/cron/functions/entity-expire';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * Handler for entity expiration jobs
 * Adapts entity-expire function to JobHandler signature
 */
export const entityExpireHandler: JobHandler = async (data: any, job) => {
  const cronJobData = data as { cronJobId: string; args?: Record<string, unknown>; jobName?: string };
  const args = cronJobData.args || {};
  
  logger.info(`[EntityExpireHandler] Processing job ${job.id} for cronjob ${cronJobData.cronJobId}`);

  try {
    // Extract args from data
    const { entityType, entityId, action } = args as {
      entityType: string;
      entityId: string;
      action: 'mark' | 'deactivate' | 'delete';
    };

    // Validate required args
    if (!entityType || !entityId || !action) {
      throw new Error('Missing required arguments: entityType, entityId, or action');
    }

    // Create CronContext for entity-expire function
    const prisma = getAdminPrisma();
    const context = {
      jobId: cronJobData.cronJobId,
      jobName: cronJobData.jobName || `entity-expire-${entityId}`,
      attemptNumber: job.attemptsMade + 1,
      logger: logger,
      prisma: prisma
    };

    // Call the entity-expire function
    await entityExpire(
      {
        entityType,
        entityId,
        action
      },
      context
    );

    logger.info(`[EntityExpireHandler] Successfully processed entity ${entityId}`);
  } catch (error) {
    logger.error(`[EntityExpireHandler] Error processing job ${job.id}:`, error);
    throw error; // Re-throw to let BullMQ handle retry logic
  }
};

