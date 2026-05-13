import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { lucia } from '$lib/server/auth/lucia';
import { PrismaClient } from '@prisma/client';
import { logSessionActivity } from '$lib/server/session-logger';
import { logger } from '$lib/server/logger';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { invalidateSessionCache } from '$lib/server/auth/session-cache';

// Create a separate Prisma client for auth to bypass Zenstack
const authPrisma = new PrismaClient();

// Helper function to handle async operations that shouldn't block the response
async function handleAsyncOperations(sessionId: string, userId: string, request: Request, ipAddress: string) {
    try {
        // 1) Log the logout event
        const user = await authPrisma.user.findUnique({
            where: { id: userId },
            select: { primaryAccountId: true }
        }).catch(error => {
            logger.error('Error fetching user during logout', { error, userId });
            return null;
        });

        // 2) Log the session activity
        logSessionActivity(authPrisma, {
            userId,
            action: 'logout',
            sessionId,
            ipAddress,
            userAgent: request.headers.get('user-agent') || undefined,
            accountId: user?.primaryAccountId || undefined
        }).catch(error => {
            logger.error('Error logging session activity', { error, userId });
        });

        // 3) Terminate SSE connections for this user
        try {
            const userConnections = await ConnectionManager.getConnectionsByUser(userId);
            let terminatedCount = 0;
            for (const connMeta of userConnections) {
                if (connMeta.id) {
                    const connection = ConnectionManager.getConnection(connMeta.id);
                    if (connection) {
                        try {
                            // Close the connection gracefully
                            if (typeof (connection as any).close === 'function') {
                                await (connection as any).close();
                            }
                            ConnectionManager.unregisterConnection(connMeta.id);
                            terminatedCount++;
                        } catch (err) {
                            logger.warn(`Error closing connection ${connMeta.id}:`, { error: err });
                        }
                    }
                }
            }
            if (terminatedCount > 0) {
                logger.info(`Terminated ${terminatedCount} SSE connections for user ${userId}`);
            }
        } catch (error) {
            logger.error('Error terminating SSE connections', { error, userId });
        }

        // 4) Invalidate the session (this should be last as it might affect other operations)
        lucia.invalidateSession(sessionId).catch(error => {
            logger.error('Error invalidating session', { error, sessionId });
        });
        
        // 5) Invalidate session cache
        await invalidateSessionCache(sessionId).catch(error => {
            logger.warn('Error invalidating session cache', { error, sessionId });
        });

        logger.info('User logged out successfully', { userId });
    } catch (error) {
        logger.error('Unexpected error during logout', { error, userId });
    }
}

export const load: PageServerLoad = async ({ locals, cookies, request, getClientAddress }) => {
    // 1) Validate the session
    const session = await locals.auth.validate();
    if (!session) {
        throw redirect(302, '/auth/login');
    }

    const sessionId = session.session.id;
    const userId = session.user.id;
    const ipAddress = getClientAddress();

    // 2) Clear cookies first
    cookies.delete('current_account_id', { path: '/' });
    const blank = lucia.createBlankSessionCookie();
    cookies.set(blank.name, blank.value, {
        path: "/",
        httpOnly: blank.attributes.httpOnly,
        sameSite: blank.attributes.sameSite,
        secure: blank.attributes.secure,
        maxAge: 0
    });

    // 3) Start async operations but don't wait for them
    handleAsyncOperations(sessionId, userId, request, ipAddress).catch(error => {
        logger.error('Error in async logout operations', { error, userId });
    });

    // 4) Redirect immediately
    throw redirect(302, '/auth/login');
};
