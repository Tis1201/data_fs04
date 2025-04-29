import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import { logger } from '$lib/server/logger';
import { WhatsAppAccountClient } from './WhatsAppAccountClient';
import type { WhatsAppClientState } from './WhatsAppAccountClient';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { DEFAULT_AUTH_DIR } from './WhatsAppAccountClient';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
// import type { UserInfo } from '$lib/server/messaging/interfaces/connection';

export interface WhatsAppManagerOptions {
  authDir?: string;
  mediaDir?: string;
}

/**
 * WhatsAppAccountManager
 * 
 * A simplified manager that handles WhatsApp client instances.
 * Responsibilities:
 * - Client lifecycle management (creation, restoration, cleanup)
 * - Client registry (tracking active clients)
 * - Database synchronization
 */
export class WhatsAppAccountManager extends EventEmitter {
  // Store for all WhatsApp clients
  private clients = new Map<string, WhatsAppAccountClient>();
  private options: WhatsAppManagerOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60000; // Every minute
  private readonly MAX_AWAITING_SCAN_MS = 300000; // 5 minutes
  private prisma: any;

  constructor(options?: WhatsAppManagerOptions) {
    super();
    this.options = options || {};
    logger.info('WhatsApp Account Manager initialized');
    this.startCleanupInterval();
    this.prisma = getEnhancedPrisma({ id: '', systemRole: 'ADMIN' });
  }

  /**
   * Creates a new WhatsApp client instance
   */
  public async createClient(createdBy: string): Promise<{ clientId: string }> {
    try {
      // Create a new client instance
      const client = new WhatsAppAccountClient(undefined, undefined, undefined, createdBy, this.options);
      await client.init();
      
      // Register the client
      const clientId = client.getId();
      this.clients.set(clientId, client);
      
      // Set up client event forwarding
      this.setupClientEvents(client);
      
      // Connect the client
      await client.connect();
      
      logger.info(`Created new WhatsApp client ${clientId} for user ${createdBy}`);
      return { clientId };
    } catch (error) {
      logger.error(`Error creating WhatsApp client: ${error}`);
      throw error;
    }
  }

  /**
   * Restores an existing client or creates a new one
   * 
   * @param sessionId - Optional ID of an existing session to restore
   * @param userId - ID of the user who owns this client
   * @returns Object containing the client ID and whether it was restored
   */
  public async restoreOrCreateClient(
    sessionId: string | null | undefined,
    userId: string
  ): Promise<{ clientId: string; restored: boolean }> {
    try {
      // If the client is already active in memory
      if (sessionId && this.clients.has(sessionId)) {
        logger.info(`Client with session ID ${sessionId} is already active in memory`);
        const client = this.clients.get(sessionId)!;
        
        if (client.getState() === 'disconnected') {
          await client.connect();
        }
        return { clientId: sessionId, restored: true };
      }

      // Restore if session files exist on disk
      if (sessionId && this.sessionExists(sessionId)) {
        logger.info(`Restoring WhatsApp client from existing session ${sessionId}`);
        const client = new WhatsAppAccountClient(sessionId, undefined, undefined, userId, this.options);
        
        // Register the client
        this.clients.set(sessionId, client);
        this.setupClientEvents(client);
        
        // Connect the client
        await client.connect();
        
        return { clientId: sessionId, restored: true };
      }

      // Otherwise, create a new client
      logger.info(`Creating new WhatsApp client for user ${userId}`);
      const { clientId } = await this.createClient(userId);
      return { clientId, restored: false };
    } catch (error) {
      logger.error(`Error restoring or creating WhatsApp client: ${error}`);
      throw error;
    }
  }

  /**
   * Sets up event listeners for client state changes
   */
  private setupClientEvents(client: WhatsAppAccountClient): void {
    // Helper to get account ID safely
    const getAccountId = () => {
      const accountId = client.getAccountId();
      return accountId || undefined;
    };
    
    // Forward connection state changes
    client.on('connection_state', (state: WhatsAppClientState) => {
      this.emit('client_state_change', {
        clientId: client.getId(),
        state,
        accountId: getAccountId()
      });
      
      // Update account status in database
      this.updateAccountStatus(getAccountId(), state, client.getId());
    });
  }

  /**
   * Client retrieval methods
   */
  public getClient(id: string): WhatsAppAccountClient | null {
    return this.clients.get(id) || null;
  }

  public getClientsByUserId(userId: string): WhatsAppAccountClient[] {
    return Array.from(this.clients.values()).filter(client => client.getCreatedBy() === userId);
  }

  public getAllClients(): WhatsAppAccountClient[] {
    return Array.from(this.clients.values());
  }

  public getClientInfo(clientId: string): any | null {
    const client = this.getClient(clientId);
    return client ? client.getInfo() : null;
  }

  public getAllClientsInfo(): any[] {
    return this.getAllClients().map(client => client.getInfo());
  }

  /**
   * Disconnects a client and removes it from the registry
   */
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

  /**
   * Checks if a session exists on disk
   */
  public sessionExists(sessionId: string): boolean {
    const baseAuthDir = this.options.authDir || DEFAULT_AUTH_DIR;
    const sessionDir = path.join(baseAuthDir, sessionId);
    return fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
  }

  /**
   * Updates account status in the database
   * 
   * @param accountId - Optional account ID to update in the database
   * @param status - New client state
   * @param clientId - ID of the client
   */
  private async updateAccountStatus(accountId?: string, status?: WhatsAppClientState, clientId?: string): Promise<void> {
    // Skip database update if no account ID is provided
    if (!accountId) {
      logger.debug(`No account ID available for client ${clientId}, skipping status update`);
      return;
    }
    
    logger.info(`Account ${accountId} status updated to ${status}${clientId ? ` (client ID: ${clientId})` : ''}`);
    
    try {
      await this.prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: { client_status: status }
      });
    } catch (error) {
      logger.error(`Error updating account status: ${error}`);
    }
  }

  /**
   * Initializes clients from the database
   */
  public async initializeClientsFromDatabase(): Promise<void> {
    logger.info('Initializing WhatsApp clients from database');
    
    try {
      const accounts = await this.prisma.whatsAppAccount.findMany();
      logger.info(`Found ${accounts.length} WhatsApp accounts to initialize`);

      for (const account of accounts) {
        try {
          // Fetch user info for the account creator
          const userInfo = await userInfoByUserId(account.createdBy);
          if (!userInfo) {
            logger.warn(`Could not find user info for account ${account.id} creator (${account.createdBy}), skipping initialization`);
            continue;
          }
          
          const client = new WhatsAppAccountClient(
            account.client_id, 
            account.phone_number, 
            account.id, 
            account.createdBy, 
            this.options
          );
          
          // Set the userInfo on the client to enable message routing
          client.setUserInfo(userInfo);
          
          // Register the client
          this.clients.set(account.client_id, client);
          this.setupClientEvents(client);
          
          // Connect the client
          await client.connect();
          logger.info(`Initialized WhatsApp client for account ${account.id} (${account.description}) with user info`);
        } catch (error) {
          logger.error(`Failed to initialize WhatsApp client for account ${account.id}: ${error}`);
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

  /**
   * Cleanup methods
   */
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

// Export a singleton instance
export const whatsAppAccountManager = new WhatsAppAccountManager();
