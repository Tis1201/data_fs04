import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';
import { WhatsAppAccountClient, DEFAULT_AUTH_DIR, DEFAULT_MEDIA_DIR } from './WhatsAppAccountClient';
import type { WhatsAppClientState } from './WhatsAppAccountClient';
import type { WhatsAppMessage } from './WhatsAppAccountClient';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { wsManager } from '../websocket/WebSocketManager';
import { getEnhancedPrisma } from '$lib/server/prisma';

/**
 * Options for WhatsApp Account Manager
 */
export interface WhatsAppManagerOptions {
    authDir?: string;
    mediaDir?: string;
}

/**
 * WhatsApp Account Manager
 * Manages multiple WhatsApp account clients and their states
 */
export class WhatsAppAccountManager extends EventEmitter {
    // Store for all WhatsApp clients
    private clients = new Map<string, WhatsAppAccountClient>();
    private options: WhatsAppManagerOptions;
    
    constructor(options?: WhatsAppManagerOptions) {
        super();
        this.options = options || {};
        logger.info('WhatsApp Account Manager initialized');
    }
    
    /**
     * Helper method to create a new client
     * @param clientId Client ID to use
     * @param phoneNumber Optional phone number
     * @param accountId Optional account ID for database reference
     * @returns Client info with restored=false
     */
    private async createNewClient(clientId: string, phoneNumber?: string, accountId?: string, options?: WhatsAppManagerOptions): Promise<{ clientId: string, qrCodePromise: Promise<string>, restored: boolean }> {
        // Create a promise to get the QR code
        let qrCodeResolve: (value: string) => void; 
        const qrCodePromise = new Promise<string>((resolve) => {
            qrCodeResolve = resolve; 
        });
        
        // Merge manager options with client-specific options
        const clientOptions = {
            authDir: options?.authDir || this.options.authDir,
            mediaDir: options?.mediaDir || this.options.mediaDir
        };
        
        // Create a new client instance
        const client = new WhatsAppAccountClient(clientId, phoneNumber, accountId, clientOptions);
        
        // Store the client
        this.clients.set(clientId, client);
        
        // Set up event listeners
        this.setupClientEventListeners(client, clientId, accountId, qrCodeResolve);
        
        // Connect the client
        await client.connect();
        
        return { clientId, qrCodePromise, restored: false };
    }
    
    /**
     * Create a new WhatsApp client with a generated ID
     * @param phoneNumber Optional phone number
     * @param accountId Optional account ID for database reference
     * @returns Client ID and QR code promise
     */
    async createClient(phoneNumber?: string, accountId?: string, options?: WhatsAppManagerOptions): Promise<{ clientId: string, qrCodePromise: Promise<string> }> {
        // Simply call restoreOrCreateClient with null sessionId to create a new client
        const result = await this.restoreOrCreateClient(null, phoneNumber, accountId, options);
        return { clientId: result.clientId, qrCodePromise: result.qrCodePromise };
    }
    
    /**
     * Check if a session exists for the given session ID
     * @param sessionId Session ID to check
     * @returns True if session exists, false otherwise
     */
    sessionExists(sessionId: string): boolean {
        // Use the custom auth directory if specified, otherwise use the default
        const baseAuthDir = this.options.authDir || DEFAULT_AUTH_DIR;
        const sessionDir = path.join(baseAuthDir, sessionId);
        return fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
    }
    
