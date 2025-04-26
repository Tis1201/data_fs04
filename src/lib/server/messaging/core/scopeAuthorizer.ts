import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import  { userAuthorizer } from '../authorizers/userAuthorizer';
// import { GroupAuthorizer } from './authorizer/groupAuthorizer';
// import { RoleAuthorizer } from './authorizer/roleAuthorizer';
// import { RoomAuthorizer } from './authorizer/roomAuthorizer';

export const ScopeAuthorizer = {
  async isAllowed(scope: string, userInfo?: UserInfo, type?: string): Promise<boolean> {
    const scopes = scope.split(',').map(s => s.trim());

    for (const s of scopes) {
      const [kind, id] = s.split(':');

      logger.debug(`[ScopeAuthorizer] Checking scope: ${s} (kind: ${kind}, id: ${id})`);

      switch (kind) {
        case 'user':
          if (!userAuthorizer.isAllowed(userInfo, id)) return false;
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
          return false;
      }
    }

    return true;
  }
};
