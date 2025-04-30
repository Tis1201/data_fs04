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
   * Creates or restores a WhatsApp client instance
   * @private Internal method used by restoreOrCreateClient
   * @param createdBy - User ID who created/owns this client
   * @param existingSessionId - Optional existing session ID to restore
   * @returns Object containing the client ID
   */
  private async createClient(createdBy: string, existingSessionId?: string): Promise<{ clientId: string }> {
    try {
      // Create a client instance (new or restored)
      const client = new WhatsAppAccountClient(
        existingSessionId, // If provided, use existing session ID
        undefined,         // Phone number (set later if available)
        undefined,         // Account ID (set later if available)
        createdBy,         // User who created this client
        this.options       // Auth/media directories
      );
      
      // Initialize the client (load user info, etc.)
      await client.init();
      
      // Get the client ID (either existing or newly generated)
      const clientId = client.getId();
      
      // Register the client
      this.clients.set(clientId, client);
      
      // Set up client event forwarding
      this.setupClientEvents(client);
      
      // Connect the client
      await client.connect();
      
      const logMessage = existingSessionId
        ? `Restored WhatsApp client ${clientId} for user ${createdBy}`
        : `Created new WhatsApp client ${clientId} for user ${createdBy}`;
      
      logger.info(logMessage);
      return { clientId };
    } catch (error) {
      logger.error(`Error creating/restoring WhatsApp client: ${error}`);
      throw error;
    }
  }

  /**
   * Main method to get a WhatsApp client - restores an existing client or creates a new one
   * 
   * This is the primary method for obtaining a WhatsApp client instance. It handles:
   * 1. Returning an existing client if it's already in memory
   * 2. Restoring a client from disk if session files exist
   * 3. Creating a new client if needed
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
        const { clientId } = await this.createClient(userId, sessionId);
        return { clientId, restored: true };
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
  
  /**
   * Get a client by its account ID
   * @param accountId The account ID to look for
   * @returns The WhatsApp client associated with the account ID, or null if not found
   */
  public getClientByAccountId(accountId: string): WhatsAppAccountClient | null {
    if (!accountId) return null;
    
    for (const client of this.clients.values()) {
      if (client.getAccountId() === accountId) {
        return client;
      }
    }
    
    logger.debug(`No client found with account ID ${accountId}`);
    return null;
  }

  public getClientInfo(clientId: string): any | null {
    const client = this.getClient(clientId);
    return client ? client.getInfo() : null;
  }
  
  // Message sending is handled directly by the WhatsAppAccountClient

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
