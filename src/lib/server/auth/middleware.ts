import { lucia } from "../auth/lucia";
import type { Handle } from "@sveltejs/kit";
import prisma, { getEnhancedPrisma } from "../prisma";
import { error } from '@sveltejs/kit';

export const authMiddleware: Handle = async ({ event, resolve }) => {
    // Add raw Prisma to locals for non-authenticated routes
    event.locals.prisma = prisma;
    
    // We'll set the enhanced Prisma client after user validation
    
    const sessionId = event.cookies.get(lucia.sessionCookieName);
    const currentAccountId = event.cookies.get('current_account_id');
    
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
            
            // Load account memberships
            const memberships = await event.locals.prisma.accountMembership.findMany({
                where: { userId: user.id },
                include: {
                    account: {
                        select: { id: true, name: true, slug: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            
            // Determine current account
            let currentAccount = null;
            
            // First try from cookie
            if (currentAccountId) {
                currentAccount = memberships.find(m => m.account.id === currentAccountId);
            }
            
            // Then try primary account
            if (!currentAccount && user.primaryAccountId) {
                currentAccount = memberships.find(m => m.account.id === user.primaryAccountId);
            }
            
            // Finally fallback to first membership
            if (!currentAccount && memberships.length > 0) {
                currentAccount = memberships[0];
                
                try {
                    // Set cookie for the default account - wrapped in try/catch to handle cases where headers are already sent
                    event.cookies.set('current_account_id', currentAccount.account.id, {
                        path: '/',
                        httpOnly: true,
                        sameSite: 'lax',
                        secure: process.env.NODE_ENV === 'production',
                        maxAge: 60 * 60 * 24 * 30 // 30 days
                    });
                } catch (e) {
                    // If we can't set the cookie (headers already sent), just continue with the current account
                    console.warn('Could not set account cookie - headers may have already been sent');
                }
            }
            
            return { 
                user, 
                session, 
                memberships,
                currentAccount
            };
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
        },
        
        // New method for switching accounts
        switchAccount: async (accountId) => {
            const auth = await event.locals.auth.validate();
            if (!auth) return false;
            
            // Check if user has membership in this account
            const hasMembership = auth.memberships.some(m => m.account.id === accountId);
            if (!hasMembership) return false;
            
            // Set cookie for current account
            event.cookies.set('current_account_id', accountId, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 30 // 30 days
            });
            
            return true;
        },
        
        // Helper to check permissions in current account
        hasPermission: async (requiredRoles) => {
            const auth = await event.locals.auth.validate();
            if (!auth || !auth.currentAccount) return false;
            
            if (typeof requiredRoles === 'string') {
                requiredRoles = [requiredRoles];
            }
            
            return requiredRoles.includes(auth.currentAccount.role);
        }
    };
    
    // Add account context to locals for easy access
    if (sessionId) {
        const auth = await event.locals.auth.validate();
        if (auth) {
            event.locals.user = auth.user;
            event.locals.accountMemberships = auth.memberships;
            event.locals.currentAccount = auth.currentAccount;
            
            // Replace the raw Prisma client with the enhanced Zenstack client
            // This will enforce access policies based on the current user
            const userContext = {
                id: auth.user.id,
                systemRole: auth.user.systemRole,
                // Add account memberships for access policies that check membership
                accountMemberships: auth.memberships
            };
            
            // Debug the user context for Zenstack
            console.log('Setting up enhanced Prisma with user context:', JSON.stringify(userContext, null, 2));
            
            event.locals.prisma = getEnhancedPrisma(userContext);
        }
    }
    
    return await resolve(event);
};
