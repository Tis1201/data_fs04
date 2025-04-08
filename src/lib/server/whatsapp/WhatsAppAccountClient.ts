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
import types from '@whiskeysockets/baileys/lib/Types';
import { logger } from '$lib/server/logger';
import EventEmitter from 'events';
import stringify from 'json-stringify-safe';
import { useZenstackAuthState } from './useZenstackAuthState';

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
function createBaileysLogger(logger: any): any {
    return {
        warn: (message: string) => logger.warn('[Baileys] ' + stringify(message)),
        error: (message: string) => logger.error('[Baileys] ' + stringify(message)),
        info: (message: string) => logger.warn('[Baileys] ' + stringify(message)),
        trace: (message: string) => { },
        debug: (message: string) => { },
        child: () => createBaileysLogger(logger) // Required by Baileys API
    };
}

/**
 * Cleans up and properly terminates an existing socket connection.
 * @param socket - The WhatsApp socket connection instance.
 * @param logger - The logger instance.
 * @returns A promise that resolves once the socket is ended.
 */
async function cleanupSocket(socket: any, logger: any): Promise<void> {
    if (socket) {
        socket.ev.removeAllListeners();
        try {
            await socket.end();
        } catch (e) {
            logger.warn(`Error ending previous socket: ${e}`);
        }
    }
    return Promise.resolve();
}

/**
 * Updates the client state, logging the change and emitting a 'state' event.
 * @param client - The WhatsApp client instance.
 * @param newState - The new state to set.
 * @param logger - The logger instance.
 */
function updateState(client: any, newState: WhatsAppClientState, logger: any): void {
    const oldState = client.state;
    client.state = newState;
    logger.info(`Client ${client.id} state changed from ${oldState} to ${newState}`);
    client.emit('state', newState);
}

/**
 * Handles a successful connection by resetting reconnection counters,
 * updating the client's display information, and emitting a 'connected' event.
 * @param client - The WhatsApp client instance.
 * @param logger - The logger instance.
 */
function handleConnectionSuccess(client: any, logger: any): void {
    client.reconnectCount = 0;
    if (client.socket?.user) {
        client.pushName = client.socket.user.name || client.socket.user.verifiedName;
        // Extract phone number from user id if not set
        if (!client.phoneNumber && client.socket.user.id) {
            const match = client.socket.user.id.match(/^\d+:/);
            if (match) {
                client.phoneNumber = match[0].replace(/:/g, '');
                logger.info(`Extracted phone number: ${client.phoneNumber}`);
            }
        }
        logger.info(`Connected as ${client.pushName} (${client.socket.user.id})`);
        client.emit('connected', {
            id: client.socket.user.id,
            name: client.pushName,
            phoneNumber: client.phoneNumber
        });
        updateState(client, WhatsAppClientState.Connected, logger);
    }
}

/**
 * Handles a disconnection event and implements reconnection logic.
 * Differentiates between errors that require a restart and other disconnections.
 * @param client - The WhatsApp client instance.
 * @param lastDisconnect - The last disconnection event object.
 * @param logger - The logger instance.
 */
function handleDisconnection(client: any, lastDisconnect: any, logger: any): void {
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
            logger.info(`Client ${client.id} needs restart (code: ${statusCode}), reconnecting immediately...`);
            try {
                updateState(client, WhatsAppClientState.Connecting, logger);
                setTimeout(() => {
                    try {
                        client.connect();
                    } catch (connectErr) {
                        logger.error(`Error reconnecting client ${client.id} after restart required: ${connectErr}`);
                    }
                }, 1000);
            } catch (stateErr) {
                logger.error(`Error updating state for client ${client.id}: ${stateErr}`);
            }
            return; // Do not proceed further for a restart-required error
        }
        logger.error(`Client ${client.id} disconnected with error: ${error}`);
        client.emit('error', error);

        // Attempt reconnection if allowed.
        if (client.autoReconnect && client.reconnectCount < client.maxReconnectAttempts) {
            client.reconnectCount++;
            logger.info(`Reconnecting in ${client.reconnectDelay}ms (attempt ${client.reconnectCount}/${client.maxReconnectAttempts})...`);
            setTimeout(() => client.connect(), client.reconnectDelay);
        }
        updateState(client, WhatsAppClientState.Disconnected, logger);
    } catch (err) {
        logger.error(`Error in handleDisconnection for client ${client.id}:`, err);
        updateState(client, WhatsAppClientState.Disconnected, logger);
    }
}

/****************************************************
 * WhatsAppAccountClient Class
 *
 * Represents a single WhatsApp account connection.
 * The public API (methods, events, properties) remains unchanged.
 ****************************************************/
