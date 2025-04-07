import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';
import { WhatsAppAccountClient, DEFAULT_AUTH_DIR, DEFAULT_MEDIA_DIR } from './WhatsAppAccountClient';
import type { WhatsAppClientState } from './WhatsAppAccountClient';
import type { WhatsAppMessage } from './WhatsAppAccountClient';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { wsManager } from '../websocket/WebSocketManager';
import { eventRouter, EventType, EventScope, EventDestination } from '../event/EventRouter';
import { getEnhancedPrisma } from '$lib/server/prisma';

/****************************************************************************************************
 * 
 *  WhatsAppManagerOptions
 * 
 ****************************************************************************************************/
export interface WhatsAppManagerOptions {
    authDir?: string;
    mediaDir?: string;
    auth?: {};
}

const clientOptions = {
    authDir: "whatsapp-auth",
    mediaDir: "whatsapp-media",
};

/****************************************************************************************************
 * 
 *  WhatsAppAccountManager Class
 * 
 ****************************************************************************************************/
export class WhatsAppAccountManager extends EventEmitter {

    // Store for all WhatsApp clients
    private clients = new Map<string, WhatsAppAccountClient>();

    private options: WhatsAppManagerOptions;
    
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly CLEANUP_INTERVAL_MS = 60000; // Run cleanup every minute
    private readonly MAX_AWAITING_SCAN_MS = 300000; // 5 minutes
    
    private prisma: any;

    /****************************************************************************************************
    * 
    *  Constructor
    * 
    ****************************************************************************************************/
    constructor(options?: WhatsAppManagerOptions) {
        super();
        this.options = options || {};
        logger.info('WhatsApp Account Manager initialized');
        this.startCleanupInterval();

        this.prisma = getEnhancedPrisma({
            id: '',
            systemRole: 'ADMIN',     
        });
    }

    /****************************************************************************************************
    * 
    *  createQRCodePromise
    * 
    ****************************************************************************************************/
    private createQRCodePromise(client: WhatsAppAccountClient, immediateCheck: boolean): Promise<string> {
        return new Promise<string>((resolve) => {
            if (immediateCheck && client.getState() === 'connected') {
                resolve('');
            } else {
                client.once('qr', (qrCode: string) => resolve(qrCode));
                if (!immediateCheck) {
                    client.once('connected', () => resolve(''));
                }
            }
        });
    }

    /****************************************************************************************************
    * 
    *  Create Client
    * 
    ****************************************************************************************************/
    // private createClient(clientId:String ){

    // }

    /****************************************************************************************************
    * 
    *  createNewClient
    * 
    ****************************************************************************************************/
    public async createNewClient(createdBy: string)
    : Promise<{ clientId: string; qrCodePromise: Promise<string>; restored: boolean }> {
        
        // Create and store a new WhatsApp client.
        const client = new WhatsAppAccountClient();
        client.setCreatedBy(createdBy);
        
        this.clients.set(client.getId(), client);

        // Set up event listeners (resolve QR code on first 'qr' event).
        this.setupClientEventListeners(client, client.getId());

        const qrCodePromise = this.createQRCodePromise(client, false);

        // Connect the client.
        await client.connect();

        return { clientId: client.getId(), qrCodePromise, restored: false };
    }

    /**
     * Creates a new WhatsApp client with a generated ID.
     *
     * @param phoneNumber - Optional phone number.
     * @param accountId - Optional account ID for database reference.
     * @param options - Optional client-specific options.
     * @returns Client ID and QR code promise.
     */
    /**
     * Creates a new WhatsApp client with optional user ID association
     * 
     * @param phoneNumber Optional phone number
     * @param accountId Optional account ID for database reference
     * @param options Optional configuration options including createdBy user ID
     * @returns Client ID and QR code promise
     */
    async createClient(createdBy: string): Promise<{ clientId: string; qrCodePromise: Promise<string> }> {
        try {
            // Create a new client with the provided user ID
            const result = await this.createNewClient(createdBy);
            
            // Set the createdBy user ID on the client
            const client = this.getClient(result.clientId);
            if (client) {
                client.setCreatedBy(createdBy);
                logger.info(`Associated WhatsApp client ${result.clientId} with user ${createdBy}`);
            }
            
            return { clientId: result.clientId, qrCodePromise: result.qrCodePromise };
        } catch (error) {
            logger.error(`Error creating WhatsApp client: ${error}`);
            throw error;
        }
    }

