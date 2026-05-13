// src/lib/server/types/user.ts
import type { Account, AccountMembership } from '@prisma/client';

export interface UserInfo {
    id: string;
    email: string;
    name: string | null;
    systemRole: string;
    source: 'apiKey' | 'session' | 'oauth' | 'sso'; // extend as needed
    memberships?: (AccountMembership & {
        account: {
            id: string;
            name: string;
            slug: string;
        };
    })[];
    currentAccount?: (AccountMembership & {
        account: {
            id: string;
            name: string;
            slug: string;
        };
    }) | null;
}