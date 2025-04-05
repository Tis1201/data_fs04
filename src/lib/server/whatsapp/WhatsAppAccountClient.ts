import fs from 'fs';
import path from 'path';

import { 
  makeWASocket,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage 
} from '@whiskeysockets/baileys';

import { Boom } from '@hapi/boom';
import { logger } from '$lib/server/logger';
import EventEmitter from 'events';
import crypto from 'crypto';

export const DEFAULT_AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');
export const DEFAULT_MEDIA_DIR = path.join(process.cwd(), 'whatsapp-media');

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ****************************************************************************** 
// 
// Types
// 
// *******************************************************************************/

export enum WhatsAppClientState {
  Waiting = 'waiting',
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  AwaitingScan = 'awaiting_scan',
  Authenticated = 'authenticated'
}

// ****************************************************************************** 
// 
// Utility Functions
// 
// *******************************************************************************/

function createBaileysLogger(logger: any): any {
  return {
    info: (message: string) => logger.info(`[Baileys] ${message}`),
    warn: (message: string) => logger.warn(`[Baileys] ${message}`),
    error: (message: string) => logger.error(`[Baileys] ${message}`),
    trace: (message: string) => logger.debug(`[Baileys] ${message}`),
    debug: (message: string) => logger.debug(`[Baileys] ${message}`),
    child: () => createBaileysLogger(logger) // Baileys expects this method to exist
  };
}

/****************************************************************************** 
* 
* Socket Cleanup
* 
********************************************************************************/

async function cleanupSocket(socket: any, logger: any): Promise<void> {
  if (socket) {
    socket.ev.removeAllListeners();
    try {
      await socket.end();
    } catch (e) {
      logger.warn(`Error ending previous socket: ${e}`);
    }
    socket = null;
  }
  return Promise.resolve();
}

/****************************************************************************** 
* 
* State Management
* 
********************************************************************************/

function updateState(client: any, newState: WhatsAppClientState, logger: any): void {
  const oldState = client.state;
  client.state = newState;
  logger.info(`Client ${client.id} state changed from ${oldState} to ${newState}`);
  client.emit('state', newState);
}

