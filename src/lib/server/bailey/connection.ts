import baileys from '@whiskeysockets/baileys';
const { makeWASocket, fetchLatestBaileysVersion } = baileys;
import { pino } from 'pino';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { getClient, setClient, removeClient } from './store';
import { getAuthState } from './utils/auth';
import { handleConnectionUpdate } from './handlers/connection';
import { handleIncomingMessages } from './handlers/messages';
import { handleAuthentication } from './handlers/auth';
import { sendError } from './utils/websocket';
import { logger } from '$lib/server/logger';

/**
 * Start a WhatsApp client with the given ID
 * @param clientId The unique ID of the client to start
 * @param phoneNumber Optional phone number for the client
 * @param accountId Optional account ID associated with the client
 */
export async function startClient(clientId: string, phoneNumber?: string, accountId?: string): Promise<void> {
    // Get client data from the map or create a new entry if it doesn't exist
    let clientData = getClient(clientId);
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
            setClient(clientId, clientData);
        } else {
            throw new Error(`Client ${clientId} not found and insufficient information to create it`);
        }
    }
    
    try {
        // Get auth state for this client
        const { state, saveCreds } = await getAuthState(clientId);
        
        // Fetch the latest version of Baileys
        const { version } = await fetchLatestBaileysVersion();
        
        // Configure custom logger to suppress QR codes
        const baileysLogger = pino({ level: 'warn' });
        
        // Create a new WhatsApp client
        const sock = makeWASocket({
            version,
            auth: state,
            logger: baileysLogger, // Use custom logger with higher log level to suppress QR codes
            printQRInTerminal: true, // Print QR code in terminal for debugging
            generateHighQualityLinkPreview: false, // Disable link preview for better performance
            browser: ['FS04 WhatsApp', 'Chrome', '1.0.0'],
            // Make sure we're using the latest connection options
            markOnlineOnConnect: true,
            // Ensure QR code is generated
            qrTimeout: 60000 // 60 seconds timeout for QR code
        });
        
        // Update client in the store
        setClient(clientId, { ...clientData, client: sock });
        
        // Handle incoming messages
        sock.ev.on('messages.upsert', (messagesUpsert) => {
            handleIncomingMessages(messagesUpsert, clientId);
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        // Handle connection events
        sock.ev.on('connection.update', (update) => {
            handleConnectionUpdate(update, clientId);
            
            // If connection is open, handle authentication
            if (update.connection === 'open') {
                handleAuthentication(clientId, sock);
            }
        });
        
        logger.info(`Started WhatsApp client ${clientId}`);
        return;
    } catch (error) {
        logger.error(`Failed to start WhatsApp client ${clientId}`, { error });
        throw error;
    }
}

/**
 * Initialize a new WhatsApp client
 */
export async function initWhatsAppClient(phoneNumber: string, accountId: string, socket: WebSocket): Promise<string> {
    // Create a unique ID for this client instance
    const clientId = uuidv4();
    
    // Store client metadata
    setClient(clientId, {
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
        logger.error(`Failed to start WhatsApp client ${clientId}:`, error);
        
        // Notify the client of the error
        sendError(socket, 'Failed to initialize WhatsApp client');
        
        // Clean up the client
        removeClient(clientId);
    });
    
    return clientId;
}

/**
 * Disconnect a WhatsApp client
 */
export function disconnectWhatsAppClient(clientId: string): boolean {
    const clientData = getClient(clientId);
    if (!clientData) {
        return false;
    }
    
    // Disconnect the client
    if (clientData.client) {
        clientData.client.end();
    }
    
    // Remove the client from the store
    removeClient(clientId);
    
    logger.info(`Disconnected WhatsApp client ${clientId}`);
    return true;
}