    /**
     * Checks if a session exists on disk.
     *
     * @param sessionId - Session ID to check.
     * @returns True if session exists and contains files, false otherwise.
     */
    sessionExists(sessionId: string): boolean {
        const baseAuthDir = this.options.authDir || DEFAULT_AUTH_DIR;
        const sessionDir = path.join(baseAuthDir, sessionId);
        return fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
    }

    /**
     * Restores an existing client or creates a new one based on session ID.
     *
     * @param sessionId - Optional session ID to restore. If null, a new client is created.
     * @param phoneNumber - Optional phone number.
     * @param accountId - Optional account ID for database reference.
     * @param options - Optional client-specific options.
     * @returns Client ID, QR code promise, and restored flag.
     */
    async restoreOrCreateClient(
        sessionId?: string | null,
        phoneNumber?: string,
        accountId?: string,
        options?: WhatsAppManagerOptions
    ): Promise<{ clientId: string; qrCodePromise: Promise<string>; restored: boolean }> {
        try {
            // Create a new client if no session ID is provided.
            // if (!sessionId) {
            //     const newClientId = uuidv4();
            //     logger.info(`Creating new WhatsApp client with generated ID ${newClientId}`);
            //     return await this.createNewClient(newClientId, phoneNumber, accountId, options);
            // }

            // If the client is already active in memory.
            if (this.clients.has(sessionId!)) {
                logger.info(`Client with session ID ${sessionId} is already active in memory`);
                const client = this.clients.get(sessionId!)!;
                const qrCodePromise = this.createQRCodePromise(client, true);

                // If client is disconnected, attempt to reconnect.
                if (client.getState() === 'disconnected') {
                    await client.connect();
                }
                return { clientId: sessionId!, qrCodePromise, restored: true };
            }

            // If a session exists on disk, restore the client.
            if (this.sessionExists(sessionId!)) {
                logger.info(`Restoring WhatsApp client from existing session ${sessionId}`);
                const clientOptions = {
                    authDir: this.options.authDir,
                    mediaDir: this.options.mediaDir,
                };
                const client = new WhatsAppAccountClient(sessionId!, phoneNumber, accountId, clientOptions);
                this.clients.set(sessionId!, client);
                const qrCodePromise = this.createQRCodePromise(client, false);
                this.setupClientEventListeners(client, sessionId!, accountId);
                await client.connect();
                return { clientId: sessionId!, qrCodePromise, restored: true };
            }

            // If no session exists, create a new client with the specified session ID.
            logger.info(`Creating new WhatsApp client with session ID ${sessionId}`);
            return await this.createNewClient(sessionId!, phoneNumber, accountId, options);
        } catch (error) {
            logger.error(`Error restoring or creating WhatsApp client: ${error}`);
            throw error;
        }
    }

    /**
     * Retrieves a client instance by its ID.
     *
     * @param clientId - The client ID.
     * @returns The WhatsApp client instance or undefined if not found.
     */
    getClient(clientId: string): WhatsAppAccountClient | undefined {
        return this.clients.get(clientId);
    }

    /**
     * Retrieves all client instances.
     *
     * @returns An array of all WhatsApp client instances.
     */
    getAllClients(): WhatsAppAccountClient[] {
        return Array.from(this.clients.values());
    }

    /**
     * Retrieves client information by client ID.
     *
     * @param clientId - The client ID.
     * @returns Client info or null if the client is not found.
     */
    getClientInfo(clientId: string): any | null {
        const client = this.getClient(clientId);
        return client ? client.getInfo() : null;
    }

    /**
     * Retrieves information for all clients.
     *
     * @returns An array of client info objects.
     */
    getAllClientsInfo(): any[] {
        return this.getAllClients().map((client) => client.getInfo());
    }

    /**
     * Disconnects a client and removes it from the manager.
     *
     * @param clientId - The client ID.
     * @returns True if the client was successfully disconnected and removed, false otherwise.
     */
    async disconnectClient(clientId: string): Promise<boolean> {
        const client = this.getClient(clientId);
        if (!client) return false;
        try {
            const success = await client.disconnect();
            if (success) {
                this.clients.delete(clientId);
            }
            return success;
        } catch (error) {
            logger.error(`Error disconnecting client ${clientId}: ${error}`);
            return false;
        }
    }

