import type { UserInfo } from '$lib/server/types/user';
import type { Authorizer } from '../interfaces/authorizer';
import { logger } from '$lib/server/logger';

export const userAuthorizer: Authorizer = {
  isAllowed(userInfo: UserInfo | undefined, scope: string, type: string, connectionIds: string[]): boolean {
    // if (!userId) return false;
    // return userId === targetId;
    const [kind, targetId] = scope.split(':');

    logger.debug(`[UserAuthorizer] Checking if ${userInfo?.id} is allowed to publish to ${targetId}`);

    if(targetId === 'self') return true;

    //If you are not admin, you can only publish to yourself
    if(userInfo?.id === targetId) return true;

    return false;
  }
};
