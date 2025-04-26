import type { Router } from '../interfaces/router';
import { ConnectionManager } from './connectionManager';
import { sharedStore } from './sharedStore'; // or use config-switchable
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';

export const router: Router = {
  async resolve(senderInfo:UserInfo, scope: string): Promise<string[]> {
    if (!scope.includes(':')) {
      logger.warn(`[Router] Invalid scope format: ${scope}`);
      return [];
    }

    const [kind, id] = scope.split(':');

    logger.debug(`[Router] Resolving scope: ${scope} (kind: ${kind}, id: ${id})`);

    switch (kind) {
      case 'user':
        logger.debug(`[Router] Resolving user scope: ${scope}`);

        let targeted_user_id = id;

        if(targeted_user_id === 'self') targeted_user_id = senderInfo?.id;

        const connections = await sharedStore.getConnectionsByUser(targeted_user_id);

        logger.debug(`[Router] Found ${connections.length} connections for user: ${id}`);

        sharedStore.debugPrint?.();

        return (connections.map(c => c.id));

    //   case 'room':
    //     const userIds = await Store.getRoomMembers(id);
    //     const allConnIds: string[] = [];
    //     for (const userId of userIds) {
    //       const connMetas = await Store.getConnectionsByUser(userId);
    //       allConnIds.push(...connMetas.map(m => m.id));
    //     }
    //     return allConnIds;

      case 'conn':
        return [id];

      default:
        logger.warn(`[Router] Unknown scope kind: ${kind}`);
        return [];
    }
  }
};
