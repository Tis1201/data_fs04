import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pkg from '@whiskeysockets/baileys';
const {
    makeWASocket,
    fetchLatestBaileysVersion,
    DisconnectReason,
    downloadMediaMessage
} = pkg;
import { logger } from '$lib/server/logger';
import EventEmitter from 'events';
import stringify from 'json-stringify-safe';
import { useZenstackAuthState } from './useZenstackAuthState';
import { MessageFactory, type InMessage, type RoutingMessage } from '../messaging/interfaces/message';
import type { UserInfo } from '../types/user';
import { userInfoByUserId } from '../security/auth-utils';
import { publisher } from '../messaging/core/publisher';

// Default directories for authentication and media storage
export const DEFAULT_AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');
export const DEFAULT_MEDIA_DIR = path.join(process.cwd(), 'whatsapp-media');

/****************************************************
 * Utility Functions & Types
 ****************************************************/

/**
 * Ensures that a directory exists. Creates it recursively if it does not.
 * @param dir - The directory path to check/create.
 */
function ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Enumeration for representing the WhatsApp client's state.
 */
export enum WhatsAppClientState {
    Waiting = 'waiting',
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    AwaitingScan = 'awaiting_scan',
    Authenticated = 'authenticated'
}

/**
 * Creates a lightweight logger for Baileys operations.
 * @param logger - The base logger instance.
 * @returns An object with logging functions (warn, error, etc.) expected by Baileys.
 */
function createBaileysLogger(baseLogger: any): any {
    return {
        warn: (message: string) => baseLogger.warn('[Baileys] ' + stringify(message)),
        error: (message: string) => baseLogger.error('[Baileys] ' + stringify(message)),
        info: (message: string) => baseLogger.info('[Baileys] ' + stringify(message)),
        // trace: (message: string) => baseLogger.info('[Baileys] ' + stringify(message)),
        // debug: (message: string) => baseLogger.info('[Baileys] ' + stringify(message)),
        
        trace: () => {}, // Empty function for trace level
        debug: () => {}, // Empty function for debug level
        child: () => createBaileysLogger(baseLogger) // Required by Baileys API
    };
}

/**
 * Cleans up and properly terminates an existing socket connection.
 * @param socket - The WhatsApp socket connection instance.
 * @param logger - The logger instance.
 * @returns A promise that resolves once the socket is ended.
 */
async function cleanupSocket(socket: any, baseLogger: any): Promise<void> {
    if (socket) {
        socket.ev.removeAllListeners();
        try {
            await socket.end();
        } catch (e) {
            baseLogger.warn(`Error ending previous socket: ${e}`);
        }
    }
    return Promise.resolve();
}



/****************************************************
 * WhatsAppAccountClient Class
 *
 * Represents a single WhatsApp account connection.
 * The public API (methods, events, properties) remains unchanged.
 ****************************************************/
export class WhatsAppAccountClient extends EventEmitter {
    
    // Class properties
    // Private properties
    private id: string;
    private createdBy?: string;
    private userInfo: UserInfo | null = null;
    
    /**
     * Sets the user info for this client
     * Used for message routing
     */
    public setUserInfo(userInfo: UserInfo): void {
      this.userInfo = userInfo;
      logger.debug(`Set user info for client ${this.id}`, { userId: userInfo.id });
    }
    private socket: any;
    private state: WhatsAppClientState = WhatsAppClientState.Disconnected;
    private qrCode: string | null = null;
    private qrCodeTimestamp: number = 0;
    private qrCodeRefreshTimer?: NodeJS.Timeout;
    private phoneNumber?: string;
    private accountId?: string;
    private authDir: string;
    private mediaDir: string;
    private pushName?: string;
    private autoReconnect: boolean = true;
    private reconnectCount: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 3000; // in milliseconds
    private createdAt: number = Date.now();
    private baileysLogger: any;