/****************************************************************************** 
* 
* State Management
* 
********************************************************************************/
function handleConnectionSuccess(client: any, logger: any): void {
  
  client.reconnectCount = 0;

  if (client.socket?.user) {
    client.pushName = client.socket.user.name || client.socket.user.verifiedName;
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

/****************************************************************************** 
* 
* State Management
* 
********************************************************************************/
function handleDisconnection(client: any, lastDisconnect: any, logger: any): void {
  try {
    // Simply extract the error from the disconnect event.
    const error = lastDisconnect?.error;
    logger.error(`Client ${client.id} disconnected with error: ${error}`);
  
    // Emit the error directly so that consumers get Bailey's error.
    client.emit('error', error);
  
    // Optionally, trigger reconnection if enabled.
    if (client.autoReconnect && client.reconnectCount < client.maxReconnectAttempts) {
      client.reconnectCount++;
      logger.info(`Reconnecting in ${client.reconnectDelay}ms (attempt ${client.reconnectCount}/${client.maxReconnectAttempts})...`);
      setTimeout(() => client.connect(), client.reconnectDelay);
    }

    // Update state to disconnected
    updateState(client, WhatsAppClientState.Disconnected, logger);
  } catch (err) {
    logger.error(`Error in handleDisconnection for client ${client.id}:`, err);
    // Ensure we update the state even if there's an error
    updateState(client, WhatsAppClientState.Disconnected, logger);
  }
}

// ****************************************************************************** 
// 
// WhatsAppMessage
// 
// *******************************************************************************/

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  isFromMe: boolean;
  type:
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'document'
    | 'location'
    | 'contact'
    | 'reaction'
    | 'deleted'
    | 'unknown'
    | 'app_state_sync';
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  fileSize?: number;
  mimetype?: string;
  isReply?: boolean;
  replyToMessageId?: string;
  replyToMessage?: string;
  replyToParticipant?: string;
}

/**
 * WhatsAppAccountClient represents a single WhatsApp account connection.
 * Its public API (methods, events, properties) remains unchanged.
 */
export class WhatsAppAccountClient extends EventEmitter {
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
  private reconnectDelay: number = 3000; // 3 seconds
  private createdAt: number = Date.now();

  /******************************************************************************** 
   * 
   * Constructor
   * 
   ********************************************************************************/
  constructor(
    id: string,
    phoneNumber?: string,
    accountId?: string,
    options?: { authDir?: string; mediaDir?: string }
  ) {
    super();
    this.id = id;
    this.phoneNumber = phoneNumber;
    this.accountId = accountId;
    const baseAuthDir = options?.authDir || DEFAULT_AUTH_DIR;
    const baseMediaDir = options?.mediaDir || DEFAULT_MEDIA_DIR;
    ensureDirectoryExists(baseAuthDir);
    ensureDirectoryExists(baseMediaDir);
    this.authDir = path.join(baseAuthDir, id);
    this.mediaDir = path.join(baseMediaDir, id);
    ensureDirectoryExists(this.authDir);
    ensureDirectoryExists(this.mediaDir);
    logger.info(`Created WhatsApp client instance with ID: ${id}`);

    
  }

  

  /******************************************************************************** 
   * 
   * Connect
   * 
   ********************************************************************************/
  async connect(): Promise<void> {
    try {
      // Clean up previous socket if any
      await cleanupSocket(this.socket, logger);

      updateState(this, WhatsAppClientState.Waiting, logger);
      
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion();

      // Initialize the WhatsApp socket with our logger
      this.socket = makeWASocket({
        version,
        auth: state,
        logger: createBaileysLogger(logger),
        printQRInTerminal: false,
        browser: ['FS04 WhatsApp', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        qrTimeout: 60000
      });

      this.socket.ev.on('creds.update', saveCreds);
      this.socket.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
      this.socket.ev.on('messages.upsert', this.handleMessages.bind(this));
      this.socket.ev.on('contacts.update', this.handleContactsUpdate.bind(this));
      this.socket.ev.on('chats.upsert', this.handleChatsUpsert.bind(this));
      this.socket.ev.on('chats.update', this.handleChatsUpdate.bind(this));

      // Check for existing auth files for session restoration
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
        logger.info(
          `Reconnecting (${this.reconnectCount}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`
        );
        setTimeout(() => this.connect(), this.reconnectDelay);
      }
    }
  }

  /******************************************************************************** 
   * 
   * Handle connection update
   * 
   ********************************************************************************/
  private handleConnectionUpdate(update: any): void {
   
    const { connection, lastDisconnect, qr } = update;

    logger.debug(`Connection update for client ${this.id}: ${JSON.stringify(update)}`);

    if (qr) {
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
   * 
   * Handle messages
   * 
   ********************************************************************************/
  private handleMessages(messagesUpsert: any): void {
    if (messagesUpsert.type !== 'notify') return;
    const messages = messagesUpsert.messages || [];
    for (const message of messages) {
      try {
        const formatted = this.formatMessage(message);
        if (!formatted) continue;
        // Skip state sync messages
        if (formatted.type === 'app_state_sync') continue;
        const isNotification =
          formatted.content.startsWith('[') &&
          formatted.content.endsWith(']') &&
          (formatted.content.includes('Status:') || formatted.content === '[Notification]');
        const isHistorySync = message.message?.protocolMessage?.type === 'HISTORY_SYNC_NOTIFICATION';
        if (!isNotification || formatted.content !== '[Notification]') {
          (formatted as any)._rawMessage = message;
          if (['unknown', 'deleted', 'reaction'].includes(formatted.type) || isHistorySync) {
            logger.debug(`Special message type detected: ${formatted.type}`);
          }
          if (!isHistorySync) {
            this.emit('message', formatted);
          }
        }
      } catch (error) {
        logger.error(`Error processing message: ${error}`);
      }
    }
  }

  private extractQuotedMessage(contextInfo: any): {
    isReply: boolean;
    replyToMessageId: string;
    replyToMessage: string;
    replyToParticipant: string;
  } {
    let replyToMessage = '';
    if (contextInfo.quotedMessage.conversation) {
      replyToMessage = contextInfo.quotedMessage.conversation;
    } else if (contextInfo.quotedMessage.extendedTextMessage) {
      replyToMessage = contextInfo.quotedMessage.extendedTextMessage.text;
    } else if (contextInfo.quotedMessage.imageMessage) {
      replyToMessage = contextInfo.quotedMessage.imageMessage.caption || '[Image]';
    } else if (contextInfo.quotedMessage.videoMessage) {
      replyToMessage = contextInfo.quotedMessage.videoMessage.caption || '[Video]';
    } else if (contextInfo.quotedMessage.audioMessage) {
      replyToMessage = '[Audio]';
    } else if (contextInfo.quotedMessage.documentMessage) {
      replyToMessage = contextInfo.quotedMessage.documentMessage.fileName || '[Document]';
    } else {
      replyToMessage = '[Unknown message type]';
    }
    return {
      isReply: true,
      replyToMessageId: contextInfo.stanzaId || '',
      replyToMessage,
      replyToParticipant: contextInfo.participant || ''
    };
  }

  /******************************************************************************** 
   * 
   * Format message
   * 
   ********************************************************************************/    
  private formatMessage(rawMessage: any): WhatsAppMessage | null {
    // Early return for APP_STATE_SYNC_KEY_SHARE messages
    const isAppStateSync =
      rawMessage?.message?.protocolMessage?.type === 'APP_STATE_SYNC_KEY_SHARE' ||
      rawMessage?.protocolMessage?.type === 'APP_STATE_SYNC_KEY_SHARE';
    if (isAppStateSync) {
      logger.debug('Detected APP_STATE_SYNC_KEY_SHARE message');
      return {
        id: rawMessage.key?.id || crypto.randomUUID(),
        from: rawMessage.key?.fromMe ? 'me' : rawMessage.key?.remoteJid || 'unknown',
        to: rawMessage.key?.fromMe ? rawMessage.key?.remoteJid : 'me',
        content: '[State Sync Message]',
        timestamp: Date.now(),
        isFromMe: rawMessage.key?.fromMe || false,
        type: 'app_state_sync'
      };
    }
    try {
      if (!rawMessage || !rawMessage.key) {
        logger.debug(`Invalid message format: ${JSON.stringify(rawMessage)}`);
        return null;
      }
      const { key } = rawMessage;
      const messageId = key.id;
      const fromMe = key.fromMe;
      const from = fromMe ? (this.socket?.user?.id || 'me') : key.remoteJid;
      const to = fromMe ? key.remoteJid : (this.socket?.user?.id || 'me');
      const timestamp = rawMessage.messageTimestamp * 1000;
      let content = '';
      let type: WhatsAppMessage['type'] = 'unknown';
      let mediaUrl = '';
      let caption = '';
      let fileName = '';
      let fileSize = 0;
      let mimetype = '';
      let isReply = false,
        replyToMessageId = '',
        replyToMessage = '',
        replyToParticipant = '';
      const msgContent = rawMessage.message;
      if (!msgContent || Object.keys(msgContent).length === 0) {
        if (rawMessage.messageStubType) {
          type = 'unknown';
          content = `[Status: ${rawMessage.messageStubType}]`;
          switch (rawMessage.messageStubType) {
            case 1:
              content = '[Status: Message revoked]';
              break;
            case 2:
              content = '[Status: Group created]';
              break;
            case 3:
              content = '[Status: Group settings updated]';
              break;
            case 4:
              content = '[Status: Group participant added]';
              break;
            case 5:
              content = '[Status: Group participant removed]';
              break;
            case 6:
              content = '[Status: Group participant promoted]';
              break;
            case 7:
              content = '[Status: Group participant demoted]';
              break;
            case 8:
              content = '[Status: Group name updated]';
              break;
          }
        } else {
          content = '[Notification]';
        }
        logger.debug(`Status/notification message: ${content}`);
      } else if (msgContent.conversation) {
        content = msgContent.conversation;
        type = 'text';
      } else if (msgContent.extendedTextMessage) {
        content = msgContent.extendedTextMessage.text || '';
        type = 'text';
        if (msgContent.extendedTextMessage.contextInfo?.quotedMessage) {
          const quoted = msgContent.extendedTextMessage.contextInfo;
          ({ isReply, replyToMessageId, replyToMessage, replyToParticipant } = this.extractQuotedMessage(quoted));
        }
      } else if (msgContent.imageMessage) {
        type = 'image';
        caption = msgContent.imageMessage.caption || '';
        content = caption || '[Image]';
        mimetype = msgContent.imageMessage.mimetype;
        fileSize = msgContent.imageMessage.fileLength;
      } else if (msgContent.videoMessage) {
        type = 'video';
        caption = msgContent.videoMessage.caption || '';
        content = caption || '[Video]';
        mimetype = msgContent.videoMessage.mimetype;
        fileSize = msgContent.videoMessage.fileLength;
      } else if (msgContent.audioMessage) {
        type = 'audio';
        content = '[Audio]';
        mimetype = msgContent.audioMessage.mimetype;
        fileSize = msgContent.audioMessage.fileLength;
      } else if (msgContent.documentMessage) {
        type = 'document';
        fileName = msgContent.documentMessage.fileName || '';
        content = fileName || '[Document]';
        mimetype = msgContent.documentMessage.mimetype;
        fileSize = msgContent.documentMessage.fileLength;
        caption = msgContent.documentMessage.caption || '';
      } else if (msgContent.documentWithCaptionMessage) {
        const docMsg = msgContent.documentWithCaptionMessage.message?.documentMessage;
        if (docMsg) {
          type = 'document';
          fileName = docMsg.fileName || '';
          content = fileName || '[Document]';
          mimetype = docMsg.mimetype;
          fileSize = docMsg.fileLength;
          caption = docMsg.caption || '';
        } else {
          type = 'document';
          content = '[Document with caption]';
        }
      } else if (msgContent.locationMessage) {
        type = 'location';
        content = `[Location: ${msgContent.locationMessage.degreesLatitude},${msgContent.locationMessage.degreesLongitude}]`;
      } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
        type = 'contact';
        content = '[Contact]';
      } else if (msgContent.stickerMessage) {
        type = 'unknown';
        content = '[Sticker]';
      } else if (msgContent.reactionMessage) {
        type = 'reaction';
        content = `[Reaction: ${msgContent.reactionMessage.text || ''}]`;
      } else {
        logger.debug(`Unknown message type: ${JSON.stringify(msgContent)}`);
        if (msgContent.protocolMessage && msgContent.protocolMessage.type === 0) {
          content = '[Message deleted]';
          type = 'deleted';
        } else if (msgContent.reactionMessage) {
          content = `[Reaction: ${msgContent.reactionMessage.text || ''}]`;
          type = 'reaction';
        } else {
          content = '[Unknown message type]';
        }
      }
      if (msgContent && msgContent.contextInfo?.quotedMessage) {
        const quoted = msgContent.contextInfo;
        ({ isReply, replyToMessageId, replyToMessage, replyToParticipant } = this.extractQuotedMessage(quoted));
      }
      return {
        id: messageId,
        from,
        to,
        content,
        timestamp,
        isFromMe,
        type,
        mediaUrl,
        caption,
        fileName,
        fileSize,
        mimetype,
        isReply,
        replyToMessageId,
        replyToMessage,
        replyToParticipant
      };
    } catch (error) {
      logger.error(`Error formatting message: ${error}`);
      return null;
    }
  }

  /******************************************************************************** 
   * 
   * Handle contacts update
   * 
   ********************************************************************************/    
  private handleContactsUpdate(contacts: any[]): void {
    logger.debug(`Contacts update for client ${this.id}: ${contacts.length} contacts`);
    this.emit('contacts', contacts);
  }

  /******************************************************************************** 
   * 
   * Handle chats upsert
   * 
   ********************************************************************************/    
  private handleChatsUpsert(chats: any[]): void {
    logger.debug(`Chats upsert for client ${this.id}: ${chats.length} chats`);
    this.emit('chats', chats);
  }

  /******************************************************************************** 
   * 
   * Handle chats update
   * 
   ********************************************************************************/    
  private handleChatsUpdate(chats: any[]): void {
    logger.debug(`Chats update for client ${this.id}: ${chats.length} chats`);
    this.emit('chats_update', chats);
  }

  /******************************************************************************** 
   * 
   * Send text message
   * 
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
   * 
   * Setup QR code refresh timer
   * 
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
   * 
   * Disconnect
   * 
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
   * 
   * Clear auth files
   * 
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
   * 
   * Setters and Setters
   * 
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

  /******************************************************************************** 
   * 
   * Info
   * 
   ********************************************************************************/    
  getInfo(): any{
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
   * 
   * Pairing
   * 
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

  /******************************************************************************** 
   * 
   * Media
   * 
   ********************************************************************************/    
  async downloadMedia(message: WhatsAppMessage | string): Promise<string | null> {
    try {
      if (!this.socket || this.state !== WhatsAppClientState.Connected) {
        throw new Error('Client not connected');
      }
      let formattedMessage: WhatsAppMessage;
      let rawMessage: any;
      if (typeof message === 'string') {
        throw new Error('Message ID-based download not implemented yet');
      } else {
        formattedMessage = message;
        rawMessage = (formattedMessage as any)._rawMessage;
        if (!rawMessage) {
          throw new Error('Raw message data not available for download');
        }
      }
      if (!['image', 'video', 'audio', 'document'].includes(formattedMessage.type)) {
        throw new Error(`Message type ${formattedMessage.type} does not contain downloadable media`);
      }
      ensureDirectoryExists(this.mediaDir);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hash = crypto.createHash('md5').update(formattedMessage.id).digest('hex').substring(0, 8);
      let extension = formattedMessage.mimetype ? formattedMessage.mimetype.split('/').pop() || formattedMessage.type : formattedMessage.type;
      let filename = '';
      if (formattedMessage.type === 'document' && formattedMessage.fileName) {
        const originalExt = path.extname(formattedMessage.fileName);
        const originalName = path.basename(formattedMessage.fileName, originalExt);
        filename = `${originalName}_${hash}_${timestamp}${originalExt || `.${extension}`}`;
      } else {
        filename = `${formattedMessage.type}_${hash}_${timestamp}.${extension}`;
      }
      filename = filename.replace(/[\\/:*?"<>|]/g, '_');
      const mediaPath = path.join(this.mediaDir, filename);
      logger.info(`Downloading media from message ${formattedMessage.id}...`);
      const buffer = await downloadMediaMessage(rawMessage, 'buffer', {}, { logger, reuploadRequest: this.socket.updateMediaMessage });
      fs.writeFileSync(mediaPath, buffer);
      logger.info(`Media saved to ${mediaPath}`);
      formattedMessage.mediaUrl = path.join(this.id, filename);
      this.emit('media', { message: formattedMessage, path: formattedMessage.mediaUrl });
      return formattedMessage.mediaUrl;
    } catch (error) {
      logger.error(`Error downloading media: ${error}`);
      return null;
    }
  }
}
