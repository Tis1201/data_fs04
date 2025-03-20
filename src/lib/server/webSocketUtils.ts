import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import type { Server, WebSocket as WebSocketBase } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WEBRTC_MESSAGE_TYPES, handleWebRTCMessage, leaveRoom } from './webrtcSignalingUtils';

export const GlobalThisWSS = Symbol.for('fs01.wss');

// Extended WebSocket interface with custom properties
export interface ExtendedWebSocket extends WebSocketBase {
    socketId: string;
    userId?: string;
    userRole?: string;
}

// Extended WebSocket server interface
export interface ExtendedWebSocketServer extends Server<ExtendedWebSocket> {
    clients: Set<ExtendedWebSocket>;
}

// Global type extension
export interface ExtendedGlobal {
    [GlobalThisWSS]: ExtendedWebSocketServer;
}

export let wssInitialized = false;

export const createWSSGlobalInstance = () => {
    const wss = new WebSocketServer({ noServer: true }) as ExtendedWebSocketServer;
    (globalThis as ExtendedGlobal)[GlobalThisWSS] = wss;
    
    // Only assign socketId here, authentication will be handled in hooks.server.ts
    wss.on('connection', (ws: ExtendedWebSocket) => {
        ws.socketId = nanoid();
        console.debug(`[wss:global] assigned socket ID: ${ws.socketId}`);

        ws.on('message', (message: string) => {
            try {
                const data = JSON.parse(message.toString());
                console.debug(`[wss:global] message received from ${ws.socketId}:`, data);
                
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
                console.error(`[wss:global] error processing message:`, error);
            }
        });

        ws.on('error', (error) => {
            console.error(`[wss:global] client error (${ws.socketId}):`, error);
        });
        
        ws.on('close', () => {
            // Clean up WebRTC rooms when client disconnects
            leaveRoom(ws.socketId);
        });
    });

    return wss;
};

export const onHttpServerUpgrade = (req: IncomingMessage, sock: Duplex, head: Buffer) => {
    const pathname = req.url ? parse(req.url).pathname : null;
    if (pathname !== '/websocket') return;

    const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
    if (!wss) {
        console.error('[wss:global] WebSocket server not initialized');
        sock.destroy();
        return;
    }

    wss.handleUpgrade(req, sock, head, (ws) => {
        console.debug('[handleUpgrade] creating new connection');
        wss.emit('connection', ws, req);
    });
};

export function startupWebsocketServer() {
    if (wssInitialized) return;
    
    createWSSGlobalInstance();
    wssInitialized = true;
    
    console.debug('WebSocket server initialized');
}
