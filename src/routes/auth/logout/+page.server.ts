import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { lucia } from '$lib/server/auth/lucia';
import { PrismaClient } from '@prisma/client';
import { logSessionActivity } from '$lib/server/session-logger';
import { logger } from '$lib/server/logger';

// Create a separate Prisma client for auth to bypass Zenstack
const authPrisma = new PrismaClient();

export const load: PageServerLoad = async ({ locals, cookies, request, getClientAddress }) => {
    // 1) Validate the session
    const session = await locals.auth.validate();
    if (session) {
        try {
            // 2) Log the logout event
            const user = await authPrisma.user.findUnique({
                where: { id: session.user.id },
                select: { primaryAccountId: true }
            });

            await logSessionActivity(authPrisma, {
                userId: session.user.id,
                action: 'logout',
                sessionId: session.session.id,
                ipAddress: getClientAddress(),
                userAgent: request.headers.get('user-agent') || undefined,
                accountId: user?.primaryAccountId || undefined
            });

            logger.info('User logged out successfully', { userId: session.user.id });

            logger.debug(`Session ID: ', ${session.session.id}`);

            // 3) Invalidate the session in the database
            await lucia.invalidateSession(session.session.id);
        } catch (error) {
            // If something goes wrong with logging or invalidation, at least make sure we still clear the cookie
            logger.error('Error during logout process', { error, userId: session.user.id });
            try {
                await lucia.invalidateSession(session.session.id);
            } catch {
                // swallow any invalidate‐error here so the logout can continue
            }
        }

        // 4) Clear the cookie at exactly the same path and attributes used originally
        const blank = lucia.createBlankSessionCookie();
        cookies.set(blank.name, blank.value, {
            path: "/",                  // ← must match your original cookie path
            httpOnly: blank.attributes.httpOnly,
            sameSite: blank.attributes.sameSite,
            secure: blank.attributes.secure,
            maxAge: 0                    // expire immediately
        });
    }

    // 5) Redirect to the login page
    throw redirect(302, '/auth/login');
};
