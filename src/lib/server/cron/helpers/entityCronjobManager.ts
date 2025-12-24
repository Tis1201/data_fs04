import { logger } from '$lib/server/logger';
import { upsertCronJob, deleteCronJobByName } from '$lib/server/cron/cronjobService';

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
  return await upsertCronJob(prisma, {
    name: cronJobName,
    functionName: 'entity-expire', // Generic function for all entity types
    args: {
      entityType,
      entityId,
      action
    },
    targetDate,
    status: 'SCHEDULED',
    maxRetries: 3,
    timeout: 60000, // 1 minute timeout (processing just one entity)
    userId,
    accountId,
    description: `Auto-expire ${entityType} ${entityId}`
  });
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
  await deleteCronJobByName(prisma, cronJobName);
}

