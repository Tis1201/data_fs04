import fs from 'fs';
import path from 'path';
import baileys from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { pino } from 'pino';
import { logger } from '$lib/server/logger';
import EventEmitter from 'events';

const { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason } = baileys;

// Define the auth directory
export const AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Define client state type
export type WhatsAppClientState = 'disconnected' | 'connecting' | 'connected' | 'authenticated';
export { WhatsAppClientState };

// Define message types
export interface WhatsAppMessage {
    id: string;
    from: string;
    to: string;
    content: string;
    timestamp: number;
    isFromMe: boolean;
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'unknown';
    // Additional fields for specific message types
    mediaUrl?: string;
    caption?: string;
    fileName?: string;
    fileSize?: number;
    mimetype?: string;
}

/**
 * WhatsApp Account Client class
 * Represents a single WhatsApp account connection
 */
export class WhatsAppAccountClient extends EventEmitter {
    // Client properties
    private id: string;
    private socket: any; // Baileys socket
    private state: WhatsAppClientState = 'disconnected';
    private qrCode: string | null = null;
    private qrCodeTimestamp: number = 0;
    private qrCodeRefreshTimer: NodeJS.Timeout | null = null;
    private phoneNumber?: string;
    private accountId?: string;
    private authDir: string;
    private pushName?: string;
    private autoReconnect: boolean = true;
    private reconnectCount: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 3000; // 3 seconds
    
    /**
     * Create a new WhatsApp Account Client
     * @param id Unique client ID
     * @param phoneNumber Optional phone number
     * @param accountId Optional account ID for database reference
     */
    constructor(id: string, phoneNumber?: string, accountId?: string) {
        super();
        this.id = id;
        this.phoneNumber = phoneNumber;
        this.accountId = accountId;
        this.authDir = path.join(AUTH_DIR, id);
        
        // Ensure client auth directory exists
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
        
        logger.info(`Created WhatsApp client instance with ID: ${id}`);
    }
    