    /********************************************************************************
     * Constructor
     *
     * Initializes the WhatsAppAccountClient instance by setting up directories,
     * creating a unique ID (if not provided), and setting default values.
     *
     * @param id - Optional client identifier.
     * @param phoneNumber - Optional phone number for the client.
     * @param accountId - Optional account identifier for database reference.
     * @param createdBy - Optional identifier for the user who created the client.
     * @param options - Optional directories for authentication and media storage.
     ********************************************************************************/
    constructor(
        id?: string,
        phoneNumber?: string,
        accountId?: string,
        createdBy?: string,
        options?: { authDir?: string; mediaDir?: string }
    ) {
        super();
        this.baileysLogger = createBaileysLogger(logger);
        this.id = id || uuidv4();
        this.phoneNumber = phoneNumber;
        this.accountId = accountId;
        this.createdBy = createdBy;

        // Setup authentication and media directories
        const baseAuthDir = options?.authDir || DEFAULT_AUTH_DIR;
        const baseMediaDir = options?.mediaDir || DEFAULT_MEDIA_DIR;
        ensureDirectoryExists(baseAuthDir);
        ensureDirectoryExists(baseMediaDir);
        this.authDir = path.join(baseAuthDir, this.id);
        this.mediaDir = path.join(baseMediaDir, this.id);
        ensureDirectoryExists(this.authDir);
        ensureDirectoryExists(this.mediaDir);
        logger.info(`Created WhatsApp client instance with ID: ${this.id}`);
    }

    /**
     * Initialize the client by fetching user information
     */
    async init(): Promise<void> {
        if (!this.createdBy) {
            logger.info(`Cannot initialize client ${this.id}: no createdBy user ID provided`);
            return;
        }
        
        logger.info(`Initializing WhatsApp client instance with ID: ${this.id} for user: ${this.createdBy}`);
        this.userInfo = await userInfoByUserId(this.createdBy);
        logger.debug(`User info loaded for client ${this.id}`);
    }

