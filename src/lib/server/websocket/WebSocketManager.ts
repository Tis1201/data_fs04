import { logger } from '$lib/server/logger';
import { WebSocket } from 'ws';
import crypto from 'crypto';
import { log } from 'console';

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
    // private userClientMap = new Map<string, Set<ExtendedWebSocket>>();

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
        // Add to the main clients Set first
        this.clients.add(ws);

        // if (ws.userId) {
        //     // Get or create the user's client set
        //     const userClients = this.userClientMap.get(ws.userId) || new Set();
        //     userClients.add(ws);
        //     this.userClientMap.set(ws.userId, userClients);
            
        //     // Log the current state after adding
        //     logger.debug(`[wss:manager] added client: ${ws.socketId} for user: ${ws.userId}`);
        //     logger.debug(`[wss:manager] userClientMap size after add: ${this.userClientMap.size}`);
        //     logger.debug(`[wss:manager] user ${ws.userId} has ${userClients.size} clients`);
        // } else {
        //     logger.warn(`[wss:manager] client ${ws.socketId} has no userId, not adding to userClientMap`);
        // }
    }  

    removeClient(ws: ExtendedWebSocket): void {
        // Remove from the main clients Set
        this.clients.delete(ws);

        // if (ws.userId) {
        //     // Remove from user's client set
        //     const userClients = this.userClientMap.get(ws.userId);
        //     if (userClients) {
        //         logger.debug(`[wss:manager] removing client ${ws.socketId} from user ${ws.userId}, before: ${userClients.size} clients`);
        //         userClients.delete(ws);
        //         logger.debug(`[wss:manager] after removal: ${userClients.size} clients remaining`);
                
        //         // Only remove from userClientMap if the client was actually in the set
        //         if (userClients.size === 0) {
        //             this.userClientMap.delete(ws.userId);
        //             logger.debug(`[wss:manager] removed user ${ws.userId} from userClientMap, new size: ${this.userClientMap.size}`);
        //         }
        //     } else {
        //         logger.warn(`[wss:manager] tried to remove client ${ws.socketId} for user ${ws.userId} but user not in map`);
        //     }
        // } 

        logger.debug(`[wss:manager] removed client: ${ws.socketId} for user: ${ws.userId}`);
    }

    getClientCount(): number {
        return this.clients.size;
    }

    getClients(): ExtendedWebSocket[] {
        return Array.from(this.clients);
    }

    getClientsByUserId(userId: string): ExtendedWebSocket[] {
        logger.debug(`[wss:manager] Getting clients for userId: ${userId}`);
        logger.debug(`[wss:manager] Total clients in registry: ${this.clients.size}`);

        const clients = Array.from(this.clients).filter(ws => {
            const matches = ws.userId === userId;
            logger.debug(`[wss:manager] Client ${ws.socketId} ${matches ? 'matches' : 'does not match'} userId ${userId}, current userId: ${ws.userId}`);
            return matches;
        }); 

        logger.debug(`[wss:manager] Found ${clients.length} matching clients for userId ${userId}`);
        return clients;
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

        logger.debug(`this.clients size: ${this.clients.size}`);
        this.clients.forEach((ws) => {
           logger.debug(`[wss:manager] Client ${ws.socketId} for user ${ws.userId}`);
        }); 

        const clients = this.getClientsByUserId(userId);

        if (clients.length === 0) {
            logger.warn(`[wss:manager] No clients found for user: ${userId}`);
            return 0;
        } 

        let successCount = 0;
        const jsonMessage = JSON.stringify(message);

        for (const client of clients) {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonMessage);
                    successCount++;
                }
            } catch (error) {
                logger.error(`[wss:manager] Error sending to client ${client.socketId}:`, error);
            }
        }
 
        return successCount;
    }

    handleMessage(message: string, ws: ExtendedWebSocket): void {
        try {
            const data = JSON.parse(message);
            logger.debug(`[wss:manager] received message from ${ws.socketId}:${data.type}:`, data);

            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
                case 'register':
                    logger.info(`[wss:manager] client registered: ${ws.socketId} for user ${ws.userId}`)
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
        logger.info(`[wss:manager] client disconnected: ${ws.socketId} for user ${ws.userId}`);
        this.removeClient(ws);
        // Add a longer delay before removing to prevent race conditions
        // This gives time for reconnection attempts to complete
        // setTimeout(() => {
        //     // Check if the client is still in the set before removing
        //     if (this.clients.has(ws)) {
        //         logger.debug(`[wss:manager] removing disconnected client ${ws.socketId} after delay`);
        //         this.removeClient(ws);
        //     } else {
        //         logger.debug(`[wss:manager] client ${ws.socketId} already removed, skipping`);
        //     }
        // }, 1000); // Increased from 100ms to 1000ms
    } 
}

export const wsManager = WebSocketManager.getInstance();
