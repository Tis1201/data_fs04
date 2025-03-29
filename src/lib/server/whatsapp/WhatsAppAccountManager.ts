import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';
import { WhatsAppAccountClient } from './WhatsAppAccountClient';
import type { WhatsAppClientState } from './WhatsAppAccountClient';
import type { WhatsAppMessage } from './WhatsAppAccountClient';
import EventEmitter from 'events';

/**
 * WhatsApp Account Manager
 * Manages multiple WhatsApp account clients
 */
export class WhatsAppAccountManager extends EventEmitter {
    // Store for all WhatsApp clients
    private clients = new Map<string, WhatsAppAccountClient>();
    
    constructor() {
        super();
        logger.info('WhatsApp Account Manager initialized');
    }
    
    /**
     * Create a new WhatsApp client
     * @param phoneNumber Optional phone number
     * @param accountId Optional account ID for database reference
     * @returns Client ID and QR code promise
     */
    async createClient(phoneNumber?: string, accountId?: string): Promise<{ clientId: string, qrCodePromise: Promise<string> }> {
        try {
            // Create a unique ID for this client instance
            const clientId = uuidv4();
            logger.info(`Creating new WhatsApp client with ID ${clientId}`);
            
            // Create a promise to get the QR code
            let qrCodeResolve: (value: string) => void;
            const qrCodePromise = new Promise<string>((resolve) => {
                qrCodeResolve = resolve;
            });
            
            // Create a new client instance
            const client = new WhatsAppAccountClient(clientId, phoneNumber, accountId);
            
            // Store the client
            this.clients.set(clientId, client);
            
            // Set up minimal event listeners for internal management
            client.on('qr', (qrCode: string) => {
                qrCodeResolve(qrCode);
                // Still emit on manager for backward compatibility
                this.emit('qr', clientId, qrCode);
            });
            
            client.on('state', (state: WhatsAppClientState) => {
                // Update database status if needed
                if (accountId) {
                    this.updateAccountStatus(accountId, state, clientId);
                }
                // Still emit on manager for backward compatibility
                this.emit('state', clientId, state);
            });
            
            client.on('logout', () => {
                // Update database status if needed
                if (accountId) {
                    this.updateAccountStatus(accountId, 'disconnected');
                }
                // Still emit on manager for backward compatibility
                this.emit('logout', clientId);
            });
            
            // Forward other events for backward compatibility
            client.on('connected', (info: any) => this.emit('connected', clientId, info));
            client.on('message', (message: WhatsAppMessage) => this.emit('message', clientId, message));
            client.on('error', (error: any) => this.emit('error', clientId, error));
            
            // Connect the client
            await client.connect();
            
            return { clientId, qrCodePromise };
        } catch (error) {
            logger.error(`Error creating WhatsApp client: ${error}`);
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
     * This is a placeholder method - implement actual database loading as needed
     */
    async initializeClientsFromDatabase(): Promise<void> {
        logger.info('Initializing WhatsApp clients from database');
        
        try {
            // TODO: Implement actual database query
            // Example: const accounts = await db.whatsappAccounts.findMany({ where: { status: 'connected' } });
            
            // For now, just log that no clients were loaded
            logger.info('No clients loaded from database (not implemented)');
        } catch (error) {
            logger.error(`Error initializing clients from database: ${error}`);
        }
    }
}

// Create and export a singleton instance
export const whatsAppAccountManager = new WhatsAppAccountManager();
