import { logger } from '$lib/server/logger';
import { upsertCronJob, deleteCronJobByName } from '$lib/server/cron/cronjobService';
import { syncCronJobs, removeCronJob } from '$lib/server/jobs/cron-sync';

/**
 * Generic helper to create/update a cronjob for any entity expiration
 * 
 * @param prisma - Prisma client
 * @param entityType - Type of entity (e.g., 'factoryToken', 'session', 'apiKey')
 * @param entityId - Entity ID
 * @param expiresAt - Expiration date
 * @param action - Action to perform ('mark', 'delete', 'deactivate')
 * @param userId - User ID creating/updating the cronjob (optional)
 * @param accountId - Account ID (optional)
 * @returns The created/updated cronjob or null if error
 */
export async function upsertEntityExpirationCronjob(
  prisma: any,
  options: {
    entityType: string;
    entityId: string;
    expiresAt: Date;
    action?: 'mark' | 'delete' | 'deactivate';
    userId?: string;
    accountId?: string | null;
  }
): Promise<any | null> {
  const { entityType, entityId, expiresAt, action = 'mark', userId, accountId = null } = options;

  const cronJobName = `${entityType}-expire-${entityId}`;
  
  // Calculate when to run the cronjob
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  
  // If expiration is in the past, run immediately (next minute)
  // Otherwise, run at midnight on the expiration date
  let targetDate: Date;
  if (expirationDate <= now) {
    // Expired already, run in 1 minute
    targetDate = new Date(now.getTime() + 60 * 1000);
  } else {
    // Set to midnight UTC on expiration date
    targetDate = new Date(expirationDate);
    targetDate.setUTCHours(0, 0, 0, 0);
    // If expiration is today, ensure it runs at least 1 minute from now
    if (targetDate <= now) {
      targetDate = new Date(now.getTime() + 60 * 1000);
    }
  }

  // Use generic entity-expire function
  // Entity expiration jobs are one-time jobs (isRecurring = false)
  const cronjob = await upsertCronJob(prisma, {
    name: cronJobName,
    functionName: 'entity-expire', // Generic function for all entity types
    args: {
      entityType,
      entityId,
      action
    },
    targetDate,
    isRecurring: false, // One-time job - runs once then marks as COMPLETED
    status: 'ACTIVE',
    maxRetries: 3,
    timeout: 60000, // 1 minute timeout (processing just one entity)
    userId,
    accountId,
    description: `Auto-expire ${entityType} ${entityId}`
  });

  // Sync to BullMQ after creating/updating cronjob
  try {
    await syncCronJobs();
  } catch (error) {
    logger.error('[EntityCronjobManager] Failed to sync cronjob to BullMQ:', error);
    // Don't throw - cronjob is created, sync can be retried
  }

  return cronjob;
}

/**
 * Generic helper to delete a cronjob for any entity
 * 
 * @param prisma - Prisma client
 * @param entityType - Type of entity
 * @param entityId - Entity ID
 */
export async function deleteEntityExpirationCronjob(
  prisma: any,
  entityType: string,
  entityId: string
): Promise<void> {
  const cronJobName = `${entityType}-expire-${entityId}`;
  
  // Find the cronjob first to get its ID for BullMQ cleanup
  const cronjob = await (prisma as any).cronJob.findFirst({
    where: { name: cronJobName },
    select: { id: true }
  });
  
  // Delete from database
  await deleteCronJobByName(prisma, cronJobName);
  
  // Remove from BullMQ if cronjob was found
  if (cronjob) {
    try {
      await removeCronJob(cronjob.id);
    } catch (error) {
      logger.error('[EntityCronjobManager] Failed to remove cronjob from BullMQ:', error);
      // Don't throw - cronjob is deleted from DB, BullMQ cleanup can be retried
    }
  }
}