    /**
     * Sets up event listeners for a client to handle QR codes, state updates, and messages.
     *
     * @param client - The WhatsAppAccountClient instance.
     * @param clientId - The client ID.
     * @param accountId - Optional account ID for database reference.
     * @param qrCodeResolve - Optional resolve function for QR code promise.
     */
    private setupClientEventListeners(
        client: WhatsAppAccountClient,
        clientId: string,
        accountId?: string,
        qrCodeResolve?: (value: string) => void
    ): void {
        // If a resolve function is provided, use it to resolve on the first QR code.
        if (qrCodeResolve) {
            client.once('qr', (qrCode: string) => {
                qrCodeResolve(qrCode);
            });
        }

        // Always broadcast QR codes to the web UI.
        client.on('qr', (qrCode: string) => {

            // Get the user ID who created this WhatsApp client
            const userId = client.getCreatedBy();
            
            if (userId) {
                logger.info(`Sending QR code for client ${clientId} to user ${userId}: ${qrCode}`);
                
                // Send QR code only to the specific user who created this client
                eventRouter.sendPrivateMessage(
                    userId,
                    { 
                        type: 'whatsapp',
                        action: 'qrCode',
                        data: { clientId, qrCode, accountId: accountId || null }
                    },
                    EventType.WHATSAPP_MESSAGE
                );
            } else {
                logger.warn(`No user ID associated with client ${clientId}, QR code cannot be delivered`);
            }

            // wsManager.sendToUser({ type: 'whatsapp',
            //     action: 'qrCode',
            //     data: { clientId, qrCode, accountId: accountId || null },
            // }, locals.auth.id);



        });

        // Listen for state changes and update the database if needed.
        client.on('state', (state: WhatsAppClientState) => {
            
            if (accountId) {
                this.updateAccountStatus(accountId, state, clientId);
            }
            
            logger.debug(`Number of whatsappclients: ${this.clients.size}`);

            const pushName      = client.getPushName();
            const phoneNumber   = client.getPhoneNumber();
            
            logger.info(`Client state update for ${clientId}: state=${state}, pushName=${pushName}, phoneNumber=${phoneNumber}`);

            eventRouter.sendPrivateMessage(
                client.getCreatedBy()!,
                { 
                    action: state,
                    data: { clientId, state, pushName, phoneNumber }
                },
                EventType.WHATSAPP_MESSAGE
            );

            // wsManager.broadcast({
            //     type: 'whatsapp',
            //     action: 'state',
            //     data: { clientId, state, pushName, phoneNumber },
            // });

        });

        // On connection, broadcast additional user info.
        // client.on('connected', (userInfo: any) => {
        //     logger.info(`Client ${clientId} connected with user info:`, userInfo);
        //     wsManager.broadcast({
        //         type: 'whatsapp_state',
        //         data: {
        //             clientId,
        //             state: 'connected',
        //             pushName: userInfo.name,
        //             phoneNumber: userInfo.phoneNumber,
        //         },
        //     });
        // });

        // Handle logout events.
        // client.on('logout', () => {
        //     if (accountId) {
        //         this.updateAccountStatus(accountId, 'disconnected');
        //     }
        //     wsManager.broadcast({ type: 'whatsapp_logout', data: { clientId } });
        // });
        
        // Handle conflict events (session replaced)
        // client.on('conflict', () => {
        //     logger.warn(`Client ${clientId} reported conflict: session replaced by another connection`);
            
        //     // Update account status to disconnected
        //     if (accountId) {
        //         this.updateAccountStatus(accountId, 'disconnected');
        //     }
            
        //     // Broadcast conflict message to the web UI
        //     wsManager.broadcast({ 
        //         type: 'whatsapp_error', 
        //         data: { 
        //             clientId, 
        //             error: 'conflict', 
        //             message: 'WhatsApp session replaced by another connection. This typically happens when the same account is logged in elsewhere.'
        //         } 
        //     });
            
        //     // Remove the client from the manager to prevent reconnection attempts
        //     this.clients.delete(clientId);
            
        //     logger.info(`Client ${clientId} removed from manager due to conflict`);
        // });

        // Forward message events to the web UI.
        client.on('message', (message: WhatsAppMessage) => {
            wsManager.broadcast({ type: 'whatsapp_message', data: { clientId, message } });
        });
    }

    /**
     * Sends a text message using a specified client.
     *
     * @param clientId - The client ID.
     * @param to - The recipient's phone number or group ID.
     * @param text - The message text.
     * @returns The message ID if successful, or null.
     */
    async sendMessage(clientId: string, to: string, text: string): Promise<string | null> {
        const client = this.getClient(clientId);
        if (!client) {
            logger.error(`Client ${clientId} not found`);
            return null;
        }
        return client.sendTextMessage(to, text);
    }