export class WhatsAppAccountClient extends EventEmitter {
    // Private properties
    private id: string;
    private createdBy?: string;
    private socket: any;
    private state: WhatsAppClientState = WhatsAppClientState.Disconnected;
    private qrCode: string | null = null;
    private qrCodeTimestamp: number = 0;
    private qrCodeRefreshTimer: NodeJS.Timeout | null = null;
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
    private logger_x: any = null;

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
        this.logger_x = createBaileysLogger(logger);
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
            updateState(this, WhatsAppClientState.Waiting, logger);

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
                logger: this.logger_x,
                printQRInTerminal: false,
                browser: ['FS04 WhatsApp', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: false,
                markOnlineOnConnect: true,
                qrTimeout: 60000
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
                        updateState(this, this.state, logger);
                    }
                }, 500);
            }
            logger.info(`Client ${this.id} initialized and connecting...`);
        } catch (error) {
            logger.error(`Error connecting client ${this.id}: ${error}`);
            updateState(this, WhatsAppClientState.Disconnected, logger);
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
    private handleConnectionUpdate(update: any): void {
        const { connection, lastDisconnect, qr } = update;
        logger.debug(`Connection update for client ${this.id}: ${JSON.stringify(update)}`);

        if (qr) {
            // Store and emit the new QR code.
            this.qrCode = qr;
            this.qrCodeTimestamp = Date.now();
            updateState(this, WhatsAppClientState.AwaitingScan, logger);
            this.emit('qr', qr);
            this.setupQrCodeRefreshTimer();
            logger.info(`QR code generated for client ${this.id}: ${qr.substring(0, 20)}...`);
        }

        if (connection) {
            switch (connection) {
                case 'connecting':
                    updateState(this, WhatsAppClientState.Connecting, logger);
                    break;
                case 'open':
                    handleConnectionSuccess(this, logger);
                    break;
                case 'close':
                    handleDisconnection(this, lastDisconnect, logger);
                    break;
                default:
                    updateState(this, this.state, logger);
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
        if (messagesUpsert.type !== 'notify') return;
        const messages = messagesUpsert.messages || [];
        logger.debug(`Received ${messages.length} messages for client ${this.id}`);

        for (const message of messages) {
            logger.debug(`Processing message ${messages.indexOf(message) + 1} of ${messages.length}:`, {
                id: message.key?.id,
                fromMe: message.key?.fromMe,
                remoteJid: message.key?.remoteJid,
                type: Object.keys(message.message || {})[0]
            });
            logger.debug(`Message details: ${stringify(message)}`);

            const msgContent = message.message;
            if (!msgContent) continue;

            const mediaType = Object.keys(msgContent)[0];
            const mediaMsg = msgContent[mediaType];
            const isMediaType = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(mediaType);
            if (!isMediaType || !mediaMsg?.url || !mediaMsg?.mediaKey) {
                this.emit('message', message); // Emit non-media messages directly.
                continue;
            }

            try {
                ensureDirectoryExists(this.mediaDir);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = mediaMsg.mimetype?.split('/')[1] || 'bin';
                const filename = `${mediaType}_${message.key.id}_${timestamp}.${extension}`;
                const filepath = path.join(this.mediaDir, filename);

                // Download the media and save it.
                const buffer = await downloadMediaMessage(
                    message,
                    'buffer',
                    {},
                    {
                        logger: this.logger_x,
                        reuploadRequest: this.socket.updateMediaMessage
                    }
                );
                fs.writeFileSync(filepath, buffer);
                logger.info(`📥 Downloaded ${mediaType} to ${filepath}`);

                // Save thumbnail if available.
                if (mediaMsg.jpegThumbnail) {
                    const thumbPath = path.join(this.mediaDir, `thumb_${filename}.jpg`);
                    const thumbBuffer = Buffer.from(mediaMsg.jpegThumbnail, 'base64');
                    fs.writeFileSync(thumbPath, thumbBuffer);
                    logger.info(`🖼️ Saved thumbnail to ${thumbPath}`);
                }

                // Emit media event with file path.
                this.emit('media', {
                    message,
                    mediaPath: filepath
                });
            } catch (err) {
                logger.error(`❌ Error downloading media: ${err}`);
            }
            this.emit('message', message); // Always emit original message.
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
        try {
            if (!this.socket || this.state !== WhatsAppClientState.Connected) {
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

    /********************************************************************************
     * Setup QR Code Refresh Timer
     *
     * Sets a timer to check if the displayed QR code has expired and triggers a reconnect.
     ********************************************************************************/
    private setupQrCodeRefreshTimer(): void {
        if (this.qrCodeRefreshTimer) {
            clearTimeout(this.qrCodeRefreshTimer);
            this.qrCodeRefreshTimer = null;
        }
        this.qrCodeRefreshTimer = setTimeout(() => {
            if (this.state === WhatsAppClientState.Connecting && this.qrCode && Date.now() - this.qrCodeTimestamp > 25000) {
                logger.info(`QR code for client ${this.id} may have expired, reconnecting...`);
                this.connect();
            }
        }, 30000);
    }

    /********************************************************************************
     * Disconnect
     *
     * Logs out and disconnects the client gracefully.
     *
     * @returns A promise that resolves to true on successful disconnection.
     ********************************************************************************/
    async disconnect(): Promise<boolean> {
        try {
            if (this.qrCodeRefreshTimer) {
                clearTimeout(this.qrCodeRefreshTimer);
                this.qrCodeRefreshTimer = null;
            }
            if (!this.socket) return true;
            this.autoReconnect = false;
            await this.socket.logout();
            await this.socket.end();
            updateState(this, WhatsAppClientState.Disconnected, logger);
            logger.info(`Client ${this.id} disconnected successfully`);
            return true;
        } catch (error) {
            logger.error(`Error disconnecting client ${this.id}: ${error}`);
            this.emit('error', error);
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
 * Initializes authentication credentials.
 * (Placeholder: Customize as needed.)
 * @returns An object representing initial auth credentials.
 */
function initAuthCreds(): any {
    return {
        // Initialize auth credentials here.
    };
}
