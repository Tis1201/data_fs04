import type { UserInfo } from "$lib/server/types/user";

export interface Router {
    /**
     * Given a scope (e.g. "user:123", "room:abc"), resolve all connection IDs to send to.
     */
    resolve(senderInfo: UserInfo, scope: string): Promise<string[]>;
  }
  