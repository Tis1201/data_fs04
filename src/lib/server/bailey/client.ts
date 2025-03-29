import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, DEFAULT_CONNECTION_CONFIG } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { pino } from 'pino';

import { WebSocketServer } from './websocket';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

// Type definitions
export type WhatsAppClient = ReturnType<typeof makeWASocket>;
export type WhatsAppClientState = 'connecting' | 'connected' | 'authenticated' | 'disconnected';

interface WhatsAppClientManager {
    id: string;
    client: WhatsAppClient | null;
    state: WhatsAppClientState;
    qrCode: string | null;
    pairingCode: string | null;
    phoneNumber: string | null;
    socket: WebSocket | null;
    accountId: string | null;
}

// Store for all active WhatsApp client instances
const clients: Map<string, WhatsAppClientManager> = new Map();

// Ensure auth directory exists
const AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Initialize WhatsApp clients from database on server startup
 * This function should be called when the server starts
 * 
 * NOTE: According to Baileys documentation, useMultiFileAuthState is not recommended
 * for production use. Ideally, we should implement a custom auth state provider
 * that stores credentials in the database. For now, we're using the file system
 * but with improved handling.
 */
export async function initializeClientsFromDatabase(): Promise<void> {
    logger.info('INITIALIZING WHATSAPP CLIENTS FROM DATABASE');
    logger.info(`Auth directory path: ${AUTH_DIR}`);
    
    // Check if auth directory exists
    if (!fs.existsSync(AUTH_DIR)) {
        logger.warn('Auth directory does not exist, creating it...');
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    
    // List all directories in the auth folder
    const authDirs = fs.readdirSync(AUTH_DIR).filter(dir => 
        fs.statSync(path.join(AUTH_DIR, dir)).isDirectory() && !dir.startsWith('pending_')
    );
    logger.info(`Found ${authDirs.length} auth directories: ${authDirs.join(', ')}`);
    
    try {
        // Get prisma client with admin privileges
        const prisma = getEnhancedPrisma({
            id: 'system',
            systemRole: 'ADMIN'
        });
        
        // Get all WhatsApp accounts
        const accounts = await prisma.whatsAppAccount.findMany();
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
                await startClient(account.client_id, account.phoneNumber, account.id);
                logger.info(`Successfully restored client ${account.client_id}`);
                
                // Update the database status to connected after successful restoration
                try {
                    const prisma = getEnhancedPrisma({
                        id: 'system',
                        systemRole: 'ADMIN'
                    });
                    
                    await prisma.whatsAppAccount.update({
                        where: { id: account.id },
                        data: { client_status: 'connected' }
                    });
                    
                    logger.info(`Updated database status to connected for account ${account.id}`);
                } catch (dbError) {
                    logger.error(`Failed to update client status in database`, { error: dbError });
                }
            } catch (error) {
                logger.error(`Failed to restore client ${account.client_id}`, { error });
            }
        }
    } catch (error) {
        logger.error('Failed to initialize clients from database', { error });
    }
}

/**
 * Initialize a new WhatsApp client
 */
export async function initWhatsAppClient(phoneNumber: string, accountId: string, socket: WebSocket): Promise<string> {
    // Create a unique ID for this client instance
    const clientId = uuidv4();
    
    // Create client auth directory
    const clientAuthDir = path.join(AUTH_DIR, clientId);
    if (!fs.existsSync(clientAuthDir)) {
        fs.mkdirSync(clientAuthDir, { recursive: true });
    }
    
    // Store client metadata
    clients.set(clientId, {
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
    startClient(clientId).catch(error => {
        console.error(`Failed to start WhatsApp client ${clientId}:`, error);
        
        // Notify the client of the error
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'whatsapp',
                action: 'error',
                data: {
                    message: 'Failed to initialize WhatsApp client'
                }
            }));
        }
        
        // Clean up the client
        clients.delete(clientId);
    });
    
    return clientId;
}

/**
 * Start a WhatsApp client with the given ID
 * @param clientId The unique ID of the client to start
 * @param phoneNumber Optional phone number for the client
 * @param accountId Optional account ID associated with the client
 */