    /********************************************************************************
     * Connect
     *
     * Establishes a connection to WhatsApp by initializing the socket using
     * Baileys with proper auth state. Cleans up any previous socket before connection.
     ********************************************************************************/
    async connect(): Promise<void> {
        try {
            // Clean up any previous socket.
            await cleanupSocket(this.socket, logger);
            this.updateState(WhatsAppClientState.Waiting);

            // Load auth state from SQL database.
            const { state, saveCreds } = await useZenstackAuthState(this.id);
            const { version } = await fetchLatestBaileysVersion();

            // Ensure we have valid authentication credentials.
            if (!state || !state.creds) {
                logger.warn(`No valid auth state found for client ${this.id}, initializing new state`);
                state.creds = initAuthCreds();
                await saveCreds();
            }

            // Create the WhatsApp socket connection.
            this.socket = makeWASocket({
                version,
                auth: { creds: state.creds, keys: state.keys },
                logger: this.baileysLogger,
                printQRInTerminal: false,
                browser: ['FS04 WhatsApp', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: false,
                markOnlineOnConnect: true,
                qrTimeout: 60000,
                patchMessageBeforeSending: (message) => {
                    try {
                        return message;
                    } catch (error) {
                        logger.error(`Error in patchMessageBeforeSending: ${error}`);
                        return message;
                    }
                }
            });

            this.socket.ev.on('error', (err) => {
                logger.error(`Baileys socket error: ${err}`);
            });

            // Setup event listeners for socket events.
            this.socket.ev.on('creds.update', saveCreds);
            this.socket.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
            this.socket.ev.on('messages.upsert', this.handleMessages.bind(this));
            this.socket.ev.on('contacts.update', this.handleContactsUpdate.bind(this));
            this.socket.ev.on('chats.upsert', this.handleChatsUpsert.bind(this));
            this.socket.ev.on('chats.update', this.handleChatsUpdate.bind(this));

            // Restore session if any auth files are present.
            const authFiles = fs.readdirSync(this.authDir);
            if (authFiles.some(file => file.includes('creds'))) {
                logger.info(`Restoring session for client ${this.id}`);
                setTimeout(() => {
                    if (this.state === WhatsAppClientState.Connecting) {
                        logger.info(`Session restoration pending for client ${this.id}`);
                        this.updateState(this.state);
                    }
                }, 500);
            }
            logger.info(`Client ${this.id} initialized and connecting...`);
        } catch (error) {
            logger.error(`Error connecting client ${this.id}: ${error}`);
            this.updateState(WhatsAppClientState.Disconnected);
            this.emit('error', error);
            if (this.autoReconnect && this.reconnectCount < this.maxReconnectAttempts) {
                this.reconnectCount++;
                logger.info(`Reconnecting (${this.reconnectCount}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`);
                setTimeout(() => this.connect(), this.reconnectDelay);
            }
        }
    }

    /********************************************************************************
     * Handle Connection Update
     *
     * Processes updates from the Baileys connection, such as QR code generation,
     * connection state changes, and disconnections.
     *
     * @param update - The update object received from the socket.
     ********************************************************************************/
    /**
     * Process connection updates from Baileys
     * @param update - The connection update object
     */
    private handleConnectionUpdate(update: any): void {
        const { connection, lastDisconnect, qr } = update;
        logger.debug(`Connection update for client ${this.id}: ${JSON.stringify(update)}`);

        if (qr) {
            // Store and emit the new QR code
            this.qrCode = qr;
            this.qrCodeTimestamp = Date.now();
            this.updateState(WhatsAppClientState.AwaitingScan);
            
            // Emit QR code via EventEmitter for manager to listen
            this.emit('qr', qr);
            
            this.setupQrCodeRefreshTimer();
            logger.info(`QR code generated for client ${this.id}: ${qr.substring(0, 20)}...`);

            // Send QR code via RoutingMessage if userInfo is available
            if (this.userInfo) {
                const qrMessage: InMessage = {
                    type: 'whatsapp',
                    scope: `subscription:whatsapp:${this.id}`,
                    protocol: 'whatsapp',
                    connectionId: this.id,
                    userInfo: this.userInfo,
                    payload: {
                        action: 'qrCode',
                        content: {
                            qrCode: qr,
                            clientId: this.id,
                            accountId: this.accountId
                        }
                    }
                };

                // Create routing message with overrides
                const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(qrMessage, {
                    systemGenerated: true,
                    echoToSender: true
                });

                publisher.publish(routingMessage);
            } else {
                logger.warn(`Cannot send QR code via RoutingMessage: userInfo not available for client ${this.id}`);
            }
        }

        if (connection) {
            switch (connection) {
                case 'connecting':
                    this.updateState(WhatsAppClientState.Connecting);
                    break;
                case 'open':
                    this.handleConnectionSuccess();
                    break;
                case 'close':
                    this.handleDisconnection(lastDisconnect);
                    break;
                default:
                    this.updateState(this.state);
                    break;
            }
        }
    }

    /********************************************************************************
     * Handle Messages
     *
     * Processes incoming messages. For media messages with downloadable content,
     * downloads the media and saves it to the media directory. Always emits the message.
     *
     * @param messagesUpsert - The messages update object.
     ********************************************************************************/
    private async handleMessages(messagesUpsert: any): Promise<void> {
        try {
            if (messagesUpsert.type !== 'notify') return;
            const messages = messagesUpsert.messages || [];
            logger.debug(`Received ${messages.length} messages for client ${this.id}`);

            for (const message of messages) {
                try {
                    const msgContent = message.message;
                    if (!msgContent) continue;
                    
                    const messageType = Object.keys(msgContent)[0];
                    
                    logger.debug(`Processing message ${messages.indexOf(message) + 1} of ${messages.length}:`, {
                        id: message.key?.id,
                        fromMe: message.key?.fromMe,
                        remoteJid: message.key?.remoteJid,
                        type: messageType
                    });
                    
                    // Skip system messages, key exchanges, and protocol messages when emitting
                    // but still process them for other purposes (like media download)
                    const systemMessageTypes = [
                        'senderKeyDistributionMessage',
                        'protocolMessage',
                        'ephemeralMessage',
                        'viewOnceMessage',
                        'reactionMessage',
                        'pollUpdateMessage',
                        'pollCreationMessage',
                        'scheduledCallCreationMessage'
                    ];
                    
                    // Only emit actual user messages, not system messages
                    if (!systemMessageTypes.includes(messageType)) {
                        // Emit message via EventEmitter for manager to listen
                        this.emit('message', message);
                    } else {
                        logger.debug(`Skipping emission of system message type: ${messageType}`);
                    }
                    
                    // Process media messages
                    const mediaType = messageType;
                    const mediaMsg = msgContent[mediaType];
                    const isMediaType = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(mediaType);
                    let mediaPath = null;
                    
                    if (isMediaType && mediaMsg?.url && mediaMsg?.mediaKey) {
                        try {
                            ensureDirectoryExists(this.mediaDir);
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            const extension = mediaMsg.mimetype?.split('/')[1] || 'bin';
                            const filename = `${mediaType}_${message.key.id}_${timestamp}.${extension}`;
                            const filepath = path.join(this.mediaDir, filename);

                            // Download the media and save it
                            try {
                                const buffer = await downloadMediaMessage(
                                    message,
                                    'buffer',
                                    {},
                                    {
                                        logger: this.baileysLogger,
                                        reuploadRequest: this.socket.updateMediaMessage
                                    }
                                );
                                fs.writeFileSync(filepath, buffer);
                                logger.info(`📥 Downloaded ${mediaType} to ${filepath}`);
                                mediaPath = filepath;

                                // Save thumbnail if available
                                if (mediaMsg.jpegThumbnail) {
                                    const thumbPath = path.join(this.mediaDir, `thumb_${filename}.jpg`);
                                    const thumbBuffer = Buffer.from(mediaMsg.jpegThumbnail, 'base64');
                                    fs.writeFileSync(thumbPath, thumbBuffer);
                                    logger.info(`🖼️ Saved thumbnail to ${thumbPath}`);
                                }

                                // Emit media event with file path
                                this.emit('media', {
                                    message,
                                    mediaPath: filepath
                                });
                            } catch (downloadErr) {
                                // Handle session errors in media download
                                if (downloadErr.message && (downloadErr.message.includes('No session') || downloadErr.message.includes('No open session'))) {
                                    logger.warn(`Session error when downloading media: ${downloadErr.message}`);
                                } else {
                                    logger.error(`❌ Error downloading media: ${downloadErr}`);
                                }
                            }
                        } catch (err) {
                            logger.error(`❌ Error processing media: ${err}`);
                        }
                    }
                    
                    // Send message via RoutingMessage if userInfo is available and it's not a system message
                    if (this.userInfo && !systemMessageTypes.includes(messageType)) {
                        try {
                            const messagePayload: InMessage = {
                                type: 'whatsapp',
                                scope: `subscription:whatsapp:${this.id}`,
                                protocol: 'whatsapp',
                                connectionId: this.id,
                                userInfo: this.userInfo,
                                payload: {
                                    action: 'message',
                                    content: {
                                        clientId: this.id,
                                        message: message,
                                        mediaPath: mediaPath
                                    }
                                }
                            };

                            // Create routing message with overrides
                            const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(messagePayload, {
                                systemGenerated: true,
                                echoToSender: false
                            });

                            publisher.publish(routingMessage);
                        } catch (publishErr) {
                            logger.error(`Error publishing message: ${publishErr}`);
                        }
                    } else {
                        logger.warn(`Cannot send message via RoutingMessage: userInfo not available for client ${this.id}`);
                    }
                } catch (messageErr) {
                    // Catch errors for individual messages to prevent one bad message from breaking the whole batch
                    logger.error(`Error processing individual message: ${messageErr}`);
                }
            }
        } catch (error) {
            // This outer try-catch ensures that even if the message processing fails, it won't crash the server
            logger.error(`Error in handleMessages for client ${this.id}: ${error}`);
        }
    }

    /********************************************************************************
     * Handle Contacts Update
     *
     * Emits an event when contacts are updated.
     *
     * @param contacts - Array of updated contacts.
     ********************************************************************************/
    private handleContactsUpdate(contacts: any[]): void {
        logger.debug(`Contacts update for client ${this.id}: ${contacts.length} contacts`);
        this.emit('contacts', contacts);
    }

    /********************************************************************************
     * Handle Chats Upsert
     *
     * Emits an event when new chats are added or existing ones are upserted.
     *
     * @param chats - Array of chats.
     ********************************************************************************/
    private handleChatsUpsert(chats: any[]): void {
        logger.debug(`Chats upsert for client ${this.id}: ${chats.length} chats`);
        this.emit('chats', chats);
    }

    /********************************************************************************
     * Handle Chats Update
     *
     * Emits an event when chats are updated.
     *
     * @param chats - Array of chat updates.
     ********************************************************************************/
    private handleChatsUpdate(chats: any[]): void {
        logger.debug(`Chats update for client ${this.id}: ${chats.length} chats`);
        this.emit('chats_update', chats);
    }

    /********************************************************************************
     * Send Text Message
     *
     * Sends a text message to the specified recipient.
     *
     * @param to - Recipient's address (phone number or group).
     * @param text - Text content of the message.
     * @returns Message ID if sent successfully, or null on failure.
     ********************************************************************************/
    async sendTextMessage(to: string, text: string): Promise<string | null> {
        if (!this.socket || this.state !== WhatsAppClientState.Connected) {
            throw new Error('Client not connected');
        }

        logger.info(`Sending message to ${to}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
        
        try {
            // Send the message to the actual recipient
            const result = await this.socket.sendMessage(to, { text });
            logger.info(`Message sent to ${to}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
            return result?.key?.id || null;
        } catch (error) {
            // Log the detailed error for debugging
            logger.error(`Error sending message to ${to}: ${error.message || error}`);
            
            // Re-throw the error to be handled by the caller
            throw error;
        }
    }

    /********************************************************************************
     * Setup QR Code Refresh Timer
     *
     * Sets a timer to check if the displayed QR code has expired and triggers a reconnect.
     ********************************************************************************/
    /**
     * Sets up a timer to refresh the QR code if it expires
     * QR codes typically expire after 20-30 seconds
     */
    private setupQrCodeRefreshTimer(): void {
        // Clear any existing timer
        if (this.qrCodeRefreshTimer) {
            clearTimeout(this.qrCodeRefreshTimer);
            this.qrCodeRefreshTimer = undefined;
        }
        
        // Set a new timer to check if QR code has expired
        this.qrCodeRefreshTimer = setTimeout(() => {
            const QR_CODE_EXPIRY_MS = 25000; // 25 seconds
            if (this.state === WhatsAppClientState.AwaitingScan && 
                this.qrCode && 
                (Date.now() - this.qrCodeTimestamp > QR_CODE_EXPIRY_MS)) {
                logger.info(`QR code for client ${this.id} has expired, reconnecting...`);
                this.connect();
            }
        }, 30000); // Check after 30 seconds
    }

    /********************************************************************************
     * Disconnect
     *
     * Logs out and disconnects the client gracefully.
     *
     * @returns A promise that resolves to true on successful disconnection.
     ********************************************************************************/
    /**
     * Disconnect the client gracefully
     * @returns A promise that resolves to true on successful disconnection
     */
    async disconnect(): Promise<boolean> {
        try {
            // Clear QR code refresh timer if exists
            if (this.qrCodeRefreshTimer) {
                clearTimeout(this.qrCodeRefreshTimer);
                this.qrCodeRefreshTimer = undefined;
            }
            
            // If socket doesn't exist, consider it already disconnected
            if (!this.socket) return true;
            
            // Disable auto-reconnect to prevent reconnection attempts
            this.autoReconnect = false;
            
            // Properly logout and end the socket connection
            await this.socket.logout();
            await this.socket.end();
            
            // Update state and log the disconnection
            this.updateState(WhatsAppClientState.Disconnected);
            logger.info(`Client ${this.id} disconnected successfully`);
            
            // Emit disconnected event via EventEmitter for manager to listen
            this.emit('disconnected');
            
            // Send disconnection notification via RoutingMessage if userInfo is available
            if (this.userInfo) {
                const disconnectMessage: InMessage = {
                    type: 'whatsapp',
                    scope: `subscription:whatsapp:${this.id}`,
                    protocol: "whatsapp",
                    connectionId: this.id,
                    userInfo: this.userInfo,
                    payload: {
                        action: 'disconnected',
                        content: {
                            clientId: this.id,
                            reason: 'manual_disconnect'
                        }
                    }
                };

                // Create routing message with overrides
                const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(disconnectMessage, {
                    systemGenerated: true,
                    echoToSender: true
                });

                publisher.publish(routingMessage);
            }
            
            return true;
        } catch (error) {
            logger.error(`Error disconnecting client ${this.id}: ${error}`);
            this.emit('error', error);
            this.emit('disconnected');
            return false;
        }
    }

    /********************************************************************************
     * Clear Auth Files
     *
     * Deletes all authentication files from the client's auth directory.
     ********************************************************************************/
    clearAuthFiles(): void {
        try {
            if (fs.existsSync(this.authDir)) {
                logger.info(`Clearing auth files for client ${this.id}`);
                const files = fs.readdirSync(this.authDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.authDir, file));
                    logger.debug(`Deleted auth file: ${file}`);
                }
                logger.info(`Auth files cleared for client ${this.id}`);
            }
        } catch (error) {
            logger.error(`Error clearing auth files for client ${this.id}: ${error}`);
        }
    }

    /********************************************************************************
     * Getters and Setters
     ********************************************************************************/
    getCreatedBy(): string | undefined {
        return this.createdBy;
    }

    setCreatedBy(createdBy: string): void {
        this.createdBy = createdBy;
    }

    getState(): WhatsAppClientState {
        return this.state;
    }

    getQRCode(): string | null {
        return this.qrCode;
    }

    getId(): string {
        return this.id;
    }

    getAccountId(): string {
        return this.accountId;
    }

    getCreatedAt(): number {
        return this.createdAt;
    }

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

    getPushName(): string | undefined {
        return this.pushName;
    }

    getPhoneNumber(): string | undefined {
        return this.phoneNumber;
    }

    setAccountId(accountId: string): void {
        this.accountId = accountId;
        logger.info(`Set account ID ${accountId} for client ${this.id}`);
    }

    /**
     * Updates the client state, logging the change and emitting a 'state' event.
     * @param newState - The new state to set.
     */
    private updateState(newState: WhatsAppClientState): void {
        const oldState = this.state;
        this.state = newState;
        logger.info(`Client ${this.id} state changed from ${oldState} to ${newState}`);
        this.emit('state', newState);
    }

    /**
     * Handles a successful connection by resetting reconnection counters,
     * updating the client's display information, and emitting a 'connected' event.
     */
    private handleConnectionSuccess(): void {
        this.reconnectCount = 0;
        if (this.socket?.user) {
            this.pushName = this.socket.user.name || this.socket.user.verifiedName;
            // Extract phone number from user id if not set
            if (!this.phoneNumber && this.socket.user.id) {
                const match = this.socket.user.id.match(/^\d+:/);
                if (match) {
                    this.phoneNumber = match[0].replace(/:/g, '');
                    logger.info(`Extracted phone number: ${this.phoneNumber}`);
                }
            }
            logger.info(`Connected as ${this.pushName} (${this.socket.user.id})`);
            
            // Emit the connected event via EventEmitter for manager to listen
            this.emit('connected');
            
            // Send the connected notification via RoutingMessage
            if (this.userInfo) {
                const connectionMessage: InMessage = {
                    type: 'whatsapp',
                    scope: `subscription:whatsapp:${this.id}`,
                    protocol: "whatsapp",
                    connectionId: this.id,
                    userInfo: this.userInfo,
                    payload: {
                        action: 'connected',
                        content: {
                            clientId: this.id,
                            pushName: this.pushName,
                            displayName: this.pushName,
                            phoneNumber: this.phoneNumber
                        }
                    }
                };

                // Create routing message with overrides
                const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(connectionMessage, {
                    systemGenerated: true,
                    echoToSender: true
                });

                publisher.publish(routingMessage);
            }

            this.updateState(WhatsAppClientState.Connected);
        }
    }

    /**
     * Handles a disconnection event and implements reconnection logic.
     * Differentiates between errors that require a restart and other disconnections.
     * @param lastDisconnect - The last disconnection event object.
     */
    private handleDisconnection(lastDisconnect: any): void {
        try {
            const error = lastDisconnect?.error;
            const statusCode = error?.output?.statusCode;
            const errorData = error?.data;
            const errorMessage = error?.output?.payload?.message;
            const isRestartRequired =
                statusCode === 515 ||
                (errorMessage && errorMessage.includes('restart required')) ||
                (errorData?.tag === 'stream:error' && errorData?.attrs?.code === '515');

            if (isRestartRequired) {
                logger.info(`Client ${this.id} needs restart (code: ${statusCode}), reconnecting immediately...`);
                try {
                    this.updateState(WhatsAppClientState.Connecting);
                    setTimeout(() => {
                        try {
                            this.connect();
                        } catch (connectErr) {
                            logger.error(`Error reconnecting client ${this.id} after restart required: ${connectErr}`);
                        }
                    }, 1000);
                } catch (stateErr) {
                    logger.error(`Error updating state for client ${this.id}: ${stateErr}`);
                }
                return; // Do not proceed further for a restart-required error
            }
            
            logger.error(`Client ${this.id} disconnected with error: ${error}`);
            this.emit('error', error);
            this.emit('disconnected');

            // Send disconnection notification via RoutingMessage if userInfo is available
            if (this.userInfo) {
                const disconnectMessage: InMessage = {
                    type: 'whatsapp',
                    scope: `subscription:whatsapp:${this.id}`,
                    protocol: "whatsapp",
                    connectionId: this.id,
                    userInfo: this.userInfo,
                    payload: {
                        action: 'disconnected',
                        content: {
                            clientId: this.id,
                            error: error ? JSON.stringify(error) : null
                        }
                    }
                };

                // Create routing message with overrides
                const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(disconnectMessage, {
                    systemGenerated: true,
                    echoToSender: true
                });

                publisher.publish(routingMessage);
            }

            // Attempt reconnection if allowed
            if (this.autoReconnect && this.reconnectCount < this.maxReconnectAttempts) {
                this.reconnectCount++;
                logger.info(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectCount}/${this.maxReconnectAttempts})...`);
                setTimeout(() => this.connect(), this.reconnectDelay);
            }
            
            this.updateState(WhatsAppClientState.Disconnected);
        } catch (err) {
            logger.error(`Error in handleDisconnection for client ${this.id}:`, err);
            this.updateState(WhatsAppClientState.Disconnected);
            this.emit('disconnected');
        }
    }

    /********************************************************************************
     * Generate Pairing Code
     *
     * Requests a pairing code for phone number login.
     *
     * @returns A promise that resolves to the pairing code, or null on failure.
     ********************************************************************************/
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

/**
 * Initializes authentication credentials for a new WhatsApp session.
 * @returns An object representing initial auth credentials.
 */
function initAuthCreds(): any {
    return {
        // Return empty object for Baileys to initialize properly
        // Baileys will populate this with necessary default values
    };
}

// Add a global process error handler to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    // Don't crash the process, just log the error
});

