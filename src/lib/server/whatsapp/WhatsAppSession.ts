import pkg from '@whiskeysockets/baileys';
const { default: makeWASocket, DisconnectReason } = pkg;
import type { WASocket, AuthenticationState, AnyMessageContent } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { usePrismaAuthState } from './usePrismaAuthState';
import { PrismaClient } from '@prisma/client';

export class WhatsAppSession {
  private prisma: PrismaClient;
  private session_id: string;
  private sock: WASocket | null = null;
  private logger = P({ level: 'warn', prettyPrint: false });
  private saveCreds!: () => Promise<void>;
  private state!: AuthenticationState;
  private transcient: boolean = false;

  constructor(prisma: PrismaClient, session_id?: string) {
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
      auth: this.state,
      logger: this.logger,
      printQRInTerminal: false,
      syncFullHistory: false,
    });

    this.setupListeners();
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
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[${this.session_id}] QR Code:\n`);
      console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      console.warn(`[${this.session_id}] Connection closed with code ${statusCode}`);

      if (statusCode === DisconnectReason.restartRequired) {
        console.log(`[${this.session_id}] Restarting connection...`);
        this.transcient = true;
        this.createSocket();
      }
    }

    if (connection === 'open') {
      console.log(`[${this.session_id}] Connection established.`);
      const user = this.sock?.user;

      if(this.transcient){
        if (user) {
          const phoneNumber = user.id?.split(':')[0]; // e.g. "658123456789"
          const pushName = user.name || user.verifiedName;
          console.log(`[${this.session_id}] Logged in as ${pushName} (${phoneNumber})`);
        } else {
          console.warn(`[${this.session_id}] User info not found.`);
        }
        this.transcient = false;
      }

    }
  };

  private handleMessageUpsert = ({ messages }: any) => {
    const msg = messages[0];
    if (!msg.message) return;
    console.log(`[${this.session_id}] New message from ${msg.key.remoteJid}:`, msg.message);
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
      isConnected: !!this.sock?.user,
    };
  }
}
