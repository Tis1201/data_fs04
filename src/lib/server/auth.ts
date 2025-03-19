import { dev } from '$app/environment';
import { Lucia, TimeSpan } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { PrismaClient } from '@prisma/client';

// Create a separate Prisma client for auth to bypass Zenstack
const authPrisma = new PrismaClient();

const adapter = new PrismaAdapter(
    authPrisma.session,
    authPrisma.user
);

export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            secure: !dev,
            sameSite: 'lax'
        },
        // Set session to expire in 30 days
        expires: new TimeSpan(30, 'd')
    },
    getUserAttributes: (attributes) => {
        return {
            email: attributes.email,
            role: attributes.systemRole,
            rolesString: attributes.rolesString
        };
    }
});

declare module 'lucia' {
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: {
            email: string;
            role: string;
            rolesString: string;
        };
    }
}

export type Auth = typeof lucia;
export default lucia;
