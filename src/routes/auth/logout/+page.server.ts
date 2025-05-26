import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { lucia } from '$lib/server/auth/lucia';
import { PrismaClient } from '@prisma/client';
import { logSessionActivity } from '$lib/server/session-logger';
import { logger } from '$lib/server/logger';

// Create a separate Prisma client for auth to bypass Zenstack
const authPrisma = new PrismaClient();

export const load: PageServerLoad = async ({ locals, cookies, request, getClientAddress }) => {
    // Get the current session
    const session = await locals.auth.validate();
    if (session) {
        try {
            // Get user details for logging
            const user = await authPrisma.user.findUnique({
                where: { id: session.user.id },
                select: { primaryAccountId: true }
            });
            
            // Log the logout event
            await logSessionActivity(authPrisma, {
                userId: session.user.id,
                action: 'logout',
                sessionId: session.sessionId,
                ipAddress: getClientAddress(),
                userAgent: request.headers.get('user-agent') || undefined,
                accountId: user?.primaryAccountId || undefined
            });
            
            logger.info('User logged out successfully', { userId: session.user.id });
            
            // Delete the session cookie
            const sessionCookie = lucia.createBlankSessionCookie();
            cookies.set(sessionCookie.name, sessionCookie.value, {
                path: ".",
                ...sessionCookie.attributes
            });
        } catch (error) {
            // Log error but continue with logout
            logger.error('Error logging logout event', { error, userId: session.user.id });
            
            // Delete the session cookie even if logging fails
            const sessionCookie = lucia.createBlankSessionCookie();
            cookies.set(sessionCookie.name, sessionCookie.value, {
                path: ".",
                ...sessionCookie.attributes
            });
        }
    }

    throw redirect(302, '/auth/login');
};
