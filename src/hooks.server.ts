import { lucia } from "$lib/server/auth/lucia";
import type { Handle } from "@sveltejs/kit";
import prisma from "$lib/server/prisma";
import { GlobalThisWSS, type ExtendedGlobal, startupWebsocketServer, wssInitialized } from "$lib/server/webSocketUtils";
import { building } from "$app/environment";
import { parse as parseCookie } from 'cookie';
import { initializeClientsFromDatabase } from "$lib/server/bailey/client";

// Initialize WhatsApp clients on server startup (not during build)
if (!building) {
    console.error('=== STARTING WHATSAPP CLIENT INITIALIZATION FROM HOOKS ===');
    // Use setTimeout to ensure this runs after the server has fully started
    setTimeout(() => {
        console.error('=== DELAYED WHATSAPP CLIENT INITIALIZATION ===');
        initializeClientsFromDatabase().catch(error => {
            console.error('Failed to initialize WhatsApp clients:', error);
        });
    }, 1000);
}

// WebSocket middleware
const websocketMiddleware: Handle = async ({ event, resolve }) => {
    // Skip WebSocket initialization for auth routes
    if (event.url.pathname.startsWith('/auth/')) {
        return await resolve(event);
    }

    if (!wssInitialized) {
        startupWebsocketServer();
        
        // Setup WebSocket authentication
        const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
        if (wss !== undefined) {
            wss.on('connection', async (ws, request) => {
                try {
                    console.debug('[wss:kit] auth debug - connection request headers:', {
                        cookie: request.headers.cookie,
                    });

                    // Check for API key in query parameters
                    const url = new URL(request.url, 'http://localhost');
                    const apiKey = url.searchParams.get('apiKey');
                    
                    if (apiKey) {
                        // Validate API key
                        console.debug('[wss:kit] auth debug - using API key authentication');
                        
                        try {
                            // Find the API key in the database
                            const apiKeyRecord = await prisma.apiKey.findUnique({
                                where: { key: apiKey },
                                include: { user: true }
                            });
                            
                            if (!apiKeyRecord || !apiKeyRecord.active) {
                                console.warn('[wss:kit] invalid or inactive API key');
                                ws.close(1008, 'Invalid API key');
                                return;
                            }
                            
                            // Store user info in WebSocket instance
                            ws.userId = apiKeyRecord.userId;
                            ws.userRole = apiKeyRecord.user.role;
                            
                            console.info(`[wss:kit] client connected via API key (${ws.socketId}) - User: ${ws.userId}, Role: ${ws.userRole}`);
                            
                            ws.send(JSON.stringify({
                                type: 'welcome',
                                data: {
                                    message: `Hello from SvelteKit API ${new Date().toLocaleString()}`,
                                    socketId: ws.socketId,
                                    userId: ws.userId,
                                    role: ws.userRole,
                                    authMethod: 'apiKey'
                                }
                            }));
                            
                            ws.on('close', () => {
                                console.info(`[wss:kit] client disconnected (${ws.socketId}) - User: ${ws.userId}`);
                            });
                            
                            return;
                        } catch (error) {
                            console.error('[wss:kit] API key validation error:', error);
                            ws.close(1008, 'API key validation failed');
                            return;
                        }
                    }
                    
                    // If no API key, fall back to session cookie authentication
                    const cookies = parseCookie(request.headers.cookie || '');
                    console.debug('[wss:kit] auth debug - parsed cookies:', cookies);

                    const sessionId = cookies[lucia.sessionCookieName];
                    console.debug('[wss:kit] auth debug - session cookie:', {
                        cookieName: lucia.sessionCookieName,
                        sessionId: sessionId ? 'found' : 'not found'
                    });
                    
                    if (!sessionId) {
                        console.warn('[wss:kit] no session cookie found');
                        ws.close(1008, 'Authentication required');
                        return;
                    }

                    // Validate session
                    console.debug('[wss:kit] auth debug - validating session:', { sessionId });
                    const { session, user } = await lucia.validateSession(sessionId);
                    console.debug('[wss:kit] auth debug - session validation result:', {
                        valid: !!user,
                        user: user ? {
                            userId: user.id,
                            role: user.role
                        } : null
                    });

                    if (!user) {
                        console.warn('[wss:kit] invalid session');
                        ws.close(1008, 'Invalid session');
                        return;
                    }

                    // Store user info in WebSocket instance
                    ws.userId = user.id;
                    ws.userRole = user.role;

                    console.info(`[wss:kit] client connected via session (${ws.socketId}) - User: ${user.id}, Role: ${user.role}`);
                    
                    ws.send(JSON.stringify({
                        type: 'welcome',
                        data: {
                            message: `Hello from SvelteKit ${new Date().toLocaleString()}`,
                            socketId: ws.socketId,
                            userId: user.id,
                            role: user.role,
                            authMethod: 'session'
                        }
                    }));

                    ws.on('close', () => {
                        console.info(`[wss:kit] client disconnected (${ws.socketId}) - User: ${user.id}`);
                    });

                } catch (error) {
                    console.error('[wss:kit] authentication error:', error);
                    ws.close(1008, 'Authentication failed');
                }
            });
        }
    }
    
    // Skip WebSocket server when pre-rendering pages
    if (!building) {
        const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
        if (wss !== undefined) {
            event.locals.wss = wss;
        }
    }
    
    return await resolve(event);
};

// Auth middleware
const authMiddleware: Handle = async ({ event, resolve }) => {
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

// Combine middleware functions
export const handle: Handle = async ({ event, resolve }) => {
    // Apply WebSocket middleware
    const wsResult = await websocketMiddleware({ event, resolve: async (event) => event });
    
    // Apply auth middleware and return final result
    return await authMiddleware({ 
        event: wsResult, 
        resolve 
    });
};
