import type { Router } from '../interfaces/router';
import { ConnectionManager } from '../core/connectionManager';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';

// Cache to track recently logged connections to avoid spam
const recentLogs = new Map<string, number>();
const LOG_THROTTLE_MS = 5000; // Only log same connection once per 5 seconds

/**
 * UserRouter implements the Router interface for user-based routing.
 */
export const connectionRouter: Router = {
  async resolve(senderInfo: UserInfo, scope: string): Promise<string[]> {
    const [kind, id] = scope.split(':');

    if (!id) {
      logger.debug(`[ConnectionRouter] Invalid connection ID in scope: ${scope}`);
      return [];
    }

    // Check if connection exists
    const connection = await ConnectionManager.getConnection(id);

    if (!connection) {
      // Connection not found - this is normal for disconnected clients
      return [];
    }
    
    // Throttle debug logging to avoid spam - only log same connection once per 5 seconds
    const now = Date.now();
    const lastLogTime = recentLogs.get(id) || 0;
    if (now - lastLogTime > LOG_THROTTLE_MS) {
      logger.debug(`[ConnectionRouter] Returning connection: ${id}`);
      recentLogs.set(id, now);
      
      // Clean up old entries periodically (keep map size reasonable)
      if (recentLogs.size > 1000) {
        const cutoff = now - LOG_THROTTLE_MS;
        for (const [connId, logTime] of recentLogs.entries()) {
          if (logTime < cutoff) {
            recentLogs.delete(connId);
          }
        }
      }
    }
    
    return [id];
  }
};