    /**
     * Initialize the client connection
     */
    async connect(): Promise<void> {
        try {
            // Clean up existing socket if there is one
            if (this.socket) {
                // Remove all listeners to prevent memory leaks
                this.socket.ev.removeAllListeners();
                
                try {
                    // Try to end the socket gracefully
                    await this.socket.end();
                } catch (endError) {
                    // Just log the error, don't throw
                    logger.warn(`Error ending previous socket: ${endError}`);
                }
                
                // Clear the socket reference
                this.socket = null;
            }
            
            // Update and emit the connecting state
            this.state = 'connecting';
            this.emit('state', this.state);
            logger.info(`Client ${this.id} state changed to connecting`);
            
            // Get auth state for this client
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            // Fetch the latest version of Baileys
            const { version } = await fetchLatestBaileysVersion();
            
            // Configure custom logger to suppress QR codes in console
            const baileysLogger = pino({ level: 'warn' });
            
            // Create a new WhatsApp client
            this.socket = makeWASocket({
                version,
                auth: state,
                logger: baileysLogger,
                printQRInTerminal: false, // Don't print QR code in terminal (we'll handle it ourselves)
                browser: ['FS04 WhatsApp', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: false,
                markOnlineOnConnect: true,
                // Ensure QR code is generated
                qrTimeout: 60000 // 60 seconds timeout for QR code
            });
            
            // Save credentials when updated
            this.socket.ev.on('creds.update', saveCreds);
            
            // Handle connection events
            this.socket.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
            
            // Handle messages
            this.socket.ev.on('messages.upsert', this.handleMessages.bind(this));
            
            // Handle contacts
            this.socket.ev.on('contacts.update', this.handleContactsUpdate.bind(this));
            
            // Handle chats
            this.socket.ev.on('chats.upsert', this.handleChatsUpsert.bind(this));
            this.socket.ev.on('chats.update', this.handleChatsUpdate.bind(this));
            
            // Check if we're restoring a session by examining if auth files exist
            const authFiles = fs.readdirSync(this.authDir);
            const hasAuthFiles = authFiles.length > 0 && authFiles.some(file => file.includes('creds'));
            
            if (hasAuthFiles) {
                logger.info(`Restoring session for WhatsApp client ${this.id}`);
                
                // If we have a creds file, we might already be authenticated
                // We'll wait a short time to see if we connect without needing a QR code
                setTimeout(() => {
                    // If we're still in connecting state after the timeout, we might need a QR code
                    if (this.state === 'connecting') {
                        logger.info(`Session restoration pending for client ${this.id}, waiting for QR code or connection...`);
                        // Re-emit the connecting state to ensure listeners are notified
                        this.emit('state', this.state);
                    }
                }, 3000); // Wait 3 seconds to see if we connect automatically
            }
            
            logger.info(`WhatsApp client ${this.id} initialized and connecting...`);
        } catch (error) {
            logger.error(`Error connecting WhatsApp client ${this.id}: ${error}`);
            this.state = 'disconnected';
            this.emit('state', this.state);
            this.emit('error', error);
            
            // Attempt reconnection if enabled
            if (this.autoReconnect && this.reconnectCount < this.maxReconnectAttempts) {
                this.reconnectCount++;
                logger.info(`Attempting to reconnect (${this.reconnectCount}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`);
                setTimeout(() => this.connect(), this.reconnectDelay);
            }
        }
    }
    
    /**
     * Handle connection update events
     */
    private handleConnectionUpdate(update: any): void {
        const { connection, lastDisconnect, qr } = update;
        
        logger.debug(`Connection update for client ${this.id}: ${JSON.stringify(update)}`);
        
        // Handle QR code updates
        if (qr) {
            this.qrCode = qr;
            this.qrCodeTimestamp = Date.now();
            logger.info(`QR code generated for client ${this.id}: ${qr.substring(0, 20)}...`);
            this.emit('qr', qr);
            
            // Set up a timer to check for QR code expiration
            this.setupQrCodeRefreshTimer();
        }
        
        // Handle connection state changes
        if (connection) {
            switch (connection) {
                case 'connecting':
                    this.state = 'connecting';
                    // Explicitly emit state event for connecting
                    this.emit('state', this.state);
                    break;
                    
                case 'open':
                    this.state = 'connected';
                    this.reconnectCount = 0; // Reset reconnect count on successful connection
                    logger.info(`Client ${this.id} connected successfully`);
                    
                    // Emit connected event with user info
                    this.emit('state', 'connected');
                    
                    // Get connected user info
                    if (this.socket?.user) {
                        this.pushName = this.socket.user.name || this.socket.user.verifiedName;
                        
                        // Extract phone number from user ID if not already set
                        if (!this.phoneNumber && this.socket.user.id) {
                            // User ID format is typically like "1234567890:12@s.whatsapp.net"
                            const match = this.socket.user.id.match(/^(\d+):/); 
                            if (match && match[1]) {
                                this.phoneNumber = match[1];
                                logger.info(`Extracted phone number from user ID: ${this.phoneNumber}`);
                            }
                        }
                        
                        logger.info(`Connected as ${this.pushName} (${this.socket.user.id})`);
                        this.emit('connected', {
                            id: this.socket.user.id,
                            name: this.pushName,
                            phoneNumber: this.phoneNumber
                        });
                    }
                    break;
                    
                case 'close':
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    
                    // Check if we need to reconnect
                    if (statusCode === DisconnectReason.restartRequired) {
                        logger.info(`Client ${this.id} needs restart, reconnecting...`);
                        
                        // This is the expected behavior after scanning the QR code
                        // We need to explicitly reconnect with a new socket
                        this.state = 'connecting';
                        
                        // Create a new connection immediately
                        setTimeout(() => this.connect(), 1000);
                    } else if (statusCode === DisconnectReason.loggedOut) {
                        logger.info(`Client ${this.id} logged out`);
                        this.state = 'disconnected';
                        // Emit both logout and state events
                        this.emit('logout');
                        this.emit('state', this.state);
                    } else {
                        logger.warn(`Client ${this.id} disconnected with status code ${statusCode}`);
                        this.state = 'disconnected';
                        // Emit the state event immediately for this case
                        this.emit('state', this.state);
                        
                        // Attempt reconnection if enabled
                        if (this.autoReconnect && this.reconnectCount < this.maxReconnectAttempts) {
                            this.reconnectCount++;
                            logger.info(`Attempting to reconnect (${this.reconnectCount}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`);
                            setTimeout(() => this.connect(), this.reconnectDelay);
                        }
                    }
                    break;
            }
            
            // Only emit state event at the end if we haven't already emitted it for specific cases
            if (connection !== 'connecting' && connection !== 'open' && connection !== 'close') {
                this.emit('state', this.state);
            }
        }
    }
    
    /**
     * Handle incoming messages
     */
    private handleMessages(messagesUpsert: any): void {
        if (messagesUpsert.type !== 'notify') return;
        
        const messages = messagesUpsert.messages || [];
        
        for (const message of messages) {
            try {
                // Process the message
                const formattedMessage = this.formatMessage(message);
                if (formattedMessage) {
                    // Log all messages for debugging
                    logger.debug(`Received message: ${JSON.stringify(formattedMessage)}`);
                    
                    // Only emit actual messages with content, not notifications
                    const isNotification = 
                        formattedMessage.content.startsWith('[') && 
                        formattedMessage.content.endsWith(']') &&
                        (formattedMessage.content.includes('Status:') || 
                         formattedMessage.content === '[Notification]');
                    
                    // Only emit if it's not a notification or if it's a meaningful notification
                    if (!isNotification || formattedMessage.content !== '[Notification]') {
                        this.emit('message', formattedMessage);
                    }
                }
            } catch (error) {
                logger.error(`Error processing message: ${error}`);
            }
        }
    }
    
    /**
     * Format a raw message into a standardized format
     */
    private formatMessage(rawMessage: any): WhatsAppMessage | null {
        try {
            if (!rawMessage || !rawMessage.key) {
                logger.debug(`Received invalid message format: ${JSON.stringify(rawMessage)}`);
                return null;
            }
            
            // Get basic message info
            const messageId = rawMessage.key.id;
            const fromMe = rawMessage.key.fromMe;
            const from = fromMe ? (this.socket?.user?.id || 'me') : rawMessage.key.remoteJid;
            const to = fromMe ? rawMessage.key.remoteJid : (this.socket?.user?.id || 'me');
            const timestamp = rawMessage.messageTimestamp * 1000; // Convert to milliseconds
            
            // Initialize with default values
            let content = '';
            let type: WhatsAppMessage['type'] = 'unknown';
            let mediaUrl = '';
            let caption = '';
            let fileName = '';
            let fileSize = 0;
            let mimetype = '';
            
            // Check if there's actual message content
            const messageContent = rawMessage.message;
            
            // If there's no message content, it might be a status update or notification
            if (!messageContent || Object.keys(messageContent).length === 0) {
                // This is likely a status message or notification
                if (rawMessage.messageStubType) {
                    // Handle message stub types (status updates)
                    type = 'unknown';
                    content = `[Status: ${rawMessage.messageStubType}]`;
                    
                    // Map common stub types to readable messages
                    switch (rawMessage.messageStubType) {
                        case 1: content = '[Status: Message revoked]'; break;
                        case 2: content = '[Status: Group created]'; break;
                        case 3: content = '[Status: Group settings updated]'; break;
                        case 4: content = '[Status: Group participant added]'; break;
                        case 5: content = '[Status: Group participant removed]'; break;
                        case 6: content = '[Status: Group participant promoted]'; break;
                        case 7: content = '[Status: Group participant demoted]'; break;
                        case 8: content = '[Status: Group name updated]'; break;
                        // Add more as needed
                    }
                } else {
                    // Other notification or empty message
                    content = '[Notification]';
                }
                
                logger.debug(`Received status/notification message: ${content}`);
            } else {
                // Process regular message content
                
                // Text message
                if (messageContent.conversation) {
                    content = messageContent.conversation;
                    type = 'text';
                } 
                // Extended text message
                else if (messageContent.extendedTextMessage) {
                    content = messageContent.extendedTextMessage.text || '';
                    type = 'text';
                }
                // Image message
                else if (messageContent.imageMessage) {
                    type = 'image';
                    caption = messageContent.imageMessage.caption || '';
                    content = caption || '[Image]';
                    mediaUrl = ''; // Would need to download and save
                    mimetype = messageContent.imageMessage.mimetype;
                    fileSize = messageContent.imageMessage.fileLength;
                }
                // Video message
                else if (messageContent.videoMessage) {
                    type = 'video';
                    caption = messageContent.videoMessage.caption || '';
                    content = caption || '[Video]';
                    mediaUrl = ''; // Would need to download and save
                    mimetype = messageContent.videoMessage.mimetype;
                    fileSize = messageContent.videoMessage.fileLength;
                }
                // Audio message
                else if (messageContent.audioMessage) {
                    type = 'audio';
                    content = '[Audio]';
                    mediaUrl = ''; // Would need to download and save
                    mimetype = messageContent.audioMessage.mimetype;
                    fileSize = messageContent.audioMessage.fileLength;
                }
                // Document message
                else if (messageContent.documentMessage) {
                    type = 'document';
                    fileName = messageContent.documentMessage.fileName || '';
                    content = fileName || '[Document]';
                    mediaUrl = ''; // Would need to download and save
                    mimetype = messageContent.documentMessage.mimetype;
                    fileSize = messageContent.documentMessage.fileLength;
                }
                // Location message
                else if (messageContent.locationMessage) {
                    type = 'location';
                    content = `[Location: ${messageContent.locationMessage.degreesLatitude},${messageContent.locationMessage.degreesLongitude}]`;
                }
                // Contact message
                else if (messageContent.contactMessage || messageContent.contactsArrayMessage) {
                    type = 'contact';
                    content = '[Contact]';
                }
                // Sticker message
                else if (messageContent.stickerMessage) {
                    type = 'unknown';
                    content = '[Sticker]';
                }
                // Reaction message
                else if (messageContent.reactionMessage) {
                    type = 'unknown';
                    content = `[Reaction: ${messageContent.reactionMessage.text || ''}]`;
                }
                // Unknown message type - log the content for debugging
                else {
                    logger.debug(`Unknown message type: ${JSON.stringify(messageContent)}`);
                    content = '[Unknown message type]';
                }
            }
            
            return {
                id: messageId,
                from,
                to,
                content,
                timestamp,
                isFromMe: fromMe,
                type,
                mediaUrl,
                caption,
                fileName,
                fileSize,
                mimetype
            };
        } catch (error) {
            logger.error(`Error formatting message: ${error}`);
            return null;
        }
    }
    
    /**
     * Handle contacts update
     */
    private handleContactsUpdate(contacts: any[]): void {
        logger.debug(`Contacts update for client ${this.id}: ${contacts.length} contacts`);
        this.emit('contacts', contacts);
    }
    
    /**
     * Handle chats upsert
     */
    private handleChatsUpsert(chats: any[]): void {
        logger.debug(`Chats upsert for client ${this.id}: ${chats.length} chats`);
        this.emit('chats', chats);
    }
    
    /**
     * Handle chats update
     */
    private handleChatsUpdate(chats: any[]): void {
        logger.debug(`Chats update for client ${this.id}: ${chats.length} chats`);
        this.emit('chats_update', chats);
    }
    
    /**
     * Send a text message
     */
    async sendTextMessage(to: string, text: string): Promise<string | null> {
        try {
            if (!this.socket || this.state !== 'connected') {
                throw new Error('Client not connected');
            }
            
            const result = await this.socket.sendMessage(to, { text });
            logger.info(`Message sent to ${to}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
            return result?.key?.id || null;
        } catch (error) {
            logger.error(`Error sending message to ${to}: ${error}`);
            this.emit('error', error);
            return null;
        }
    }
    
    /**
     * Set up a timer to check for QR code expiration
     */
    private setupQrCodeRefreshTimer(): void {
        // Clear any existing timer
        if (this.qrCodeRefreshTimer) {
            clearTimeout(this.qrCodeRefreshTimer);
            this.qrCodeRefreshTimer = null;
        }
        
        // Set up a new timer to check for QR code expiration
        this.qrCodeRefreshTimer = setTimeout(() => {
            // If we're still in connecting state and the QR code is older than 25 seconds
            if (this.state === 'connecting' && this.qrCode && Date.now() - this.qrCodeTimestamp > 25000) {
                logger.info(`QR code for client ${this.id} may have expired, forcing reconnect...`);
                
                // Force a reconnect to get a new QR code
                this.connect();
            }
        }, 30000); // Check after 30 seconds
    }
    
    /**
     * Disconnect the client
     */
    async disconnect(): Promise<boolean> {
        try {
            // Clear QR code refresh timer
            if (this.qrCodeRefreshTimer) {
                clearTimeout(this.qrCodeRefreshTimer);
                this.qrCodeRefreshTimer = null;
            }
            
            if (!this.socket) {
                return true; // Already disconnected
            }
            
            // Disable auto-reconnect
            this.autoReconnect = false;
            
            // Logout and disconnect
            await this.socket.logout();
            await this.socket.end();
            
            this.state = 'disconnected';
            this.emit('state', this.state);
            
            logger.info(`Client ${this.id} disconnected successfully`);
            return true;
        } catch (error) {
            logger.error(`Error disconnecting client ${this.id}: ${error}`);
            this.emit('error', error);
            return false;
        }
    }
    
    /**
     * Get the current client state
     */
    getState(): WhatsAppClientState {
        return this.state;
    }
    
    /**
     * Get the current QR code
     */
    getQRCode(): string | null {
        return this.qrCode;
    }
    
    /**
     * Get client ID
     */
    getId(): string {
        return this.id;
    }
    
    /**
     * Get client info
     */
    getInfo(): any {
        return {
            id: this.id,
            state: this.state,
            phoneNumber: this.phoneNumber,
            accountId: this.accountId,
            pushName: this.pushName,
            qrCode: this.qrCode ? `${this.qrCode.substring(0, 20)}...` : null
        };
    }
    
    /**
     * Generate a pairing code for phone number login
     */
    async generatePairingCode(): Promise<string | null> {
        try {
            if (!this.socket || !this.phoneNumber) {
                throw new Error('Client not initialized or phone number not provided');
            }
            
            const code = await this.socket.requestPairingCode(this.phoneNumber);
            logger.info(`Generated pairing code for ${this.phoneNumber}: ${code}`);
            return code;
        } catch (error) {
            logger.error(`Error generating pairing code: ${error}`);
            this.emit('error', error);
            return null;
        }
    }
}
