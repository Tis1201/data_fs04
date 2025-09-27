import type { Router } from '../interfaces/router';
import { ConnectionManager } from '../core/connectionManager';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';

/**
 * UserRouter implements the Router interface for user-based routing.
 */
export const connectionRouter: Router = {
  async resolve(senderInfo: UserInfo, scope: string): Promise<string[]> {
    console.log(`[ConnectionRouter] ===== RESOLVING CONNECTION SCOPE =====`);
    console.log(`[ConnectionRouter] Scope: ${scope}`);
    console.log(`[ConnectionRouter] Sender: ${senderInfo.id}`);
    
    const [kind, id] = scope.split(':');
    console.log(`[ConnectionRouter] Kind: ${kind}, ID: ${id}`);
    
    if (!id) {
      console.warn(`[ConnectionRouter] Invalid connection ID in scope: ${scope}`);
      return [];
    }

    // Check if connection exists
    const connection = await ConnectionManager.getConnection(id);
    console.log(`[ConnectionRouter] Connection found: ${!!connection}`);
    
    if (!connection) {
      console.warn(`[ConnectionRouter] Connection not found: ${id}`);
      return [];
    }
    
    console.log(`[ConnectionRouter] Found connection: ${id} for user: ${connection.meta.userInfo?.id || 'unknown'}`);
    return [id];
  }
};
