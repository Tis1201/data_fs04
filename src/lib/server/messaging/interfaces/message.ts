import type { UserInfo } from "$lib/server/types/user";

export interface Message {
    type: string;
    scope: string;           // e.g. "user:123", "room:abc"
    payload: any;
    userInfo: UserInfo;
    connectionId?: string;
    [key: string]: any;      // Extra metadata if needed
  }
  