async function startClient(clientId: string, phoneNumber?: string, accountId?: string): Promise<void> {
    // Get client data from the map or create a new entry if it doesn't exist
    let clientData = clients.get(clientId);
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
            clients.set(clientId, clientData);
        } else {
            throw new Error(`Client ${clientId} not found`);
        }
    }
    
    // Get auth state for this client
    const clientAuthDir = path.join(AUTH_DIR, clientId);
    const { state, saveCreds } = await useMultiFileAuthState(clientAuthDir);
    
    // Fetch the latest version of Baileys
    const { version } = await fetchLatestBaileysVersion();
    
    // Configure custom logger to suppress QR codes
    const logger = pino({ level: 'warn' });
    
    // Create a new WhatsApp client
    const sock = makeWASocket({
        version,
        auth: state,
        logger, // Use custom logger with higher log level to suppress QR codes
        printQRInTerminal: false, // Don't print QR code in terminal
        browser: ['FS04 WhatsApp', 'Chrome', '1.0.0']
    });
    
    // Update client in the store
    clientData.client = sock;
    clients.set(clientId, clientData);
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async (messagesUpsert) => {
        console.log('New message received:', JSON.stringify(messagesUpsert, null, 2));
        
        // Get the latest client data
        const currentClientData = clients.get(clientId);
        if (!currentClientData) return;
        
        // Process only new messages
        if (messagesUpsert.type === 'notify') {
            for (const msg of messagesUpsert.messages) {
                // Skip messages sent by the current user
                if (msg.key.fromMe) continue;
                
                // Get message content
                const messageContent = msg.message?.conversation || 
                                      msg.message?.extendedTextMessage?.text || 
                                      msg.message?.imageMessage?.caption || 
                                      'Media message';
                
                // Get sender information
                const sender = msg.key.remoteJid?.split('@')[0] || 'Unknown';
                
                console.log(`Message from ${sender}: ${messageContent}`);
                
                // Broadcast message to all connected clients
                WebSocketServer.broadcast({
                    type: 'whatsapp',
                    action: 'message',
                    data: {
                        clientId,
                        accountId: currentClientData.accountId,
                        sender,
                        content: messageContent,
                        timestamp: new Date().toISOString(),
                        messageId: msg.key.id,
                        rawMessage: msg
                    }
                });
                
                // Send to specific client if connected
                if (currentClientData.socket && currentClientData.socket.readyState === WebSocket.OPEN) {
                    currentClientData.socket.send(JSON.stringify({
                        type: 'whatsapp',
                        action: 'message',
                        data: {
                            sender,
                            content: messageContent,
                            timestamp: new Date().toISOString(),
                            messageId: msg.key.id
                        }
                    }));
                }
            }
        }
    });
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
    // Handle connection events
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Get the latest client data
        const currentClientData = clients.get(clientId);
        if (!currentClientData) return;
        
        // Handle QR code updates
        if (qr) {
            // Store the QR code
            currentClientData.qrCode = qr;
            clients.set(clientId, currentClientData);
            
            // Send QR code to the client
            if (currentClientData.socket && currentClientData.socket.readyState === WebSocket.OPEN) {
                currentClientData.socket.send(JSON.stringify({
                    type: 'whatsapp',
                    action: 'qrCode',
                    data: {
                        qrCode: qr
                    }
                }));
            }
            
            // Prevent QR code from being logged to console
            // This is a workaround since some QR codes still appear even with printQRInTerminal: false
            console.log('QR code generated - check the web UI to scan it');
            // Suppress the actual QR code from being printed
            
            // Broadcast to all connected clients via WebSocketServer
            WebSocketServer.broadcast({
                type: 'whatsapp',
                action: 'qrCode',
                data: {
                    clientId,
                    accountId: currentClientData.accountId,
                    qrCode: qr
                }
            });
        }
        
        // Handle connection state changes
        if (connection) {
            let newState: WhatsAppClientState = 'disconnected';
            
            switch (connection) {
                case 'connecting':
                    newState = 'connecting';
                    // Update database status
                    if (currentClientData.accountId) {
                        try {
                            const prisma = getEnhancedPrisma({
                                id: 'system',
                                systemRole: 'ADMIN'
                            });
                            await prisma.whatsAppAccount.update({
                                where: { id: currentClientData.accountId },
                                data: { client_status: 'connecting' }
                            });
                        } catch (error) {
                            console.error('Failed to update client status:', error);
                        }
                    }
                    break;
                case 'open':
                    newState = 'authenticated';
                    // Update database status
                    if (currentClientData.accountId) {
                        try {
                            const prisma = getEnhancedPrisma({
                                id: 'system',
                                systemRole: 'ADMIN'
                            });
                            await prisma.whatsAppAccount.update({
                                where: { id: currentClientData.accountId },
                                data: { client_status: 'connected' }
                            });
                        } catch (error) {
                            console.error('Failed to update client status:', error);
                        }
                    }
                    
                    // Get phone number and other info after successful authentication
                    try {
                        // Get the connected user's information
                        const phoneNumber = sock.user?.id?.split(':')[0];
                        const pushName = sock.user?.name || 'Unknown';
                        
                        // Update client data with phone info
                        if (phoneNumber) {
                            currentClientData.phoneNumber = phoneNumber;
                            clients.set(clientId, currentClientData);
                            
                            // Store the client ID in the database for persistence
                            if (currentClientData.accountId) {
                                try {
                                    // Get prisma client with admin privileges
                                    const prisma = getEnhancedPrisma({
                                        id: 'system',
                                        rolesString: 'admin',
                                        systemRole: 'ADMIN'
                                    });
                                    
                                    // Store the user's name in the database
                                    if (pushName && pushName !== 'Unknown') {
                                        try {
                                            await prisma.whatsAppAccount.update({
                                                where: { id: currentClientData.accountId },
                                                data: { client_status: 'connected' }
                                            });
                                            console.log(`Updated WhatsApp account status to connected`);
                                            
                                            // Store the pushName in memory for now
                                            // We'll add proper database support for this field later
                                            console.log(`WhatsApp authenticated for ${phoneNumber} (${pushName})`);
                                        } catch (error) {
                                            console.error('Failed to update WhatsApp account:', error);
                                        }
                                    }
                                    
                                    // The client ID issue is that we need to find the correct directory in the auth folder
                                    // that corresponds to this WhatsApp account
                                    
                                    // Get all directories in the main auth folder
                                    const authDirContents = fs.readdirSync(AUTH_DIR);
                                    
                                    // Find the appropriate client ID for this account
                                    let actualClientId = null;
                                    
                                    // First check if there's a directory with this exact client ID
                                    if (authDirContents.includes(clientId)) {
                                        const clientIdPath = path.join(AUTH_DIR, clientId);
                                        if (fs.statSync(clientIdPath).isDirectory()) {
                                            // The client ID already exists as a directory, use it
                                            actualClientId = clientId;
                                            console.log(`Found exact client ID directory: ${clientId}`);
                                        }
                                    }
                                    
                                    // If we couldn't find the exact client ID, look for non-pending directories
                                    if (!actualClientId) {
                                        // Look for non-pending directories
                                        const nonPendingDirs = authDirContents
                                            .filter(item => {
                                                const itemPath = path.join(AUTH_DIR, item);
                                                return fs.statSync(itemPath).isDirectory() && !item.startsWith('pending_');
                                            });
                                            
                                        if (nonPendingDirs.length > 0) {
                                            // Use the first non-pending directory
                                            actualClientId = nonPendingDirs[0];
                                            console.log(`Using non-pending directory: ${actualClientId}`);
                                        } else {
                                            // If no non-pending directories found, check for any directory
                                            const allDirs = authDirContents
                                                .filter(item => {
                                                    const itemPath = path.join(AUTH_DIR, item);
                                                    return fs.statSync(itemPath).isDirectory();
                                                });
                                                
                                            if (allDirs.length > 0) {
                                                // Use the first directory found
                                                actualClientId = allDirs[0];
                                                console.log(`Using first available directory: ${actualClientId}`);
                                            }
                                        }
                                    }
                                    
                                    if (actualClientId) {
                                        // Check if the client ID has actually changed
                                        if (actualClientId !== clientId) {
                                            console.log(`Updating client ID from ${clientId} to ${actualClientId}`);
                                            
                                            // Update the WhatsApp account with the actual client ID
                                            await prisma.whatsAppAccount.update({
                                                where: { id: currentClientData.accountId },
                                                data: { client_id: actualClientId }
                                            });
                                            
                                            console.log(`Stored actual client ID ${actualClientId} for account ${currentClientData.accountId}`);
                                            
                                            // Update the client ID in memory
                                            // First, copy the client data
                                            const updatedClientData = {...currentClientData, id: actualClientId};
                                            
                                            // Remove the old client entry
                                            clients.delete(clientId);
                                            
                                            // Add the new client entry with the actual ID
                                            clients.set(actualClientId, updatedClientData);
                                            
                                            // Update the clientId variable for the rest of this function
                                            clientId = actualClientId;
                                            
                                            // Since we've changed the client ID, we need to restart the client
                                            // with the correct ID to ensure everything works properly
                                            console.log(`Restarting client with correct ID: ${actualClientId}`);
                                            
                                            // We'll return from this function and let the client be restarted
                                            // on the next request with the correct ID
                                            return { success: true, message: 'Client ID updated, please refresh to connect with correct ID' };
                                        } else {
                                            console.log(`Client ID ${clientId} is already correct, no update needed`);
                                        }
                                    } else {
                                        // If no directory found, use the original client ID
                                        await prisma.whatsAppAccount.update({
                                            where: { id: currentClientData.accountId },
                                            data: { client_id: clientId }
                                        });
                                        console.log(`No actual client ID found, using original: ${clientId}`);
                                    }
                                    
                                } catch (dbError) {
                                    console.error('Failed to store client ID in database:', dbError);
                                }
                            }
                            
                            // Send phone info to client
                            if (currentClientData.socket && currentClientData.socket.readyState === WebSocket.OPEN) {
                                currentClientData.socket.send(JSON.stringify({
                                    type: 'whatsapp',
                                    action: 'phoneInfo',
                                    data: {
                                        phoneNumber,
                                        pushName
                                    }
                                }));
                            }
                            
                            // Broadcast to all connected clients
                            WebSocketServer.broadcast({
                                type: 'whatsapp',
                                action: 'phoneInfo',
                                data: {
                                    clientId,
                                    accountId: currentClientData.accountId,
                                    phoneNumber,
                                    pushName
                                }
                            });
                            
                            console.log(`WhatsApp authenticated for ${phoneNumber} (${pushName})`);
                        }
                    } catch (error) {
                        console.error('Error getting phone information:', error);
                    }
                    break;
                case 'close':
                    newState = 'disconnected';
                    
                    // Update database status
                    if (currentClientData.accountId) {
                        try {
                            const prisma = getEnhancedPrisma({
                                id: 'system',
                                systemRole: 'ADMIN'
                            });
                            await prisma.whatsAppAccount.update({
                                where: { id: currentClientData.accountId },
                                data: { client_status: 'disconnected' }
                            });
                        } catch (error) {
                            console.error('Failed to update client status:', error);
                        }
                    }
                    
                    // Check if we need to reconnect
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    if (shouldReconnect) {
                        // Attempt to reconnect
                        console.log(`Reconnecting WhatsApp client ${clientId}...`);
                        await startClient(clientId);
                    } else {
                        // Clean up the client
                        console.log(`WhatsApp client ${clientId} logged out`);
                        clients.delete(clientId);
                    }
                    break;
            }
            
            // Update client state
            currentClientData.state = newState;
            clients.set(clientId, currentClientData);
            
            // Notify the client of the state change
            if (currentClientData.socket && currentClientData.socket.readyState === WebSocket.OPEN) {
                currentClientData.socket.send(JSON.stringify({
                    type: 'whatsapp',
                    action: 'connectionStatus',
                    data: {
                        status: newState
                    }
                }));
            }
            
            // Broadcast to all connected clients via WebSocketServer
            WebSocketServer.broadcast({
                type: 'whatsapp',
                action: 'connectionStatus',
                data: {
                    clientId,
                    accountId: currentClientData.accountId,
                    status: newState
                }
            });
        }
    });
    
    // Handle credential updates
    sock.ev.on('creds.update', saveCreds);
}

