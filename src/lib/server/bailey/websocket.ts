import WebSocket from 'ws';
import type { ExtendedWebSocket, ExtendedWebSocketServer } from '../webSocketUtils';
import { GlobalThisWSS } from '../webSocketUtils';

/**
 * WebSocket server for WhatsApp communication
 */
export class WebSocketServer {
    /**
     * Broadcast a message to all connected clients
     */
    static broadcast(message: any): void {
        const wss = (globalThis as any)[GlobalThisWSS] as ExtendedWebSocketServer;
        if (!wss) {
            console.error('[wss:whatsapp] WebSocket server not initialized');
            return;
        }
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
    
    /**
     * Send a message to a specific client
     */
    static sendToClient(socketId: string, message: any): boolean {
        const wss = (globalThis as any)[GlobalThisWSS] as ExtendedWebSocketServer;
        if (!wss) {
            console.error('[wss:whatsapp] WebSocket server not initialized');
            return false;
        }
        
        let sent = false;
        wss.clients.forEach(client => {
            if (client.socketId === socketId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
                sent = true;
            }
        });
        
        return sent;
    }
    
    /**
     * Send a message to a specific user
     */
    static sendToUser(userId: string, message: any): boolean {
        const wss = (globalThis as any)[GlobalThisWSS] as ExtendedWebSocketServer;
        if (!wss) {
            console.error('[wss:whatsapp] WebSocket server not initialized');
            return false;
        }
        
        let sent = false;
        wss.clients.forEach(client => {
            if (client.userId === userId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
                sent = true;
            }
        });
        
        return sent;
    }
}
