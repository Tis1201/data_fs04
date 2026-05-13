import type { UserInfo } from '$lib/server/types/user';
import type { Authorizer } from '../interfaces/authorizer';
import { logger } from '$lib/server/logger';
import { ConnectionManager } from '../core/connectionManager';

export const subscriptionAuthorizer: Authorizer = {
  isAllowed(userInfo: UserInfo | undefined, scope: string, type: string, connectionIds: string[], sudo?: boolean): boolean {
    const [kind, targetId] = scope.split(':');

    logger.debug(`[SubscriptionAuthorizer] Checking if ${userInfo?.id} is allowed to publish to ${scope}`);

    // Check if sudo is set, if yes, allow
    if (sudo === true) {
      logger.debug(`[SubscriptionAuthorizer] Sudo mode enabled for message, allowing access to ${scope}`);
      return true;
    }

    // Allow admin users to publish to device subscriptions without ownership checks
    if (userInfo?.systemRole === 'ADMIN' && kind === 'subscription' && targetId.startsWith('device:')) {
      logger.debug(`[SubscriptionAuthorizer] Admin user ${userInfo.id} allowed to publish to device subscription ${scope} (bypassing ownership check)`);
      return true;
    }

    // Allow admin users to publish to any subscription (not just device subscriptions)
    if (userInfo?.systemRole === 'ADMIN' && kind === 'subscription') {
      logger.debug(`[SubscriptionAuthorizer] Admin user ${userInfo.id} allowed to publish to subscription ${scope} (admin bypass)`);
      return true;
    }

    // For non-admin users, check if all connections are owned by the sender
    for (const connectionId of connectionIds) {
      const connection = ConnectionManager.getConnection(connectionId);
      if (connection?.meta.userInfo.id !== userInfo?.id) {
        logger.debug(`[SubscriptionAuthorizer] Connection ${connectionId} not owned by ${userInfo?.id}, denying access`);
        return false; // If any connection is NOT owned by the sender, deny
      }
    }
    
    logger.debug(`[SubscriptionAuthorizer] All connections owned by ${userInfo?.id}, allowing access to ${scope}`);
    return true; // All connections are owned by the sender
  }
};
