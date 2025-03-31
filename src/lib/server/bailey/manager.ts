import { logger } from '$lib/server/logger';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import baileys from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { pino } from 'pino';
import { updateAccountStatus } from './utils/database';
import { sendQrCode, sendConnectionStatus, sendError } from './utils/websocket';

const { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason } = baileys;

// Define the auth directory
export const AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Define client data structure
export interface WhatsAppClient {
    id: string;
    client: any; // Baileys socket
    state: 'disconnected' | 'connecting' | 'connected' | 'authenticated';
    qrCode: string | null;
    pairingCode: string | null;
    phoneNumber: string;
    socket: WebSocket | null;
    accountId: string;
}

// Store for all WhatsApp clients
const clients = new Map<string, WhatsAppClient>();

/**
 * WhatsApp Manager class to handle client creation and events
 */
class WhatsAppManager {
    /**
     * Create a new WhatsApp client and handle QR code generation
     */
    async createClient(phoneNumber: string, accountId: string, socket: WebSocket): Promise<string> {
        try {
            // Create a unique ID for this client instance
            const clientId = uuidv4();
            logger.info(`Creating new WhatsApp client with ID ${clientId} for account ${accountId}`);
            
            // Create client auth directory
            const clientAuthDir = path.join(AUTH_DIR, clientId);
            if (!fs.existsSync(clientAuthDir)) {
                fs.mkdirSync(clientAuthDir, { recursive: true });
            }
            
            // Get auth state for this client
            const { state, saveCreds } = await useMultiFileAuthState(clientAuthDir);
            
            // Fetch the latest version of Baileys
            const { version } = await fetchLatestBaileysVersion();
            
            // Configure custom logger to suppress QR codes in console
            const baileysLogger = pino({ level: 'warn' });
            
            // Store initial client metadata
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
            
            // Create a new WhatsApp client with QR code generation options
            const sock = makeWASocket({
                version,
                auth: state,
                logger: baileysLogger,
                printQRInTerminal: true, // Print QR code in terminal for debugging
                browser: ['FS04 WhatsApp', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: false,
                markOnlineOnConnect: true
            });
            
            // Update client in the store with the socket
            this.setClient(clientId, { 
                id: clientId,
                client: sock,
                state: 'connecting',
                qrCode: null,
                pairingCode: null,
                phoneNumber,
                socket,
                accountId
            });
            
            // Save credentials when updated
            sock.ev.on('creds.update', saveCreds);
            
            // Handle connection events
            sock.ev.on('connection.update', (update: any) => {
                const { connection, lastDisconnect, qr } = update;
                
                logger.debug(`Connection update for client ${clientId}: ${JSON.stringify(update)}`);
                
                // Handle QR code updates
                if (qr) {
                    // Store the QR code
                    const clientData = this.getClient(clientId);
                    if (clientData) {
                        this.setClient(clientId, { 
                            ...clientData,
                            qrCode: qr,
                            state: 'connecting'
                        });
                        
                        // Log QR code for debugging (first 20 chars)
                        logger.info(`QR code generated for client ${clientId}: ${qr.substring(0, 20)}...`);
                        
                        // Send QR code to WebSocket
                        if (socket) {
                            sendQrCode(socket, clientId, accountId, qr);
                            logger.info(`QR code sent to WebSocket for client ${clientId}`);
                        } else {
                            logger.warn(`No WebSocket available to send QR code for client ${clientId}`);
                        }
                    }
                }
                
                // Handle connection state changes
                if (connection) {
                    const clientData = this.getClient(clientId);
                    if (!clientData) return;
                    
                    let newState = clientData.state;
                    
                    switch (connection) {
                        case 'connecting':
                            newState = 'connecting';
                            // Update database status
                            if (accountId) {
                                updateAccountStatus(accountId, 'connecting');
                            }
                            break;
                            
                        case 'open':
                            newState = 'connected';
                            logger.info(`Client ${clientId} connected successfully`);
                            
                            // Update database status
                            if (accountId) {
                                updateAccountStatus(accountId, 'connected', clientId);
                            }
                            
                            // Send connection status to WebSocket
                            if (socket) {
                                sendConnectionStatus(socket, clientId, accountId, 'connected');
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
                                if (accountId) {
                                    updateAccountStatus(accountId, 'disconnected');
                                }
                                
                                // Send connection status to WebSocket
                                if (socket) {
                                    sendConnectionStatus(socket, clientId, accountId, 'disconnected');
                                    sendError(socket, 'WhatsApp session logged out');
                                }
                            } else {
                                logger.warn(`Client ${clientId} disconnected with status code ${statusCode}`);
                                newState = 'disconnected';
                                
                                // Update database status
                                if (accountId) {
                                    updateAccountStatus(accountId, 'disconnected');
                                }
                                
                                // Send connection status to WebSocket
                                if (socket) {
                                    sendConnectionStatus(socket, clientId, accountId, 'disconnected');
                                    sendError(socket, `Connection closed (${statusCode})`);
                                }
                            }
                            break;
                    }
                    
                    // Update client state
                    this.setClient(clientId, { ...clientData, state: newState });
                }
            });
            
            // Handle incoming messages
            sock.ev.on('messages.upsert', (messagesUpsert: any) => {
                logger.debug(`New message received for client ${clientId}`);
                // Handle messages as needed
            });
            
            // Return the client ID
            return clientId;
        } catch (error) {
            logger.error('Error creating WhatsApp client:', error);
            throw error;
        }
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
            this.setClient(clientId, { ...clientData, pairingCode: code });
            
            return code;
        } catch (error) {
            logger.error(`Failed to generate pairing code for client ${clientId}:`, error);
            return null;
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
        return clients.get(clientId);
    }
    
    /**
     * Set client data
     */
    setClient(clientId: string, data: WhatsAppClient): void {
        clients.set(clientId, data);
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
        clients.delete(clientId);
    }
    
    /**
     * Get all clients
     */
    getAllClients(): Map<string, WhatsAppClient> {
        return clients;
    }
}

// Create and export a singleton instance
export const whatsAppManager = new WhatsAppManager();

// Export functions for ease of use
export const createWhatsAppClient = (phoneNumber: string, accountId: string, socket: WebSocket) => 
    whatsAppManager.createClient(phoneNumber, accountId, socket);

export const generatePairingCode = (clientId: string, phoneNumber: string) => 
    whatsAppManager.generatePairingCode(clientId, phoneNumber);

export const disconnectWhatsAppClient = (clientId: string) => 
    whatsAppManager.disconnectClient(clientId);

export const getWhatsAppClient = (clientId: string) => 
    whatsAppManager.getClient(clientId);

export const getAllWhatsAppClients = () => 
    whatsAppManager.getAllClients();
