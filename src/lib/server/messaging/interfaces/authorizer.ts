import type { UserInfo } from '$lib/server/types/user';

export interface Authorizer {
    /**
     * Determines if a user is allowed to publish to the given target ID under this scope kind.
     * 
     * @param userId - The ID of the user trying to publish
     * @param targetId - The target scope identifier (e.g. user ID, group ID, role ID)
     * @param type - Optional message type for more granular checks (e.g. only allow chat:msg)
     */
    isAllowed(senderId: UserInfo | undefined, targetId: string, type?: string): Promise<boolean> | boolean;
  }
  