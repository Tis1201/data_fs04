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

    private constructor() {
        logger.info('WebSocket Manager initialized');
        
        // Register with the middleware
        this.registerWithMiddleware();
    }
    
    /**
     * Register with the WebSocket middleware to receive client connections
     */
    private registerWithMiddleware(): void {
        try {
            // Get the WebSocketUtils module
            import('$lib/server/websocket/WebSocketUtils').then(({ GlobalThisWSS }) => {
                const global = globalThis as any;
                const wss = global[GlobalThisWSS];
                
                if (wss) {
                    logger.info('[wss:manager] Registering with WebSocket server');
                    
                    // Listen for connection events
                    wss.on('connection', (ws: ExtendedWebSocket) => {
                        // Add the client to our set
                        this.addClient(ws);
                        
                        // Set up event handlers
                        ws.on('close', () => this.handleClientDisconnect(ws));
                        ws.on('error', (error) => this.handleClientError(ws, error));
                        ws.on('message', (message) => this.handleMessage(message.toString(), ws));
                    });
                } else {
                    logger.error('[wss:manager] WebSocket server not available');
                }
            }).catch(error => {
                logger.error('[wss:manager] Error registering with middleware:', error);
            });
        } catch (error) {
            logger.error('[wss:manager] Error in registerWithMiddleware:', error);
        }
    }

    /**
     * Get the singleton instance
     */
    static getInstance(wss?: any): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    /**
     * Add a new WebSocket client
     * @param ws The WebSocket client
     */
    addClient(ws: ExtendedWebSocket): void {
        this.clients.add(ws);
        logger.debug(`[wss:manager] added client: ${ws.socketId}`);
    }

    /**
     * Remove a WebSocket client
     * @param ws The WebSocket client
     */
    removeClient(ws: ExtendedWebSocket): void {
        this.clients.delete(ws);
        logger.debug(`[wss:manager] removed client: ${ws.socketId}`);
    }

    /**
     * Broadcast a message to all connected clients
     * @param message The message to broadcast
     */
    broadcast(message: any): void {
        console.log("---------------WS Broadcast-----------------------")
        console.log(message)
        console.log("---------------End WS Broadcast-----------------------")
        
        const jsonMessage = JSON.stringify(message);

        // Log the number of clients
        const clientCount = this.clients.size;
        logger.info(`[wss:manager] broadcasting to ${clientCount} clients`);
        
        if (clientCount === 0) {
            logger.warn('[wss:manager] No clients connected to broadcast to');
            return;
        }

        this.clients.forEach((ws) => {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    logger.debug(`[wss:manager] broadcasting message to ${ws.socketId}`);
                    ws.send(jsonMessage);
                }
            } catch (error) {
                logger.error(`[wss:manager] Error sending to client ${ws.socketId}:`, error);
            }
        });
    }

    /**
     * Handle incoming WebSocket messages
     * @param message The message string
     * @param ws The WebSocket client
     */
    handleMessage(message: string, ws: ExtendedWebSocket): void {
        try {
            const data = JSON.parse(message);
            logger.debug(`[wss:manager] received message from ${ws.socketId}:`, data);
            
            // Handle different message types
            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
                case 'subscribe':
                    // Handle subscription logic if needed
                    break;
                case 'whatsapp':
                    // Handle WhatsApp-related messages
                    this.handleWhatsAppMessage(data, ws);
                    break;
                default:
                    logger.warn(`[wss:manager] unknown message type: ${data.type}`);
            }
        } catch (error) {
            logger.error(`[wss:manager] error handling message from ${ws.socketId}:`, error);
        }
    }

    /**
     * Handle client errors
     * @param ws The WebSocket client
     * @param error The error object
     */
    handleClientError(ws: ExtendedWebSocket, error: Error): void {
        logger.error(`[wss:manager] client error (${ws.socketId}):`, error);
        this.removeClient(ws);
    }

    /**
     * Handle client disconnection
     * @param ws The WebSocket client
     */
    handleClientDisconnect(ws: ExtendedWebSocket): void {
        logger.info(`[wss:manager] client disconnected: ${ws.socketId}`);
        this.removeClient(ws);
    }
    
    /**
     * Get the number of connected clients
     */
    getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Get all WebSocket clients for a specific user
     * @param userId - User ID to filter by
     * @returns Array of WebSocket clients for the user
     */
    public getClientsByUserId(userId: string): ExtendedWebSocket[] {
        logger.debug(`[WebSocketManager] Getting clients for user: ${userId}`);
        
        return Array.from(this.clients).filter(client => {
            return client.userId === userId;
        });
    }

    /**
     * Handle WhatsApp-related messages
     * @param data The message data
     * @param ws The WebSocket client
     */
    private async handleWhatsAppMessage(data: any, ws: ExtendedWebSocket): Promise<void> {
        try {
            // Import WhatsAppAccountManager here to avoid circular dependencies
            const { whatsAppAccountManager } = await import('$lib/server/whatsapp/WhatsAppAccountManager');
            
            logger.info(`[wss:manager] handling WhatsApp message: ${data.action}`);
            
            switch (data.action) {
                case 'testMessage':
                    logger.info(`[wss:manager] Received test message request: ${data.data?.message || 'No message content'}`);
                    
                    // Send a test message using the WhatsAppAccountManager
                    whatsAppAccountManager.sendTestMessage(data.data?.message || 'Test message');
                    
                    // Also send a direct response to the client
                    ws.send(JSON.stringify({
                        type: 'whatsapp',
                        action: 'testMessageResponse',
                        data: {
                            message: 'Test message received and broadcast',
                            timestamp: Date.now()
                        }
                    }));
                    break;
                    
                case 'requestQRCode':
                    const accountId = data.data?.accountId;
                    logger.info(`[wss:manager] QR code requested for account: ${accountId || 'new account'}`);
                    
                    try {
                        // Generate a new temporary client ID if none provided
                        const clientId = `temp-${crypto.randomUUID()}`;
                        
                        // Create a new WhatsApp client which will generate a QR code
                        const client = await whatsAppAccountManager.createClient(undefined, accountId, {
                            clientId
                        });
                        
                        // The QR code will be sent via the event listeners in WhatsAppAccountManager
                        logger.info(`[wss:manager] Created WhatsApp client with ID ${clientId}`);
                        
                        // Send confirmation back to the client
                        ws.send(JSON.stringify({
                            type: 'whatsapp',
                            action: 'clientCreated',
                            data: {
                                clientId,
                                accountId: accountId || null,
                                status: 'connecting'
                            }
                        }));
                    } catch (error) {
                        logger.error(`[wss:manager] Error creating WhatsApp client:`, error);
                        ws.send(JSON.stringify({
                            type: 'whatsapp',
                            action: 'error',
                            data: {
                                message: 'Failed to create WhatsApp client. Please try again.'
                            }
                        }));
                    }
                    break;
                    
                default:
                    logger.warn(`[wss:manager] unknown WhatsApp action: ${data.action}`);
            }
        } catch (error) {
            logger.error(`[wss:manager] error handling WhatsApp message:`, error);
        }
    }

    /**
     * Get all connected clients
     * @returns Array of client objects
     */
    getClients(): ExtendedWebSocket[] {
        return Array.from(this.clients);
    }

    /**
     * Send a message to a single WebSocket client
     * @param message The message to send
     * @param socketId The socket ID of the client to send to
     * @returns boolean indicating if the message was successfully sent
     */
    public unicast(message: any, socketId: string): boolean {
        const client = Array.from(this.clients).find(ws => ws.socketId === socketId);
        
        if (!client) {
            logger.warn(`[wss:manager] No client found with socketId: ${socketId}`);
            return false;
        }

        try {
            if (client.readyState === WebSocket.OPEN) {
                logger.debug(`[wss:manager] unicasting message to ${socketId}`);
                client.send(JSON.stringify(message));
                return true;
            }
            logger.warn(`[wss:manager] Client ${socketId} not in OPEN state`);
            return false;
        } catch (error) {
            logger.error(`[wss:manager] Error unicasting to client ${socketId}:`, error);
            return false;
        }
    }

    /**
     * Send a message to all WebSocket clients for a specific user
     * @param message The message to send
     * @param userId The user ID to send to
     * @returns number of clients the message was successfully sent to
     */
    public sendToUser(message: any, userId: string): number {
        const clients = this.getClientsByUserId(userId);
        
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
}

// Export the singleton instance
export const wsManager = WebSocketManager.getInstance();
