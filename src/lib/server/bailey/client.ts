import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, DEFAULT_CONNECTION_CONFIG } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { pino } from 'pino';

import { WebSocketServer } from './websocket';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

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
 */
async function startClient(clientId: string): Promise<void> {
    const clientData = clients.get(clientId);
    if (!clientData) {
        throw new Error(`Client ${clientId} not found`);
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
                    break;
                case 'open':
                    newState = 'authenticated';
                    
                    // Get phone number and other info after successful authentication
                    try {
                        // Get the connected user's information
                        const phoneNumber = sock.user?.id?.split(':')[0];
                        const pushName = sock.user?.name || 'Unknown';
                        
                        // Update client data with phone info
                        if (phoneNumber) {
                            currentClientData.phoneNumber = phoneNumber;
                            clients.set(clientId, currentClientData);
                            
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
