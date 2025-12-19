/**
 * Bundle Notification Helper
 * Publishes bundle notifications to all account members.
 * Secure: Only account members can view bundles (enforced by schema).
 */

import { logger } from '$lib/server/logger';
import { queueNotification } from '$lib/server/mqtt/core/queue';
import { DeviceNotificationType } from '$lib/server/mqtt/core/publish';
import crypto from 'crypto';

/**
 * Publishes bundle notifications to all account members.
 * Only sends to users who are members of the bundle's account (secure per schema).
 */
export async function publishToAccountMembers(
  prisma: any,
  accountId: string | null | undefined,
  type: string,
  params: Record<string, unknown>
): Promise<void> {
  try {
    // Security: Only send notifications if bundle has an accountId
    // Bundles without accountId should not send notifications (they may be system/admin-only)
    if (!accountId) {
      logger.warn(`[BundleNotification] Bundle has no accountId, skipping notification (bundleId: ${params.bundleId || 'unknown'})`);
      return;
    }
    
    // Query all account members - they all have permission to view bundles in this account
    // per schema.zmodel: @@allow('read', account.members?[userId == auth().id])
    const accountMembers = await prisma.accountMembership.findMany({
      where: { accountId },
      select: { userId: true }
    });
    
    if (accountMembers.length === 0) {
      logger.warn(`[BundleNotification] No account members found for account ${accountId}, skipping notification`);
      return;
    }
    
    // Send notification to each account member
    // Each user's MQTT client will filter by bundleId on the client side
    for (const member of accountMembers) {
      await queueNotification({
        sub: `user:${member.userId}:${accountId}`,
        recipient: `user:${member.userId}:${accountId}`,
        type: type as any,
        flowId: crypto.randomUUID(),
        params,
        expiresIn: '5m'
      });
    }
    
    logger.debug(`[BundleNotification] Published ${type} notification to ${accountMembers.length} account members for account ${accountId}`);
  } catch (err) {
    logger.error(`[BundleNotification] Failed to publish to account members: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

