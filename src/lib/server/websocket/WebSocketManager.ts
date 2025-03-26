import type { WebSocket } from 'ws';
import type { ExtendedWebSocket, ExtendedWebSocketServer } from '$lib/server/websocket/WebSocketUtils';
import { WEBRTC_MESSAGE_TYPES, handleWebRTCMessage, leaveRoom } from '$lib/server/webrtc/WebrtcSignalingUtils';

type MessageHandler = (data: any, ws: ExtendedWebSocket, wss: ExtendedWebSocketServer) => void;

export class WebSocketManager {
    private static instance: WebSocketManager;
    private messageHandlers: Map<string, MessageHandler>;
    private wss: ExtendedWebSocketServer;

    private constructor(wss: ExtendedWebSocketServer) {
        this.wss = wss;
        this.messageHandlers = new Map();
        this.setupDefaultHandlers();
    }

    public static getInstance(wss: ExtendedWebSocketServer): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager(wss);
        }
        return WebSocketManager.instance;
    }

    private setupDefaultHandlers() {
        // Handle WebRTC messages
        this.registerHandler('webrtc', (data, ws, wss) => {
            if (data.data && data.data.type && WEBRTC_MESSAGE_TYPES.includes(data.data.type)) {
                handleWebRTCMessage(data.data, ws, wss);
            } else if (WEBRTC_MESSAGE_TYPES.includes(data.type)) {
                handleWebRTCMessage(data, ws, wss);
            }
        });

        // Handle WhatsApp messages
        this.registerHandler('whatsapp', (data, ws, wss) => {
            // Forward to all clients for now
            // In a real implementation, you'd only forward to relevant clients
            this.broadcast(data);
        });

        // Default echo handler
        this.registerHandler('echo', (data, ws) => {
            ws.send(JSON.stringify({ type: 'echo', data }));
        });
    }

    public registerHandler(type: string, handler: MessageHandler) {
        this.messageHandlers.set(type, handler);
    }

    public handleMessage(message: string, ws: ExtendedWebSocket) {
        try {
            const data = JSON.parse(message.toString());
            // Only log non-ping messages
            if (data.type !== 'ping') {
                console.debug(`[wss:manager] message received from ${ws.socketId}:`, data);
            }

            // Skip logging for ping messages
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }

            const handler = this.messageHandlers.get(data.type);
            if (handler) {
                handler(data, ws, this.wss);
            } else {
                console.warn(`[wss:manager] no handler for message type: ${data.type}`);
                // Default to echo
                ws.send(JSON.stringify({ type: 'echo', data }));
            }
        } catch (error) {
            console.error(`[wss:manager] error processing message:`, error);
        }
    }

    public broadcast(data: any, filter?: (ws: ExtendedWebSocket) => boolean) {
        const message = JSON.stringify(data);
        this.wss.clients.forEach(client => {
            const ws = client as ExtendedWebSocket;
            if (ws.readyState === WebSocket.OPEN && (!filter || filter(ws))) {
                ws.send(message);
            }
        });
    }

    public sendToUser(userId: string, data: any) {
        this.broadcast(data, ws => ws.userId === userId);
    }

    public sendToRole(role: string, data: any) {
        this.broadcast(data, ws => ws.userRole === role);
    }

    public handleClientDisconnect(ws: ExtendedWebSocket) {
        console.info(`[wss:manager] client disconnected (${ws.socketId}) - User: ${ws.userId}`);
        leaveRoom(ws.socketId);
    }

    public handleClientError(ws: ExtendedWebSocket, error: Error) {
        console.error(`[wss:manager] client error (${ws.socketId}):`, error);
    }

    public getConnectedClients(): { socketId: string; userId: string; userRole: string }[] {
        const clients: { socketId: string; userId: string; userRole: string }[] = [];
        this.wss.clients.forEach(client => {
            const ws = client as ExtendedWebSocket;
            if (ws.readyState === WebSocket.OPEN) {
                clients.push({
                    socketId: ws.socketId,
                    userId: ws.userId,
                    userRole: ws.userRole
                });
            }
        });
        return clients;
    }
}
