import type { Router } from '../interfaces/router';
import { ConnectionManager } from '../core/connectionManager';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';

/**
 * UserRouter implements the Router interface for user-based routing.
 */
export const connectionRouter: Router = {
  async resolve(senderInfo: UserInfo, scope: string): Promise<string[]> {
    logger.debug(`[ConnectionRouter] Resolving connection scope: ${scope}`);
    
    const [kind, id] = scope.split(':');
    
    if (!id) {
      logger.warn(`[ConnectionRouter] Invalid connection ID in scope: ${scope}`);
      return [];
    }

    // Check if connection exists
    const connection = await ConnectionManager.getConnection(id);
    
    if (!connection) {
      logger.warn(`[ConnectionRouter] Connection not found: ${id}`);
      return [];
    }
    
    logger.debug(`[ConnectionRouter] Found connection: ${id} for user: ${connection.meta.userInfo?.id || 'unknown'}`);
    return [id];
  }
};