    /**
     * Restore or create a client based on session ID
     * @param sessionId Optional session ID to restore. If null/undefined, a new client will be created
     * @param phoneNumber Optional phone number
     * @param accountId Optional account ID for database reference
     * @returns Client ID and QR code promise
     */
    async restoreOrCreateClient(sessionId?: string | null, phoneNumber?: string, accountId?: string, options?: WhatsAppManagerOptions): Promise<{ clientId: string, qrCodePromise: Promise<string>, restored: boolean }> {
        try {
            // If sessionId is null or undefined, generate a new ID
            if (!sessionId) {
                const newClientId = uuidv4();
                logger.info(`Creating new WhatsApp client with generated ID ${newClientId}`);
                return await this.createNewClient(newClientId, phoneNumber, accountId, options);
            }
            
            // Check if this client is already in memory
            if (this.clients.has(sessionId)) {
                logger.info(`Client with session ID ${sessionId} is already active in memory`);
                const client = this.clients.get(sessionId)!;
                
                // Create a promise to get the QR code if needed
                let qrCodeResolve: (value: string) => void;
                const qrCodePromise = new Promise<string>((resolve) => {
                    // If client is already connected, resolve with empty string
                    if (client.getState() === 'connected') {
                        resolve('');
                    } else {
                        // Set up one-time QR code listener
                        client.once('qr', (qrCode: string) => {
                            resolve(qrCode);
                        });
                    }
                });
                
                // If client is disconnected, reconnect it
                if (client.getState() === 'disconnected') {
                    await client.connect();
                }
                
                return { clientId: sessionId, qrCodePromise, restored: true };
            }
            
            // Check if session directory exists on disk
            if (this.sessionExists(sessionId)) {
                logger.info(`Restoring WhatsApp client from existing session ${sessionId}`);
                
                // Merge manager options with client-specific options
                const clientOptions = {
                    authDir: this.options.authDir,
                    mediaDir: this.options.mediaDir
                };
                
                // Create a new client with the existing session ID and custom options
                const client = new WhatsAppAccountClient(sessionId, phoneNumber, accountId, clientOptions);
                
                // Store the client
                this.clients.set(sessionId, client);
                
                // Create a promise to get the QR code if needed
                let qrCodeResolve: (value: string) => void;
                const qrCodePromise = new Promise<string>((resolve) => {
                    // Set up one-time QR code listener in case reconnection requires a new QR code
                    client.once('qr', (qrCode: string) => {
                        resolve(qrCode);
                    });
                    
                    // If connection succeeds without needing a QR code, resolve with empty string
                    client.once('connected', () => {
                        resolve('');
                    });
                });
                
                // Set up event listeners
                this.setupClientEventListeners(client, sessionId, accountId);
                
                // Connect the client
                await client.connect();
                
                return { clientId: sessionId, qrCodePromise, restored: true };
            }
            
            // If session doesn't exist, create a new client with the specified session ID
            logger.info(`Creating new WhatsApp client with session ID ${sessionId}`);
            return await this.createNewClient(sessionId, phoneNumber, accountId, options);
        } catch (error) {
            logger.error(`Error restoring or creating WhatsApp client: ${error}`);
            throw error;
        }
    }
    
    /**
     * Get a client by ID
     * @param clientId Client ID
     * @returns WhatsApp client instance or undefined if not found
     */
    getClient(clientId: string): WhatsAppAccountClient | undefined {
        return this.clients.get(clientId);
    }
    
    /**
     * Get all clients
     * @returns Array of all client instances
     */
    getAllClients(): WhatsAppAccountClient[] {
        return Array.from(this.clients.values());
    }
    
    /**
     * Get client info by ID
     * @param clientId Client ID
     * @returns Client info or null if not found
     */
    getClientInfo(clientId: string): any | null {
        const client = this.getClient(clientId);
        return client ? client.getInfo() : null;
    }
    
    /**
     * Get all clients info
     * @returns Array of client info objects
     */
    getAllClientsInfo(): any[] {
        return this.getAllClients().map(client => client.getInfo());
    }
    
