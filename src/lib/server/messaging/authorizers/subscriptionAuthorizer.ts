import type { UserInfo } from '$lib/server/types/user';
import type { Authorizer } from '../interfaces/authorizer';
import { logger } from '$lib/server/logger';
import { ConnectionManager } from '../core/connectionManager';

export const subscriptionAuthorizer: Authorizer = {
  isAllowed(userInfo: UserInfo | undefined, scope: string, type: string, connectionIds: string[]): boolean {
    // if (!userId) return false;
    // return userId === targetId;
    const [kind, targetId] = scope.split(':');

    logger.debug(`[SubscriptionAuthorizer] Checking if ${userInfo?.id} is allowed to publish to ${scope}`);

    for (const connectionId of connectionIds) {
      const connection = ConnectionManager.getConnection(connectionId);
      if (connection?.meta.userInfo.id !== userInfo?.id) {
        return false; // If any connection is NOT owned by the sender, deny
      }
    }
    return true; // All connections are owned by the sender

    // //If you are not admin, you can only publish to yourself
    // if(userInfo?.id === targetId) return true;

  }
};
