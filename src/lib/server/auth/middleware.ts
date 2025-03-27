import { lucia } from "../auth/lucia";
import type { Handle } from "@sveltejs/kit";
import prisma from "../prisma";

export const authMiddleware: Handle = async ({ event, resolve }) => {
    // Add Prisma to locals
    event.locals.prisma = prisma;
    
    const sessionId = event.cookies.get(lucia.sessionCookieName);
    
    // Initialize auth in locals regardless of session
    event.locals.auth = {
        validate: async () => {
            if (!sessionId) return null;
            const { session, user } = await lucia.validateSession(sessionId);
            if (!session) {
                const sessionCookie = lucia.createBlankSessionCookie();
                event.cookies.set(sessionCookie.name, sessionCookie.value, {
                    path: ".",
                    ...sessionCookie.attributes
                });
                return null;
            }
            return { user, session };
        },
        createSession: async (userId: string, attributes = {}) => {
            return await lucia.createSession(userId, attributes);
        },
        setSession: (session) => {
            const sessionCookie = lucia.createSessionCookie(session.id);
            event.cookies.set(sessionCookie.name, sessionCookie.value, {
                path: ".",
                ...sessionCookie.attributes
            });
        }
    };
    
    return await resolve(event);
};
