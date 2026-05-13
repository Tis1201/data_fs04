import type { UserInfo } from '$lib/server/types/user';

export interface Authorizer {
    /**
     * Determines if a user is allowed to publish to the given target ID under this scope kind.
     * 
     * @param userId - The ID of the user trying to publish
     * @param targetId - The target scope identifier (e.g. user ID, group ID, role ID)
     * @param type - Optional message type for more granular checks (e.g. only allow chat:msg)
     * @param connectionIds - Optional connection IDs for more granular checks
     * @param sudo - Optional flag to bypass normal authorization checks
     */
    isAllowed(senderId: UserInfo | undefined, scope: string, type?: string, connectionIds?: string[], sudo?: boolean): Promise<boolean> | boolean;
  }
  