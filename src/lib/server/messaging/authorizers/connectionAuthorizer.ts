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
  isAllowed(userInfo: UserInfo | undefined, scope: string, type: string, connectionIds: string[], sudo?: boolean): boolean {
    logger.debug(`[ConnectionAuthorizer] ENTER isAllowed with scope=${scope}, type=${type}, connectionIds=${JSON.stringify(connectionIds)}`);
    logger.debug(`[ConnectionAuthorizer] Sudo property: ${sudo}, type: ${typeof sudo}`);
    
    if (!userInfo) {
      logger.debug(`[ConnectionAuthorizer] No userInfo provided, denying access`);
      return false;
    }

    const [kind, targetId] = scope.split(':');
    logger.debug(`[ConnectionAuthorizer] Checking if ${userInfo.id} is allowed to publish to ${scope} with ${connectionIds.length} connection IDs`);

    // Admins can publish to any connection
    if (userInfo.systemRole === 'ADMIN') {
      logger.debug(`[ConnectionAuthorizer] Admin ${userInfo.id} authorized to publish to connection ${scope}`);
      return true;
    }

    // Check if sudo is set, if yes, allow
    // The sudo property is passed from the message to bypass normal authorization checks
    if (sudo === true) {
      logger.debug(`[ConnectionAuthorizer] Sudo mode enabled for message, allowing access to ${scope}`);
      return true;
    }
    
    // Also check for string 'true' for compatibility
    if (sudo === 'true') {
      logger.debug(`[ConnectionAuthorizer] Sudo mode enabled (string value) for message, allowing access to ${scope}`);
      return true;
    }

    // Check if all target connections belong to the user
    if (connectionIds.length === 0) {
      logger.debug(`[ConnectionAuthorizer] No connection IDs provided, allowing access for scope ${scope}`);
      return true;
    }
    
    for (const connectionId of connectionIds) {
      const connection = ConnectionManager.getConnection(connectionId);
      
      if (!connection) {
        logger.warn(`[ConnectionAuthorizer] Connection ${connectionId} not found`);
        return false;
      }
      
      if (!connection.meta.userInfo) {
        logger.warn(`[ConnectionAuthorizer] Connection ${connectionId} has no user info`);
        return false;
      }
      
      logger.debug(`[ConnectionAuthorizer] Comparing connection user ${connection.meta.userInfo.id} with sender ${userInfo.id}`);
      
      if (connection.meta.userInfo.id !== userInfo.id) {
        logger.warn(`[ConnectionAuthorizer] User ${userInfo.id} vs ${connection.meta.userInfo.id} attempted unauthorized publish to connection ${connectionId}`);
        return false;
      }
    }

    logger.debug(`[ConnectionAuthorizer] Access allowed for user ${userInfo.id} to scope ${scope}`);
    return true;
  }
};