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
        // Check if user is active
        if (attributes.status !== 'ACTIVE') {
            throw new Error('User account is not active');
        }
        
        return {
            email: attributes.email,
            role: attributes.systemRole,
            status: attributes.status,
            rolesString: attributes.rolesString // Include rolesString for Zenstack policies
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
