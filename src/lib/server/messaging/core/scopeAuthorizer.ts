import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import { userAuthorizer } from '../authorizers/userAuthorizer';
import { subscriptionAuthorizer } from '../authorizers/subscriptionAuthorizer';
import { connectionAuthorizer } from '../authorizers/connectionAuthorizer';
// import { GroupAuthorizer } from './authorizer/groupAuthorizer';
// import { RoleAuthorizer } from './authorizer/roleAuthorizer';
// import { RoomAuthorizer } from './authorizer/roomAuthorizer';

export const ScopeAuthorizer = {
  async isAllowed(scope: string, userInfo: UserInfo, type: string, connectionIds: string[]): Promise<boolean> {
    const scopes = scope.split(',').map(s => s.trim());

    for (const scope of scopes) {

      const [kind, rest] = scope.split(':');

      logger.debug(`[ScopeAuthorizer] Checking scope: ${scope} (kind: ${kind}, rest: ${rest})`);

      switch (kind) {
        case 'user':
          if (!userAuthorizer.isAllowed(userInfo, scope, type, connectionIds)) return false;
          break;

        case 'subscription':
          if (!subscriptionAuthorizer.isAllowed(userInfo, scope, type,connectionIds)) return false;
          break;

        case 'connection':
          if (!connectionAuthorizer.isAllowed(userInfo, scope, type,connectionIds)) return false;
          break;


        // case 'group':
        //   if (!(await GroupAuthorizer.isAllowed(userId, id))) return false;
        //   break;

        // case 'role':
        //   if (!(await RoleAuthorizer.isAllowed(userId, id))) return false;
        //   break;

        // case 'room':
        //   if (!(await RoomAuthorizer.isAllowed(userId, id))) return false;
        //   break;

        // case 'conn':
        //   break; // always allow direct-to-conn

        default:
          throw new Error(`[ScopeAuthorizer] Unknown scope kind: ${kind}`);
      }
    }

    return true;
  }
};
