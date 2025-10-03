import type { Router } from '../interfaces/router';
import { ConnectionManager } from '../core/connectionManager';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';

/**
 * UserRouter implements the Router interface for user-based routing.
 */
export const connectionRouter: Router = {
  async resolve(senderInfo: UserInfo, scope: string): Promise<string[]> {
    const [kind, id] = scope.split(':');
    
    if (!id) {
      console.warn(`[ConnectionRouter] Invalid connection ID in scope: ${scope}`);
      return [];
    }

    // Check if connection exists
    const connection = await ConnectionManager.getConnection(id);
    
    if (!connection) {
      // Connection not found - this is normal for disconnected clients
      return [];
    }
    
    return [id];
  }
};
