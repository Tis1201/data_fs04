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
 * Publishes bundle notifications to all account members and admin users.
 * Sends to:
 * - All account members (subscribed to user:userId:accountId)
 * - All admin users (subscribed to user:userId:primaryAccountId)
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
    
    // Query all admin users - they can view all bundles
    const adminUsers = await prisma.user.findMany({
      where: { systemRole: 'ADMIN' },
      select: { id: true, primaryAccountId: true }
    });
    
    if (accountMembers.length === 0 && adminUsers.length === 0) {
      logger.warn(`[BundleNotification] No account members or admins found for account ${accountId}, skipping notification`);
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
    
    // Send notification to each admin user (using their primary account)
    // Admin users subscribe to user:userId:primaryAccountId
    for (const admin of adminUsers) {
      // Skip if admin is already a member of this account (avoid duplicate notifications)
      if (accountMembers.some((m: { userId: string }) => m.userId === admin.id)) {
        continue;
      }
      
      const adminAccountId = admin.primaryAccountId || accountId;
      await queueNotification({
        sub: `user:${admin.id}:${adminAccountId}`,
        recipient: `user:${admin.id}:${adminAccountId}`,
        type: type as any,
        flowId: crypto.randomUUID(),
        params,
        expiresIn: '5m'
      });
    }
    
    logger.debug(`[BundleNotification] Published ${type} notification to ${accountMembers.length} account members and ${adminUsers.length} admins for account ${accountId}`);
  } catch (err) {
    logger.error(`[BundleNotification] Failed to publish to account members: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

