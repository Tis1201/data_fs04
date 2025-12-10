import type { Router } from '../interfaces/router';
import { ConnectionManager } from '../core/connectionManager';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';

/**
 * UserRouter implements the Router interface for user-based routing.
 */
export const userRouter: Router = {
  async resolve(senderInfo: UserInfo, scope: string): Promise<string[]> {
    logger.debug(`[UserRouter] Resolving user scope: ${scope}`);

    const [kind, id] = scope.split(':');

    let targeted_user_id = id;
    if (targeted_user_id === 'self') targeted_user_id = senderInfo?.id;

    
    const connections = await ConnectionManager.getConnectionsByUser(targeted_user_id);

    logger.debug(`[UserRouter] Found ${connections.length} connections for user: ${id}`);

    // Optionally: connectionSharedStore.debugPrint?.();

    return connections.map(c => c.id).filter((id): id is string => id !== undefined);
  }
};