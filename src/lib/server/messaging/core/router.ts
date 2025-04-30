import type { Router } from '../interfaces/router';
import { ConnectionManager } from './connectionManager';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import { connectionSharedStore } from './stores/connectionSharedStore';
import { userRouter } from '../routers/userRouter';
import { subscriptionRouter } from '../routers/subscriptionRouter';
import { connectionRouter } from '../routers/connectionRouter';

export const router: Router = {
  async resolve(senderInfo:UserInfo, scope: string): Promise<string[]> {
    if (!scope.includes(':')) {
      logger.warn(`[Router] Invalid scope format: ${scope}`);
      return [];
    }

    const [kind, id] = scope.split(':');

    logger.debug(`[Router] Resolving scope: ${scope} (kind: ${kind})`);

    switch (kind) {
      case 'user':
        return userRouter.resolve(senderInfo, scope);

      case 'subscription':
        return subscriptionRouter.resolve(senderInfo, scope);
   
      case 'connection':
        return connectionRouter.resolve(senderInfo, scope);

      default:
        logger.warn(`[Router] Unknown scope kind: ${kind}`);
        return [];
    }
  }
};
