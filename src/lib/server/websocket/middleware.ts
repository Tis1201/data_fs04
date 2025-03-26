import type { Handle } from "@sveltejs/kit";
import { GlobalThisWSS, type ExtendedGlobal, type ExtendedWebSocket, startupWebsocketServer, wssInitialized } from "$lib/server/webSocketUtils";
import { building } from "$app/environment";
import { nanoid } from 'nanoid';
import { WEBRTC_MESSAGE_TYPES, handleWebRTCMessage, leaveRoom } from '$lib/server/webrtcSignalingUtils';
import { validateApiKey, getUserIdFromApiKey, getUserInfoFromApiKey } from '$lib/server/auth/api-key-utils';

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
                    console.debug(`[wss:kit] assigned socket ID: ${ws.socketId}`);

                    // Get API key from query parameters (for non-session auth)
                    const url = new URL(request.url, 'http://localhost');
                    const apiKey = url.searchParams.get('apiKey');

                    // If using API key, validate it
                    if (apiKey) {
                        const isValid = await validateApiKey(apiKey);
                        if (!isValid) {
                            console.warn('[wss:kit] invalid API key');
                            ws.close(1008, 'Invalid API key');
                            return;
                        }

                        const [userId, userInfo] = await Promise.all([
                            getUserIdFromApiKey(apiKey),
                            getUserInfoFromApiKey(apiKey)
                        ]);

                        if (!userId || !userInfo) {
                            console.warn('[wss:kit] invalid API key - no user info');
                            ws.close(1008, 'Invalid API key');
                            return;
                        }

                        ws.userId = userId;
                        ws.userRole = userInfo.systemRole;
                        console.info(`[wss:kit] client connected via API key (${ws.socketId}) - User: ${ws.userId}, Role: ${ws.userRole}`);
                    } else {
                        // Get session info from auth middleware
                        const auth = event.locals.auth;
                        const sessionData = await auth.validate();
                        
                        if (!sessionData?.user) {
                            console.warn('[wss:kit] no valid session');
                            ws.close(1008, 'Authentication required');
                            return;
                        }
                        
                        ws.userId = sessionData.user.id;
                        ws.userRole = sessionData.user.systemRole;
                        console.info(`[wss:kit] client connected via session (${ws.socketId}) - User: ${ws.userId}, Role: ${ws.userRole}`);
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

                    // Set up message handling after authentication
                    ws.on('message', (message: string) => {
                        try {
                            const data = JSON.parse(message.toString());
                            console.debug(`[wss:kit] message received from ${ws.socketId}:`, data);
                            
                            // Handle WebRTC signaling messages
                            if (data.type === 'webrtc' && data.data && data.data.type && WEBRTC_MESSAGE_TYPES.includes(data.data.type)) {
                                // Pass the actual WebRTC message data to the handler
                                handleWebRTCMessage(data.data, ws, wss);
                                return;
                            } else if (data.type && WEBRTC_MESSAGE_TYPES.includes(data.type)) {
                                // For backward compatibility, also handle direct WebRTC messages
                                handleWebRTCMessage(data, ws, wss);
                                return;
                            }
                            
                            // Handle WhatsApp messages
                            if (data.type === 'whatsapp') {
                                // Forward to all clients for now
                                // In a real implementation, you'd only forward to relevant clients
                                wss.clients.forEach(client => {
                                    if (client.readyState === WebSocket.OPEN) {
                                        client.send(JSON.stringify(data));
                                    }
                                });
                                return;
                            }
                            
                            // Echo the message back
                            ws.send(JSON.stringify({ type: 'echo', data }));
                        } catch (error) {
                            console.error(`[wss:kit] error processing message:`, error);
                        }
                    });

                    ws.on('error', (error) => {
                        console.error(`[wss:kit] client error (${ws.socketId}):`, error);
                    });
                    
                    ws.on('close', () => {
                        console.info(`[wss:kit] client disconnected (${ws.socketId}) - User: ${ws.userId}`);
                        // Clean up WebRTC rooms when client disconnects
                        leaveRoom(ws.socketId);
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
