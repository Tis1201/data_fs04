// WhatsApp Manager - A robust class-based implementation for managing WhatsApp clients

import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import baileys from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { pino } from 'pino';
import { logger } from '$lib/server/logger';
import { updateAccountStatus, getAllWhatsAppAccounts } from './utils/database';
import { sendQrCode, sendConnectionStatus, sendError, sendPhoneInfo } from './utils/websocket';

const { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason } = baileys;

// Define the auth directory
export const AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Define client state type
export type WhatsAppClientState = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

// Define client data structure
export interface WhatsAppClient {
    id: string;
    client: any; // Baileys socket
    state: WhatsAppClientState;
    qrCode: string | null;
    pairingCode: string | null;
    phoneNumber: string;
    socket: WebSocket | null;
    accountId: string;
    pushName?: string;
}

/**
 * WhatsApp Manager class to handle client creation and events
 */
class WhatsAppManager {
    // Store for all WhatsApp clients
    private clients = new Map<string, WhatsAppClient>();
    
    /**
     * Initialize WhatsApp clients from database on server startup
     * This function should be called when the server starts
     */
    async initializeClientsFromDatabase(): Promise<void> {
        logger.info('INITIALIZING WHATSAPP CLIENTS FROM DATABASE');
        logger.info(`Auth directory path: ${AUTH_DIR}`);
        
        try {
            // Check if auth directory exists
            if (!fs.existsSync(AUTH_DIR)) {
                logger.warn('Auth directory does not exist, creating it...');
                fs.mkdirSync(AUTH_DIR, { recursive: true });
            }
            
            // List all directories in the auth folder
            const authDirs = this.getAllAuthDirectories();
            logger.info(`Found ${authDirs.length} auth directories: ${authDirs.join(', ')}`);
            
            // Get all WhatsApp accounts from database
            const accounts = await getAllWhatsAppAccounts();
            logger.info(`Found ${accounts.length} total WhatsApp accounts in database`);
            
            // Filter accounts with valid client IDs (non-pending)
            const validAccounts = accounts.filter(account => 
                account.client_id && 
                !account.client_id.startsWith('pending_')
            );
            
            logger.info(`Found ${validAccounts.length} WhatsApp accounts with valid client IDs to restore`);
            
            // Check for accounts with pending IDs
            const pendingAccounts = accounts.filter(account => 
                account.client_id && 
                account.client_id.startsWith('pending_')
            );
            logger.info(`Found ${pendingAccounts.length} WhatsApp accounts with pending client IDs (will be skipped)`);
            
            // Check for auth directories without matching accounts
            const orphanedDirs = authDirs.filter(dir => 
                !validAccounts.some(account => account.client_id === dir)
            );
            if (orphanedDirs.length > 0) {
                logger.warn(`Found ${orphanedDirs.length} auth directories without matching accounts: ${orphanedDirs.join(', ')}`);
            }
            
            // Initialize each client
            for (const account of validAccounts) {
                if (!account.client_id) continue;
                
                // Create the auth directory for this client if it doesn't exist
                const clientAuthDir = path.join(AUTH_DIR, account.client_id);
                if (!fs.existsSync(clientAuthDir)) {
                    logger.warn(`Auth directory for client ${account.client_id} not found, skipping`);
                    continue;
                }
                
                // Check auth directory contents
                const authFiles = fs.readdirSync(clientAuthDir);
                logger.debug(`Auth directory for client ${account.client_id} contains ${authFiles.length} files/directories`);
                
                logger.info(`Restoring WhatsApp client for account ${account.id} with client ID ${account.client_id}`);
                
                // Initialize the client
                try {
                    await this.startClient(account.client_id, account.phoneNumber, account.id);
                    logger.info(`Successfully restored client ${account.client_id}`);
                } catch (error) {
                    logger.error(`Failed to restore client ${account.client_id}`, { error });
                }
            }
        } catch (error) {
            logger.error('Failed to initialize clients from database', { error });
        }
    }
    
