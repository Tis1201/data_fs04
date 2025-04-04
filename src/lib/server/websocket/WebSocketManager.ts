import { logger } from '$lib/server/logger';
import { WebSocket } from 'ws';
import crypto from 'crypto';

/**
 * Extended WebSocket type with additional properties
 */
export interface ExtendedWebSocket extends WebSocket {
    isAlive: boolean;
    socketId: string;
    userId: string;
    userRole: string;
}

/**
 * WebSocket Manager
 * Manages WebSocket connections and broadcasts messages
 */
export class WebSocketManager {
    private static instance: WebSocketManager;
    private clients = new Set<ExtendedWebSocket>();
    private userClientMap = new Map<string, Set<ExtendedWebSocket>>();

    private constructor() {
        logger.info('WebSocket Manager initialized');
    }

    static getInstance(): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    addClient(ws: ExtendedWebSocket): void {
        this.clients.add(ws);

        if (ws.userId) {
            const userClients = this.userClientMap.get(ws.userId) || new Set();
            userClients.add(ws);
            this.userClientMap.set(ws.userId, userClients);
        }

        logger.debug(`[wss:manager] added client: ${ws.socketId} for user: ${ws.userId}`);
    }

    removeClient(ws: ExtendedWebSocket): void {
        this.clients.delete(ws);

        if (ws.userId && this.userClientMap.has(ws.userId)) {
            const userClients = this.userClientMap.get(ws.userId)!;
            userClients.delete(ws);
            if (userClients.size === 0) {
                this.userClientMap.delete(ws.userId);
            }
        }

        logger.debug(`[wss:manager] removed client: ${ws.socketId} for user: ${ws.userId}`);
    }

    getClientCount(): number {
        return this.clients.size;
    }

    getClients(): ExtendedWebSocket[] {
        return Array.from(this.clients);
    }

    getClientsByUserId(userId: string): ExtendedWebSocket[] {
        return Array.from(this.userClientMap.get(userId) || []);
    }

    broadcast(message: any): void {
        const jsonMessage = JSON.stringify(message);
        logger.info(`[wss:manager] broadcasting to ${this.clients.size} clients`);

        this.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(jsonMessage);
            }
        });
    }

    unicast(message: any, socketId: string): boolean {
        const client = Array.from(this.clients).find(ws => ws.socketId === socketId);

        if (!client) {
            logger.warn(`[wss:manager] No client found with socketId: ${socketId}`);
            return false;
        }

        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`[wss:manager] Error unicasting to client ${socketId}:`, error);
            return false;
        }
    }

    sendToUser(message: any, userId: string): number {
        const clients = this.getClientsByUserId(userId);

        logger.debug(`client count: ${clients.length}`)

        for(const client of clients){
            logger.debug(`[wss:manager] sending message to user ${userId}, socket ${client.socketId}`);
        }

        if (clients.length === 0) {
            logger.warn(`[wss:manager] No clients found for user: ${userId}`);
            return 0;
        }

        let successCount = 0;

        clients.forEach((client) => {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    logger.debug(`[wss:manager] sending message to user ${userId}, socket ${client.socketId}`);
                    client.send(JSON.stringify(message));
                    successCount++;
                } else {
                    logger.warn(`[wss:manager] Client ${client.socketId} for user ${userId} not in OPEN state`);
                }
            } catch (error) {
                logger.error(`[wss:manager] Error sending to user ${userId}, socket ${client.socketId}:`, error);
            }
        });

        if (successCount === 0) {
            logger.warn(`[wss:manager] No successful deliveries to user ${userId}`);
        }

        return successCount;
    }

    handleMessage(message: string, ws: ExtendedWebSocket): void {
        try {
            const data = JSON.parse(message);
            logger.debug(`[wss:manager] received message from ${ws.socketId}:`, data);

            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
                case 'subscribe':
                    break;
                case 'whatsapp':
                    this.handleWhatsAppMessage(data, ws);
                    break;
                default:
                    logger.warn(`[wss:manager] unknown message type: ${data.type}`);
            }
        } catch (error) {
            logger.error(`[wss:manager] error handling message from ${ws.socketId}:`, error);
        }
    }

    async handleWhatsAppMessage(data: any, ws: ExtendedWebSocket): Promise<void> {
        try {
            const { whatsAppAccountManager } = await import('$lib/server/whatsapp/WhatsAppAccountManager');

            logger.info(`[wss:manager] handling WhatsApp message: ${data.action}`);

            switch (data.action) {
                case 'testMessage':
                    whatsAppAccountManager.sendTestMessage(data.data?.message || 'Test message');
                    ws.send(JSON.stringify({
                        type: 'whatsapp',
                        action: 'testMessageResponse',
                        data: {
                            message: 'Test message received and broadcast',
                            timestamp: Date.now()
                        }
                    }));
                    break;
                case 'requestQRCode': {
                    const accountId = data.data?.accountId;
                    const clientId = `temp-${crypto.randomUUID()}`;
                    const client = await whatsAppAccountManager.createClient(undefined, accountId, { clientId });

                    ws.send(JSON.stringify({
                        type: 'whatsapp',
                        action: 'clientCreated',
                        data: {
                            clientId,
                            accountId: accountId || null,
                            status: 'connecting'
                        }
                    }));
                    break;
                }
                default:
                    logger.warn(`[wss:manager] unknown WhatsApp action: ${data.action}`);
            }
        } catch (error) {
            logger.error(`[wss:manager] error handling WhatsApp message:`, error);
        }
    }

    handleClientError(ws: ExtendedWebSocket, error: Error): void {
        logger.error(`[wss:manager] client error (${ws.socketId}):`, error);
        this.removeClient(ws);
    }

    handleClientDisconnect(ws: ExtendedWebSocket): void {
        logger.info(`[wss:manager] client disconnected: ${ws.socketId}`);
        this.removeClient(ws);
    }
}

export const wsManager = WebSocketManager.getInstance();
