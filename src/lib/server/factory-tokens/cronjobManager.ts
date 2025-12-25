import { logger } from '$lib/server/logger';
import { upsertEntityExpirationCronjob, deleteEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';

/**
 * Create or update a cronjob for a factory token expiration
 * Uses the generic entity expiration helper
 * 
 * @param prisma - Prisma client
 * @param factoryTokenId - Factory token ID
 * @param expiresAt - Expiration date
 * @param userId - User ID creating/updating the cronjob
 * @returns The created/updated cronjob or null if error
 */
export async function upsertFactoryTokenCronjob(
  prisma: any,
  factoryTokenId: string,
  expiresAt: Date,
  userId: string
): Promise<any | null> {
  return await upsertEntityExpirationCronjob(prisma, {
    entityType: 'factoryToken',
    entityId: factoryTokenId,
    expiresAt,
    action: 'mark', // Mark expired tokens as used
    userId,
    accountId: null
  });
}

/**
 * Delete cronjob for a factory token
 * Uses the generic entity expiration helper
 * 
 * @param prisma - Prisma client
 * @param factoryTokenId - Factory token ID
 */
export async function deleteFactoryTokenCronjob(
  prisma: any,
  factoryTokenId: string
): Promise<void> {
  await deleteEntityExpirationCronjob(prisma, 'factoryToken', factoryTokenId);
}