/**
 * Get a WhatsApp client by ID
 */
export function getWhatsAppClient(clientId: string): WhatsAppClientManager | undefined {
    return clients.get(clientId);
}

/**
 * Send a WhatsApp message
 */
export async function sendWhatsAppMessage(clientId: string, to: string, message: string): Promise<boolean> {
    const clientData = clients.get(clientId);
    if (!clientData || !clientData.client) {
        console.error(`Cannot send message: Client ${clientId} not found or not initialized`);
        return false;
    }
    
    try {
        // Format the recipient number
        const recipient = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        
        // Send the message
        await clientData.client.sendMessage(recipient, { text: message });
        
        console.log(`Message sent to ${to}: ${message}`);
        return true;
    } catch (error) {
        console.error(`Failed to send WhatsApp message to ${to}:`, error);
        return false;
    }
}

/**
 * Get all WhatsApp clients
 */
export function getAllWhatsAppClients(): Map<string, WhatsAppClientManager> {
    return clients;
}

/**
 * Disconnect a WhatsApp client
 */
export function disconnectWhatsAppClient(clientId: string): boolean {
    const clientData = clients.get(clientId);
    if (!clientData) {
        return false;
    }
    
    // Disconnect the client
    if (clientData.client) {
        clientData.client.end();
    }
    
    // Remove the client from the store
    clients.delete(clientId);
    
    return true;
}

/**
 * Generate a pairing code for a WhatsApp client
 */
export async function generatePairingCode(clientId: string, phoneNumber: string): Promise<string | null> {
    const clientData = clients.get(clientId);
    if (!clientData || !clientData.client) {
        return null;
    }
    
    try {
        // Request pairing code from WhatsApp
        const pairingCode = await clientData.client.requestPairingCode(phoneNumber);
        
        // Store the pairing code
        clientData.pairingCode = pairingCode;
        clients.set(clientId, clientData);
        
        // Send pairing code to the client
        if (clientData.socket && clientData.socket.readyState === WebSocket.OPEN) {
            clientData.socket.send(JSON.stringify({
                type: 'whatsapp',
                action: 'pairingCode',
                data: {
                    code: pairingCode
                }
            }));
        }
        
        return pairingCode;
    } catch (error) {
        console.error(`Failed to generate pairing code for client ${clientId}:`, error);
        return null;
    }
}