    /**
     * Get all auth directories
     */
    private getAllAuthDirectories(): string[] {
        try {
            // Check if auth directory exists
            if (!fs.existsSync(AUTH_DIR)) {
                return [];
            }
            
            // List all directories in the auth folder
            return fs.readdirSync(AUTH_DIR, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            logger.error('Failed to get auth directories', { error });
            return [];
        }
    }
    
    /**
     * Start a WhatsApp client with the given ID
     */
    async startClient(clientId: string, phoneNumber?: string, accountId?: string): Promise<void> {
        // Get client data from the map or create a new entry if it doesn't exist
        let clientData = this.getClient(clientId);
        if (!clientData) {
            // If client doesn't exist in memory but we have phoneNumber and accountId, create it
            if (phoneNumber && accountId) {
                clientData = {
                    id: clientId,
                    client: null,
                    state: 'connecting',
                    qrCode: null,
                    pairingCode: null,
                    phoneNumber,
                    socket: null,
                    accountId
                };
                this.setClient(clientId, clientData);
            } else {
                throw new Error(`Client ${clientId} not found and insufficient information to create it`);
            }
        }
        
        try {
            // Get auth state for this client
            const clientAuthDir = path.join(AUTH_DIR, clientId);
            if (!fs.existsSync(clientAuthDir)) {
                fs.mkdirSync(clientAuthDir, { recursive: true });
            }
            
            const { state, saveCreds } = await useMultiFileAuthState(clientAuthDir);
            
            // Fetch the latest version of Baileys
            const { version } = await fetchLatestBaileysVersion();
            
            // Configure custom logger to suppress QR codes
            const baileysLogger = pino({ level: 'warn' });
            
            // Create a new WhatsApp client
            const sock = makeWASocket({
                version,
                auth: state,
                logger: baileysLogger,
                printQRInTerminal: true, // Print QR code in terminal for debugging
                browser: ['FS04 WhatsApp', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: false,
                markOnlineOnConnect: true,
                // Ensure QR code is generated
                qrTimeout: 60000 // 60 seconds timeout for QR code
            });
            
            // Update client in the store
            this.setClient(clientId, { ...clientData, client: sock });
            
            // Handle incoming messages
            sock.ev.on('messages.upsert', (messagesUpsert) => {
                this.handleIncomingMessages(messagesUpsert, clientId);
            });
            
            // Save credentials when updated
            sock.ev.on('creds.update', saveCreds);
            
            // Handle connection events
            sock.ev.on('connection.update', (update) => {
                this.handleConnectionUpdate(update, clientId);
            });
            
            logger.info(`Started WhatsApp client ${clientId}`);
            return;
        } catch (error) {
            logger.error(`Failed to start WhatsApp client ${clientId}`, { error });
            throw error;
        }
    }
    
    /**
     * Handle WhatsApp connection updates
     */
    private handleConnectionUpdate(update: any, clientId: string): void {
        const { connection, lastDisconnect, qr } = update;
        
        // Get the latest client data
        const clientData = this.getClient(clientId);
        if (!clientData) {
            logger.warn(`Connection update for unknown client ${clientId}`);
            return;
        }
        
        logger.debug(`Connection update for client ${clientId}: ${JSON.stringify(update)}`);
        
        // Handle QR code updates
        if (qr) {
            // Store the QR code
            this.updateClient(clientId, { qrCode: qr, state: 'connecting' });
            
            // Log QR code for debugging (first 20 chars)
            logger.info(`QR code generated for client ${clientId}: ${qr.substring(0, 20)}...`);
            
            // Send QR code to clients
            if (clientData.socket) {
                sendQrCode(clientData.socket, clientId, clientData.accountId, qr);
                logger.info(`QR code sent to WebSocket for client ${clientId}`);
            } else {
                logger.warn(`No WebSocket available to send QR code for client ${clientId}`);
            }
        }
        
        // Handle connection state changes
        if (connection) {
            let newState = clientData.state;
            
            switch (connection) {
                case 'connecting':
                    newState = 'connecting';
                    // Update database status
                    if (clientData.accountId) {
                        updateAccountStatus(clientData.accountId, 'connecting');
                    }
                    break;
                    
                case 'open':
                    newState = 'connected';
                    logger.info(`Client ${clientId} connected successfully`);
                    
                    // Update database status
                    if (clientData.accountId) {
                        updateAccountStatus(clientData.accountId, 'connected', clientId);
                    }
                    
                    // Get phone info
                    if (clientData.client) {
                        const phoneInfo = clientData.client.user || {};
                        if (phoneInfo.id) {
                            const phoneNumber = phoneInfo.id.split(':')[0];
                            const pushName = phoneInfo.name || 'Unknown';
                            
                            // Update client data
                            this.updateClient(clientId, { 
                                phoneNumber, 
                                pushName,
                                state: 'authenticated' 
                            });
                            
                            // Send phone info to WebSocket
                            if (clientData.socket) {
                                sendPhoneInfo(clientData.socket, clientId, clientData.accountId, phoneNumber, pushName);
                            }
                            
                            // Update database status to authenticated
                            if (clientData.accountId) {
                                updateAccountStatus(clientData.accountId, 'authenticated', clientId);
                            }
                        }
                    }
                    
                    // Send connection status to WebSocket
                    if (clientData.socket) {
                        sendConnectionStatus(clientData.socket, clientId, clientData.accountId, 'connected');
                    }
                    break;
                    
                case 'close':
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    
                    // Check if we need to reconnect
                    if (statusCode === DisconnectReason.restartRequired) {
                        logger.info(`Client ${clientId} needs restart, reconnecting...`);
                        // We'll let the client reconnect automatically
                    } else if (statusCode === DisconnectReason.loggedOut) {
                        logger.info(`Client ${clientId} logged out`);
                        newState = 'disconnected';
                        
                        // Update database status
                        if (clientData.accountId) {
                            updateAccountStatus(clientData.accountId, 'disconnected');
                        }
                        
                        // Send connection status to WebSocket
                        if (clientData.socket) {
                            sendConnectionStatus(clientData.socket, clientId, clientData.accountId, 'disconnected');
                            sendError(clientData.socket, 'WhatsApp session logged out');
                        }
                    } else {
                        logger.warn(`Client ${clientId} disconnected with status code ${statusCode}`);
                        newState = 'disconnected';
                        
                        // Update database status
                        if (clientData.accountId) {
                            updateAccountStatus(clientData.accountId, 'disconnected');
                        }
                        
                        // Send connection status to WebSocket
                        if (clientData.socket) {
                            sendConnectionStatus(clientData.socket, clientId, clientData.accountId, 'disconnected');
                            sendError(clientData.socket, `Connection closed (${statusCode})`);
                        }
                    }
                    break;
            }
            
            // Update client state
            this.updateClient(clientId, { state: newState });
        }
    }
    
    /**
     * Handle incoming messages
     */
    private handleIncomingMessages(messagesUpsert: any, clientId: string): void {
        logger.debug(`New message received for client ${clientId}`);
        // Handle messages as needed
    }
    
    /**
     * Create a new WhatsApp client
     */
    async createClient(phoneNumber: string, accountId: string, socket: WebSocket): Promise<string> {
        // Create a unique ID for this client instance
        const clientId = uuidv4();
        
        // Store client metadata
        this.setClient(clientId, {
            id: clientId,
            client: null,
            state: 'connecting',
            qrCode: null,
            pairingCode: null,
            phoneNumber,
            socket,
            accountId
        });
        
        // Initialize the client in the background
        this.startClient(clientId, phoneNumber, accountId).catch(error => {
            logger.error(`Failed to start WhatsApp client ${clientId}:`, error);
            
            // Notify the client of the error
            if (socket) {
                sendError(socket, 'Failed to initialize WhatsApp client');
            }
            
            // Clean up the client
            this.removeClient(clientId);
        });
        
        return clientId;
    }
    
    /**
     * Generate a pairing code for a client
     */
    async generatePairingCode(clientId: string, phoneNumber: string): Promise<string | null> {
        const clientData = this.getClient(clientId);
        if (!clientData || !clientData.client) {
            logger.error(`Cannot generate pairing code: Client ${clientId} not found or not initialized`);
            return null;
        }
        
        try {
            // Request pairing code from WhatsApp
            const code = await clientData.client.requestPairingCode(phoneNumber);
            logger.info(`Generated pairing code for client ${clientId}: ${code}`);
            
            // Update client data
            this.updateClient(clientId, { pairingCode: code });
            
            return code;
        } catch (error) {
            logger.error(`Failed to generate pairing code for client ${clientId}:`, error);
            return null;
        }
    }
    
    /**
     * Send a WhatsApp message
     */
    async sendMessage(clientId: string, to: string, message: string): Promise<boolean> {
        const clientData = this.getClient(clientId);
        if (!clientData || !clientData.client) {
            logger.error(`Cannot send message: Client ${clientId} not found or not initialized`);
            return false;
        }
        
        try {
            // Format the destination number
            const formattedNumber = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
            
            // Send the message
            await clientData.client.sendMessage(formattedNumber, { text: message });
            logger.info(`Message sent to ${formattedNumber} from client ${clientId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send message from client ${clientId} to ${to}:`, error);
            return false;
        }
    }
    
    /**
     * Disconnect a WhatsApp client
     */
    disconnectClient(clientId: string): boolean {
        const clientData = this.getClient(clientId);
        if (!clientData) {
            return false;
        }
        
        // Disconnect the client
        if (clientData.client) {
            clientData.client.end();
        }
        
        // Remove the client from the store
        this.removeClient(clientId);
        
        logger.info(`Disconnected WhatsApp client ${clientId}`);
        return true;
    }
    
    /**
     * Get a client by ID
     */
    getClient(clientId: string): WhatsAppClient | undefined {
        return this.clients.get(clientId);
    }
    
    /**
     * Set client data
     */
    setClient(clientId: string, data: WhatsAppClient): void {
        this.clients.set(clientId, data);
    }
    
    /**
     * Update client data
     */
    updateClient(clientId: string, data: Partial<WhatsAppClient>): void {
        const clientData = this.getClient(clientId);
        if (clientData) {
            this.setClient(clientId, { ...clientData, ...data });
        }
    }
    
    /**
     * Remove a client
     */
    removeClient(clientId: string): void {
        this.clients.delete(clientId);
    }
    
    /**
     * Get all clients
     */
    getAllClients(): Map<string, WhatsAppClient> {
        return this.clients;
    }
}

// Create and export a singleton instance
export const whatsAppManager = new WhatsAppManager();

// Export functions for ease of use to maintain backward compatibility
export const initializeClientsFromDatabase = () => 
    whatsAppManager.initializeClientsFromDatabase();

export const initWhatsAppClient = (phoneNumber: string, accountId: string, socket: WebSocket) => 
    whatsAppManager.createClient(phoneNumber, accountId, socket);

export const generateWhatsAppPairingCode = (clientId: string, phoneNumber: string) => 
    whatsAppManager.generatePairingCode(clientId, phoneNumber);

export const getWhatsAppClient = (clientId: string) => 
    whatsAppManager.getClient(clientId);

export const getAllWhatsAppClients = () => 
    whatsAppManager.getAllClients();

export const disconnectClient = (clientId: string) => 
    whatsAppManager.disconnectClient(clientId);

export const sendMessage = async (clientId: string, to: string, message: string) => 
    whatsAppManager.sendMessage(clientId, to, message);
