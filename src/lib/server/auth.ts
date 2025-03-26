import { dev } from '$app/environment';
import { Lucia, TimeSpan } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';

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
        // Log user attributes for debugging
        logger.debug('Lucia getUserAttributes called', {
            attributes: JSON.stringify(attributes),
            hasEmail: !!attributes.email,
            hasSystemRole: !!attributes.systemRole,
            hasStatus: !!attributes.status,
            hasRolesString: !!attributes.rolesString,
            status: attributes.status,
            systemRole: attributes.systemRole
        });
        
        // Check if user is active
        if (attributes.status !== 'ACTIVE') {
            logger.error('User account is not active', { status: attributes.status });
            throw new Error('User account is not active');
        }
        
        // Log what we're returning
        const result = {
            email: attributes.email,
            role: attributes.systemRole,
            status: attributes.status,
            rolesString: attributes.rolesString // Include rolesString for Zenstack policies
        };
        
        logger.debug('Lucia returning user attributes', { result: JSON.stringify(result) });
        return result;
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
