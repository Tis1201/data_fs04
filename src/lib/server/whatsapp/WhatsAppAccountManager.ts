import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import { logger } from '$lib/server/logger';
import { WhatsAppAccountClient } from './WhatsAppAccountClient';
import type { WhatsAppClientState, WhatsAppMessage } from './WhatsAppAccountClient';
import { eventRouter, EventType } from '../event/EventRouter';
import { getEnhancedPrisma } from '$lib/server/prisma';

export interface WhatsAppManagerOptions {
  authDir?: string;
  mediaDir?: string;
  auth?: {};
}



export class WhatsAppAccountManager extends EventEmitter {
  // Store for all WhatsApp clients.
  private clients = new Map<string, WhatsAppAccountClient>();

  private options: WhatsAppManagerOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60000; // Every minute.
  private readonly MAX_AWAITING_SCAN_MS = 300000; // 5 minutes.
  private prisma: any;

  constructor(options?: WhatsAppManagerOptions) {
    super();
    this.options = options || {};
    logger.info('WhatsApp Account Manager initialized');
    this.startCleanupInterval();
    this.prisma = getEnhancedPrisma({ id: '', systemRole: 'ADMIN' });
  }

  /***********************************
   * QR Code Generation and Promises *
   ***********************************/
  private createQRCodePromise(client: WhatsAppAccountClient, immediateCheck: boolean): Promise<string> {
    return new Promise<string>((resolve) => {
      if (immediateCheck && client.getState() === 'connected') {
        resolve('');
      } else {
        client.once('qr', (qrCode: string) => resolve(qrCode));
        if (!immediateCheck) {
          client.once('connected', () => resolve(''));
        }
      }
    });
  }

  /*******************************************
   * Client Creation / Restoration Functions *
   *******************************************/
  public async createNewClient(createdBy: string): Promise<{ clientId: string; qrCodePromise: Promise<string>; restored: boolean }> {
    const client = new WhatsAppAccountClient(undefined, undefined, undefined, createdBy);
    // client.setCreatedBy(createdBy);
    await client.init();
    
    this.clients.set(client.getId(), client);

    // Set up event listeners.
    this.setupClientEventListeners(client, client.getId());

    const qrCodePromise = this.createQRCodePromise(client, false);
    await client.connect();
    return { clientId: client.getId(), qrCodePromise, restored: false };
  }

  public async createClient(createdBy: string): Promise<{ clientId: string; qrCodePromise: Promise<string> }> {
    try {
      const result = await this.createNewClient(createdBy);
      const client = this.getClient(result.clientId);
      if (client) {
        client.setCreatedBy(createdBy);
        logger.info(`Associated WhatsApp client ${result.clientId} with user ${createdBy}`);
      }
      return { clientId: result.clientId, qrCodePromise: result.qrCodePromise };
    } catch (error) {
      logger.error(`Error creating WhatsApp client: ${error}`);
      throw error;
    }
  }

  public async restoreOrCreateClient(
    sessionId?: string | null,
    phoneNumber?: string,
    accountId?: string,
    options?: WhatsAppManagerOptions
  ): Promise<{ clientId: string; qrCodePromise: Promise<string>; restored: boolean }> {
    try {
      // If the client is already active in memory.
      if (sessionId && this.clients.has(sessionId)) {
        logger.info(`Client with session ID ${sessionId} is already active in memory`);
        const client = this.clients.get(sessionId)!;
        const qrCodePromise = this.createQRCodePromise(client, true);
        if (client.getState() === 'disconnected') {
          await client.connect();
        }
        return { clientId: sessionId, qrCodePromise, restored: true };
      }

      // Restore if session files exist on disk.
      if (sessionId && this.sessionExists(sessionId)) {
        logger.info(`Restoring WhatsApp client from existing session ${sessionId}`);
        const clientOpts = {
          authDir: this.options.authDir,
          mediaDir: this.options.mediaDir,
        };
        const client = new WhatsAppAccountClient(sessionId, phoneNumber, accountId, clientOpts);
        this.clients.set(sessionId, client);
        const qrCodePromise = this.createQRCodePromise(client, false);
        this.setupClientEventListeners(client, sessionId, accountId);
        await client.connect();
        return { clientId: sessionId, qrCodePromise, restored: true };
      }

      // Otherwise, create a new client.
      logger.info(`Creating new WhatsApp client with session ID ${sessionId}`);
      return await this.createNewClient(sessionId!);
    } catch (error) {
      logger.error(`Error restoring or creating WhatsApp client: ${error}`);
      throw error;
    }
  }

  /****************************
   * Client Retrieval Methods *
   ****************************/
  public getClient(clientId: string): WhatsAppAccountClient | undefined {
    return this.clients.get(clientId);
  }

  public getAllClients(): WhatsAppAccountClient[] {
    return Array.from(this.clients.values());
  }

  public getClientInfo(clientId: string): any | null {
    const client = this.getClient(clientId);
    return client ? client.getInfo() : null;
  }

  public getAllClientsInfo(): any[] {
    return this.getAllClients().map((client) => client.getInfo());
  }

  public async disconnectClient(clientId: string): Promise<boolean> {
    const client = this.getClient(clientId);
    if (!client) return false;
    try {
      const success = await client.disconnect();
      if (success) {
        this.clients.delete(clientId);
      }
      return success;
    } catch (error) {
      logger.error(`Error disconnecting client ${clientId}: ${error}`);
      return false;
    }
  }

  /***********************************
   * Session/File System Management  *
   ***********************************/
  public sessionExists(sessionId: string): boolean {
    const baseAuthDir = this.options.authDir || DEFAULT_AUTH_DIR;
    const sessionDir = path.join(baseAuthDir, sessionId);
    return fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
  }