    /**
     * Generates a pairing code for phone number login.
     *
     * @param clientId - The client ID.
     * @returns The pairing code if successful, or null.
     */
    async generatePairingCode(clientId: string): Promise<string | null> {
        const client = this.getClient(clientId);
        if (!client) {
            logger.error(`Client ${clientId} not found`);
            return null;
        }
        return client.generatePairingCode();
    }

    /**
     * Sends a test message for debugging purposes.
     *
     * @param clientId - The client ID.
     */
    async sendTestMessage(clientId: string): Promise<void> {
        const client = this.getClient(clientId);
        if (!client) {
            logger.error(`Client ${clientId} not found`);
            return;
        }

        // Construct a test message.
        const testMessage = {
            id: `test-${Date.now()}`,
            from: 'test-sender@s.whatsapp.net',
            to: 'test-recipient@s.whatsapp.net',
            content: 'This is a test message from debug page',
            timestamp: Date.now(),
            isFromMe: false,
            type: 'text' as const,
        };

        logger.info(`Sending test message for client ${clientId}`);
        client.emit('message', testMessage);
        wsManager.broadcast({
            type: 'whatsapp_message',
            data: { clientId, message: testMessage },
        });
        logger.info(`Test message sent for client ${clientId}`);
    }

    /**
     * Updates the account status in the database.
     * (Placeholder: implement actual database updates as needed.)
     *
     * @param accountId - The account ID.
     * @param status - The current state of the client.
     * @param clientId - Optional client ID.
     */
    private async updateAccountStatus(accountId: string, status: WhatsAppClientState, clientId?: string): Promise<void> {
        logger.info(`Account ${accountId} status updated to ${status}${clientId ? ` with client ID ${clientId}` : ''}`);
        // TODO: Implement actual database update.
    }

    /**
     * Initializes clients from the database by reconnecting active accounts.
     */
    async initializeClientsFromDatabase(): Promise<void> {
        logger.info('Initializing WhatsApp clients from database');
        try {
            
            const accounts = await this.prisma.whatsAppAccount.findMany();
            
            logger.info(`Found ${accounts.length} WhatsApp accounts to initialize`);

            for (const account of accounts) {
                try {
                    const client = new WhatsAppAccountClient(account.client_id);
                    client.setAccountId(account.id);
                    client.setCreatedBy(account.createdBy);
                    this.clients.set(account.client_id, client);
                    this.setupClientEventListeners(client, account.client_id, account.id);
                    // await client.connect();
                    logger.info(`Initialized WhatsApp client for account ${account.id} (${account.description})`);
                } catch (clientError) {
                    logger.error(`Failed to initialize WhatsApp client for account ${account.id}: ${clientError}`);
                    await this.prisma.whatsAppAccount.update({
                        where: { id: account.id },
                        data: { client_status: 'disconnected' },
                    });
                }
            }
            logger.info(`Successfully initialized ${this.clients.size} WhatsApp clients`);
        } catch (error) {
            logger.error(`Error initializing clients from database: ${error}`);
        }
    }

    /**
     * Starts the cleanup interval to remove stale clients.
     */
    private startCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleClients();
        }, this.CLEANUP_INTERVAL_MS);
        logger.info(`Started client cleanup interval (every ${this.CLEANUP_INTERVAL_MS / 1000} seconds)`);
    }

    /**
     * Stops the cleanup interval.
     */
    private stopCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('Stopped client cleanup interval');
        }
    }

    /**
     * Cleans up stale clients that have been in the 'awaiting_scan' state for too long.
     */
    private async cleanupStaleClients(): Promise<void> {
        const now = Date.now();
        const staleClientIds: string[] = [];

        // Identify clients that have been awaiting scan for longer than the allowed duration.
        for (const [clientId, client] of this.clients.entries()) {
            if (client.getState() === 'awaiting_scan') {
                const createdAt = client.getCreatedAt();
                if (now - createdAt > this.MAX_AWAITING_SCAN_MS) {
                    staleClientIds.push(clientId);
                }
            }
        }

        if (staleClientIds.length > 0) {
            logger.info(`Found ${staleClientIds.length} stale clients to clean up`);
            for (const clientId of staleClientIds) {
                try {
                    const client = this.clients.get(clientId);
                    if (client) {
                        await client.disconnect();
                        this.clients.delete(clientId);
                        logger.info(`Cleaned up stale client ${clientId} (awaiting_scan too long)`);
                    }
                } catch (error) {
                    logger.error(`Error cleaning up stale client ${clientId}: ${error}`);
                }
            }
        }
    }
}

// Export a singleton instance.
export const whatsAppAccountManager = new WhatsAppAccountManager();