    /**
     * Disconnect a client
     * @param clientId Client ID
     * @returns True if successful, false otherwise
     */
    async disconnectClient(clientId: string): Promise<boolean> {
        const client = this.getClient(clientId);
        if (!client) {
            return false;
        }
        
        try {
            // Disconnect the client
            const success = await client.disconnect();
            
            // Remove from clients map if successful
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
     * Set up event listeners for a client
     * @param client The client to set up listeners for
     * @param clientId The client ID
     * @param accountId Optional account ID
     * @param qrCodeResolve Optional QR code resolve function
     */
    private setupClientEventListeners(client: WhatsAppAccountClient, clientId: string, accountId?: string, qrCodeResolve?: (value: string) => void) {
        // Set up QR code listener for the QR code promise resolution
        if (qrCodeResolve) {
            client.once('qr', (qrCode: string) => {
                qrCodeResolve(qrCode);
                // Initial QR code broadcast handled by the 'on' handler below
            });
        }
        
        // Always listen for QR code events and broadcast them
        // This ensures we catch all QR codes, not just the first one
        client.on('qr', (qrCode: string) => {
            logger.info(`Broadcasting QR code for client ${clientId} via WebSocket`);
            // Broadcast QR code to web UI
            wsManager.broadcast({
                type: 'whatsapp',
                action: 'qrCode',
                data: { 
                    clientId, 
                    qrCode,
                    accountId: accountId || null
                }
            });
        });
        
        // Set up state listener
        client.on('state', (state: WhatsAppClientState) => {
            // Update database status if needed
            if (accountId) {
                this.updateAccountStatus(accountId, state, clientId);
            }
            
            logger.debug(`Number of whatsappclients: ${this.clients.size}`)
            
            // Get client info including pushName and phoneNumber
            const pushName = client.getPushName();
            const phoneNumber = client.getPhoneNumber();
            
            logger.info(`Client state update for ${clientId}: state=${state}, pushName=${pushName}, phoneNumber=${phoneNumber}`);

            // Broadcast state update to web UI with additional info
            wsManager.broadcast({
                type: 'whatsapp_state',
                data: { 
                    clientId, 
                    state,
                    pushName,
                    phoneNumber
                }
            });
        });
        
        // Set up connected listener to ensure we capture user info
        client.on('connected', (userInfo: any) => {
            logger.info(`Client ${clientId} connected with user info:`, userInfo);
            
            // Broadcast an additional state update with the user info
            // This ensures the pushName and phoneNumber are always included
            wsManager.broadcast({
                type: 'whatsapp_state',
                data: { 
                    clientId, 
                    state: 'connected',
                    pushName: userInfo.name,
                    phoneNumber: userInfo.phoneNumber
                }
            });
        });
        
        // Set up logout listener
        client.on('logout', () => {
            // Update database status if needed
            if (accountId) {
                this.updateAccountStatus(accountId, 'disconnected');
            }
            
            // Broadcast logout to web UI
            wsManager.broadcast({
                type: 'whatsapp_logout',
                data: { clientId }
            });
        });
        
        // Forward message events to web UI
        client.on('message', (message: WhatsAppMessage) => {
            wsManager.broadcast({
                type: 'whatsapp_message',
                data: { clientId, message }
            });
        });
    }
    
    /**
     * Send a text message
     * @param clientId Client ID
     * @param to Recipient phone number or group ID
     * @param text Message text
     * @returns Message ID if successful, null otherwise
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
     * Generate a pairing code for phone number login
     * @param clientId Client ID
     * @returns Pairing code if successful, null otherwise
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
     * Update account status in database
     * This is a placeholder method - implement actual database updates as needed
     */
    private async updateAccountStatus(accountId: string, status: WhatsAppClientState, clientId?: string): Promise<void> {
        // This would typically update a database record
        // For now, just log the status change
        logger.info(`Account ${accountId} status updated to ${status}${clientId ? ` with client ID ${clientId}` : ''}`);
        
        // TODO: Implement actual database update
        // Example: await db.whatsappAccounts.update({ where: { id: accountId }, data: { status, clientId } });
    }
    
    /**
     * Initialize clients from database
     * Loads all WhatsApp accounts with active status and reconnects them
     */
    async initializeClientsFromDatabase(): Promise<void> {
        logger.info('Initializing WhatsApp clients from database');
        
        try {
            // Get the Prisma client
            const prisma = getEnhancedPrisma();
            
            // Find all WhatsApp accounts that were previously connected
            // const accounts = await prisma.whatsAppAccount.findMany({
            //     where: {
            //         client_status: {
            //             in: ['connected', 'authenticated']
            //         }
            //     }
            // });

            const accounts = await prisma.whatsAppAccount.findMany();
            
            logger.info(`Found ${accounts.length} WhatsApp accounts to initialize`);
            
            // Initialize each account
            for (const account of accounts) {
                try {
                    // Create a new client with the stored client_id
                    const client = new WhatsAppAccountClient(account.client_id);
                    
                    // Set the account ID for the client
                    await client.setAccountId(account.id);
                    
                    // Add the client to our clients map
                    this.clients.set(account.client_id, client);
                    
                    // Connect the client (this will attempt to reconnect)
                    await client.connect();
                    
                    logger.info(`Initialized WhatsApp client for account ${account.id} (${account.description})`);
                } catch (clientError) {
                    logger.error(`Failed to initialize WhatsApp client for account ${account.id}: ${clientError}`);
                    
                    // Update the account status to disconnected since initialization failed
                    await prisma.whatsAppAccount.update({
                        where: { id: account.id },
                        data: { client_status: 'disconnected' }
                    });
                }
            }
            
            logger.info(`Successfully initialized ${this.clients.size} WhatsApp clients`);
        } catch (error) {
            logger.error(`Error initializing clients from database: ${error}`);
        }
    }
}

// Create and export a singleton instance
export const whatsAppAccountManager = new WhatsAppAccountManager();
