import type { UserInfo } from '$lib/server/types/user';
import type { Authorizer } from '../interfaces/authorizer';
import { logger } from '$lib/server/logger';

export const userAuthorizer: Authorizer = {
  isAllowed(userInfo: UserInfo | undefined, scope: string, type: string, connectionIds: string[], sudo?: boolean): boolean {
    // if (!userId) return false;
    // return userId === targetId;
    const [kind, targetId] = scope.split(':');

    logger.debug(`[UserAuthorizer] Checking if ${userInfo?.id} is allowed to publish to ${targetId}`);

    // Check if sudo is set, if yes, allow
    if (sudo === true) {
      logger.debug(`[UserAuthorizer] Sudo mode enabled for message, allowing access to ${scope}`);
      return true;
    }

    if(targetId === 'self') return true;

    //If you are not admin, you can only publish to yourself
    if(userInfo?.id === targetId) return true;

    return false;
  }
};
