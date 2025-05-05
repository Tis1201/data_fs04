import type { UserInfo } from '$lib/server/types/user';
import { logger } from '$lib/server/logger';
import { ConnectionManager } from '../core/connectionManager';
import type { Authorizer } from '../interfaces/authorizer';

/**
 * Authorizes connection-based message publishing
 * 
 * Rules:
 * - Admins can publish to any connection
 * - Non-admin users can only publish to their own connections
 */
export const connectionAuthorizer: Authorizer = {
  isAllowed(userInfo: UserInfo | undefined, scope: string, type: string, connectionIds: string[]): boolean {
    if (!userInfo) return false;

    const [kind, targetId] = scope.split(':');
    logger.debug(`[ConnectionAuthorizer] Checking if ${userInfo.id} is allowed to publish to ${scope}`);

    // Admins can publish to any connection
    if (userInfo.systemRole === 'ADMIN') {
      logger.debug(`[ConnectionAuthorizer] Admin ${userInfo.id} authorized to publish to connection ${scope}`);
      return true;
    }

    // Check if all target connections belong to the user
    for (const connectionId of connectionIds) {
      const connection = ConnectionManager.getConnection(connectionId);
      if (connection?.meta.userInfo.id !== userInfo.id) {
        logger.warn(`[ConnectionAuthorizer] User ${userInfo.id} attempted unauthorized publish to connection ${connectionId}`);
        return false;
      }
    }

    return true;
  }
};