  /***********************************
   * Client Event Listener Setup     *
   ***********************************/
  private setupClientEventListeners(
    client: WhatsAppAccountClient,
    clientId: string,
    accountId?: string,
    qrCodeResolve?: (value: string) => void
  ): void {
    if (qrCodeResolve) {
      client.once('qr', (qrCode: string) => {
        qrCodeResolve(qrCode);
      });
    }

    client.on('qr', (qrCode: string) => {
      const userId = client.getCreatedBy();
      if (userId) {
        logger.info(`Sending QR code for client ${clientId} to user ${userId}: ${qrCode}`);
        eventRouter.sendPrivateMessage(
          userId,
          { type: 'whatsapp', action: 'qrCode', data: { clientId, qrCode, accountId: accountId || null } },
          EventType.WHATSAPP_MESSAGE
        );
      } else {
        logger.warn(`No user ID associated with client ${clientId}; QR code cannot be delivered`);
      }
    });

    client.on('state', (state: WhatsAppClientState) => {
      if (accountId) {
        this.updateAccountStatus(accountId, state, clientId);
      }
      const pushName = client.getPushName();
      const phoneNumber = client.getPhoneNumber();
      logger.info(`Client state update for ${clientId}: state=${state}, pushName=${pushName}, phoneNumber=${phoneNumber}`);
      eventRouter.sendPrivateMessage(
        client.getCreatedBy()!,
        { action: state, data: { clientId, state, pushName, phoneNumber } },
        EventType.WHATSAPP_MESSAGE
      );
      logger.debug(`Number of whatsappclients: ${this.clients.size}`);
    });

    client.on('message', (message: WhatsAppMessage) => {
      const userId = client.createdBy;
      if (userId) {
        logger.info(`Sending WhatsApp message to user ${userId} for client ${clientId}`);
        eventRouter.sendPrivateMessage(
          userId,
          { type: 'whatsapp', action: 'message', data: { clientId, message } },
          EventType.WHATSAPP_MESSAGE
        );
      } else {
        logger.warn(`No user ID associated with client ${clientId}; message cannot be delivered`);
      }
    });
  }

  /***********************************
   * Message and Pairing Functions   *
   ***********************************/
  public async sendMessage(clientId: string, to: string, text: string): Promise<string | null> {
    const client = this.getClient(clientId);
    if (!client) {
      logger.error(`Client ${clientId} not found`);
      return null;
    }
    return client.sendTextMessage(to, text);
  }

  public async generatePairingCode(clientId: string): Promise<string | null> {
    const client = this.getClient(clientId);
    if (!client) {
      logger.error(`Client ${clientId} not found`);
      return null;
    }
    return client.generatePairingCode();
  }

  /***********************************
   * Account Status and DB Updates   *
   ***********************************/
  private async updateAccountStatus(accountId: string, status: WhatsAppClientState, clientId?: string): Promise<void> {
    logger.info(`Account ${accountId} status updated to ${status}${clientId ? ` (client ID: ${clientId})` : ''}`);
    // TODO: Implement actual database update logic.
  }

  /***********************************
   * Client Initialization from DB   *
   ***********************************/
  public async initializeClientsFromDatabase(): Promise<void> {
    logger.info('Initializing WhatsApp clients from database');
    try {
      const accounts = await this.prisma.whatsAppAccount.findMany();
      logger.info(`Found ${accounts.length} WhatsApp accounts to initialize`);

      for (const account of accounts) {
        try {
          const client = new WhatsAppAccountClient(account.client_id);
          client.setAccountId(account.id);
          client.setCreatedBy(account.createdBy);
          this.clients.set(account.client_id, client);
          this.setupClientEventListeners(client, account.client_id, account.id);
          await client.connect();
          logger.info(`Initialized WhatsApp client for account ${account.id} (${account.description})`);
        } catch (clientError) {
          logger.error(`Failed to initialize WhatsApp client for account ${account.id}: ${clientError}`);
          await this.prisma.whatsAppAccount.update({
            where: { id: account.id },
            data: { client_status: 'disconnected' }
          });
        }
      }
      logger.info(`Successfully initialized ${this.clients.size} WhatsApp clients`);
    } catch (error) {
      logger.error(`Error initializing clients from database: ${error}`);
    }
  }

  /***********************************
   * Cleanup and Optimization        *
   ***********************************/
  private startCleanupInterval(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.cleanupInterval = setInterval(() => this.cleanupStaleClients(), this.CLEANUP_INTERVAL_MS);
    logger.info(`Started client cleanup interval (every ${this.CLEANUP_INTERVAL_MS / 1000} seconds)`);
  }

  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped client cleanup interval');
    }
  }

  private async cleanupStaleClients(): Promise<void> {
    const now = Date.now();
    const staleClientIds: string[] = [];
    for (const [clientId, client] of this.clients.entries()) {
      if (client.getState() === 'awaiting_scan' && now - client.getCreatedAt() > this.MAX_AWAITING_SCAN_MS) {
        staleClientIds.push(clientId);
      }
    }
    if (staleClientIds.length > 0) {
      logger.info(`Found ${staleClientIds.length} stale clients to clean up`);
      for (const clientId of staleClientIds) {
        try {
          const client = this.clients.get(clientId);
          if (client) {
            await client.disconnect();
            this.clients.delete(clientId);
            logger.info(`Cleaned up stale client ${clientId} (awaiting_scan too long)`);
          }
        } catch (error) {
          logger.error(`Error cleaning up stale client ${clientId}: ${error}`);
        }
      }
    }
  }
}

// Export a singleton instance.
export const whatsAppAccountManager = new WhatsAppAccountManager();
