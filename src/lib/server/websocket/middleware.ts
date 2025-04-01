import type { Handle } from "@sveltejs/kit";
import { GlobalThisWSS, type ExtendedGlobal, type ExtendedWebSocket, startupWebsocketServer, wssInitialized } from "$lib/server/websocket/WebSocketUtils";
import { building } from "$app/environment";
import { nanoid } from 'nanoid';
import { WebSocketManager } from './WebSocketManager';
import { validateApiKey, getUserIdFromApiKey, getUserInfoFromApiKey } from '$lib/server/auth/api-key-utils';
import { logger } from "../logger";

export const websocketMiddleware: Handle = async ({ event, resolve }) => {
    // Skip WebSocket initialization for auth routes
    if (event.url.pathname.startsWith('/auth/')) {
        return await resolve(event);
    }

    if (!wssInitialized) {
        startupWebsocketServer();
        
        // Setup WebSocket authentication
        const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
        if (wss !== undefined) {
            wss.on('connection', async (ws: ExtendedWebSocket, request) => {
                try {
                    // Assign socket ID first
                    ws.socketId = nanoid();
                    logger.debug(`[wss:kit] assigned socket ID: ${ws.socketId}`);

                    // Get API key from query parameters (for non-session auth)
                    const url = new URL(request.url, 'http://localhost');
                    const apiKey = url.searchParams.get('apiKey');

                    // If using API key, validate it
                    if (apiKey) {
                        const isValid = await validateApiKey(apiKey);
                        if (!isValid) {
                            logger.warn('[wss:kit] invalid API key');
                            ws.close(1008, 'Invalid API key');
                            return;
                        }

                        const [userId, userInfo] = await Promise.all([
                            getUserIdFromApiKey(apiKey),
                            getUserInfoFromApiKey(apiKey)
                        ]);

                        if (!userId || !userInfo) {
                            logger.warn('[wss:kit] invalid API key - no user info');
                            ws.close(1008, 'Invalid API key');
                            return;
                        }

                        ws.userId = userId;
                        ws.userRole = userInfo.systemRole;
                        logger.info(`[wss:kit] client connected via API key (${ws.socketId}) - User: ${ws.userId}, Role: ${ws.userRole}`);
                    } else {
                        // Get session info from auth middleware
                        const auth = event.locals.auth;
                        const sessionData = await auth.validate();
                        
                        if (!sessionData?.user) {
                            logger.warn('[wss:kit] no valid session');
                            ws.close(1008, 'Authentication required');
                            return;
                        }
                        
                        ws.userId = sessionData.user.id;
                        ws.userRole = sessionData.user.systemRole;
                        logger.info(`[wss:kit] client connected via session (${ws.socketId}) - User: ${ws.userId}, Role: ${ws.userRole}`);
                    }
                      
                    ws.send(JSON.stringify({
                        type: 'welcome',
                        data: {
                            message: `Hello from SvelteKit ${apiKey ? 'API ' : ''}${new Date().toLocaleString()}`,
                            socketId: ws.socketId,
                            userId: ws.userId,
                            role: ws.userRole,
                            authMethod: apiKey ? 'apiKey' : 'session'
                        }
                    }));

                    // Get WebSocket manager instance and add this client
                    const manager = WebSocketManager.getInstance();
                    manager.addClient(ws);
                    
                    // Log the client count after adding
                    logger.info(`[wss:kit] client added to manager, total clients: ${manager.getClientCount()}`);

                    // Set up message handling after authentication
                    ws.on('message', (message: string) => {
                        manager.handleMessage(message.toString(), ws);
                    });

                    ws.on('error', (error) => {
                        manager.handleClientError(ws, error);
                    });
                    
                    ws.on('close', () => {
                        manager.handleClientDisconnect(ws);
                    });

                } catch (error) {
                    console.log("--------------------------------------------");
                    console.log(error);
                    logger.error('[wss:kit] authentication error:', error);
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
