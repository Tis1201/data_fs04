import { EventEmitter } from 'events';
import pkg from '@whiskeysockets/baileys';
const { default: makeWASocket, DisconnectReason, makeCacheableSignalKeyStore } = pkg;
import type { WASocket, AuthenticationState, AnyMessageContent, proto } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { usePrismaAuthState } from './usePrismaAuthState';
import { PrismaClient } from '@prisma/client';
import NodeCache from 'node-cache';

export interface WhatsAppSessionEvents {
  'qrcode': (qr: string) => void;
  'authenticated': () => void;
  'auth_failure': (msg: string) => void;
  'ready': () => void;
  'disconnected': (reason: string) => void;
  'message': (message: proto.IWebMessageInfo) => void;
  'error': (error: Error) => void;
}

declare interface WhatsAppSession {
  on<U extends keyof WhatsAppSessionEvents>(
    event: U,
    listener: WhatsAppSessionEvents[U]
  ): this;

  emit<U extends keyof WhatsAppSessionEvents>(
    event: U,
    ...args: Parameters<WhatsAppSessionEvents[U]>
  ): boolean;
}

export class WhatsAppSession extends EventEmitter {
  private prisma: PrismaClient;
  private session_id: string;
  private sock: WASocket | null = null;
  private logger = P({ level: 'warn', prettyPrint: false });
  private saveCreds!: () => Promise<void>;
  private state!: AuthenticationState;
  
  // Caches
  private groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false }); // 5 minute TTL for group metadata
  private msgRetryCounterCache = new NodeCache(); // For tracking message retries

  constructor(prisma: PrismaClient, session_id?: string) {
    super();
    this.prisma = prisma;
    this.session_id = session_id ?? uuidv4();
    this.logger.info(`Session ${this.session_id} initialized`);
  }

  public getSessionId() {
    return this.session_id;
  }

  public async init() {
    const { state, saveCreds } = await usePrismaAuthState(this.session_id, this.prisma, `auth/${this.session_id}`);
    this.state = state;
    this.saveCreds = saveCreds;
    this.createSocket();
  }

  private createSocket() {
    if (this.sock) this.teardownListeners();

    this.sock = makeWASocket({
      auth: {
        creds: this.state.creds,
        keys: makeCacheableSignalKeyStore(this.state.keys, this.logger),
      },
      logger: this.logger,
      printQRInTerminal: false,
      syncFullHistory: false,
      browser: ['WhatsApp Web', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: true,
      // Caching
      cachedGroupMetadata: async (jid) => this.groupCache.get(jid),
      msgRetryCounterCache: this.msgRetryCounterCache,
    });

    // Setup cache updates
    this.setupCacheUpdates();
    this.setupListeners();
  }

  private setupCacheUpdates() {
    if (!this.sock) return;

    // Update cache when group metadata changes
    this.sock.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        if (update.id) {
          try {
            const metadata = await this.sock?.groupMetadata(update.id);
            if (metadata) {
              this.groupCache.set(update.id, metadata);
            }
          } catch (error) {
            this.logger.error(`Error updating group cache for ${update.id}:`, error);
          }
        }
      }
    });
  }

  private setupListeners() {
    if (!this.sock) return;

    this.sock.ev.on('connection.update', this.handleConnectionUpdate);
    this.sock.ev.on('creds.update', this.saveCreds);
    this.sock.ev.on('messages.upsert', this.handleMessageUpsert);
  }

  private teardownListeners() {
    if (!this.sock) return;

    this.sock.ev.removeAllListeners('connection.update');
    this.sock.ev.removeAllListeners('creds.update');
    this.sock.ev.removeAllListeners('messages.upsert');
  }

  private handleConnectionUpdate = async (update: any) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    try {
      if (qr) {
        // const qrCode = await QRCode.toString(qr, { type: 'terminal', small: true });
        // console.log(`[${this.session_id}] QR Code:\n`);
        // console.log(qrCode);
        this.emit('qrcode', qr);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        
        console.warn(`[${this.session_id}] Connection closed with code ${statusCode}: ${errorMessage}`);
        this.emit('disconnected', `Connection closed: ${errorMessage}`);

        if (statusCode === DisconnectReason.restartRequired) {
          console.log(`[${this.session_id}] Restarting connection...`);
          this.createSocket();
        }
      }

      if (connection === 'open') {
        const user = this.sock?.user;
        
        // Emit authenticated if we have a user and either it's a new login or we're not sure
        if (user) {
          const phoneNumber = user.id?.split(':')[0];
          const pushName = user.name || user.verifiedName;
          
          if (isNewLogin) {
            console.log(`[${this.session_id}] New login detected for ${pushName} (${phoneNumber})`);
          }
          
          console.log(`[${this.session_id}] Logged in as ${pushName} (${phoneNumber})`);
          this.emit('authenticated');
        } else {
          console.warn(`[${this.session_id}] Connected but no user information available`);
        }

        console.log(`[${this.session_id}] Connection established.`);
        this.emit('ready');
      }
    } catch (error) {
      console.error(`[${this.session_id}] Error in connection update:`, error);
      this.emit('error', error as Error);
    }
  };

  private handleMessageUpsert = ({ messages }: { messages: proto.IWebMessageInfo[] }) => {
    const msg = messages[0];
    if (!msg.message) return;
    
    console.log(`[${this.session_id}] New message from ${msg.key.remoteJid}`);
    this.emit('message', msg);
  };

  public async sendMessage(jid: string, content: AnyMessageContent) {
    if (!this.sock) throw new Error("Socket not initialized");
    await this.sock.sendMessage(jid, content);
  }

  public async shutdown() {
    if (this.sock) {
      this.teardownListeners();
      await this.sock.logout();
    }
  }

  public getInfo() {
    return {
      session_id: this.session_id,
      isConnected: this.sock?.ws.readyState === 'OPEN',
      user: this.sock?.user,
      connectionStatus: this.sock?.ws.readyState
    };
  }
  
  public isConnected(): boolean {
    return this.sock?.ws.readyState === 'OPEN';
  }
}
