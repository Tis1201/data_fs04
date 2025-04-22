// src/lib/server/types/user.ts

export interface UserInfo {
    id: string;
    email: string;
    name: string | null;
    systemRole: string;
    source: 'apiKey' | 'session' | 'oauth' | 'sso'; // extend as needed   
}