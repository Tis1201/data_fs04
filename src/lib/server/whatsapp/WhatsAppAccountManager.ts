import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import { logger } from '$lib/server/logger';
import { WhatsAppAccountClient } from './WhatsAppAccountClient';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
// import type { UserInfo } from '$lib/server/messaging/interfaces/connection';

export class WhatsAppAccountManager extends EventEmitter {
  // Store for all WhatsApp clients
  private clients = new Map<string, WhatsAppAccountClient>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60000; // Every minute
  private readonly MAX_AWAITING_SCAN_MS = 300000; // 5 minutes
  private prisma: any;


  /****************************************************************************************
   * 
   *  Constructor
   * 
   ***************************************************************************************/
  constructor() {
    super();
    logger.info('WhatsApp Account Manager initialized');
    this.startCleanupInterval();
    this.prisma = getEnhancedPrisma({ id: '', systemRole: 'ADMIN' });
  }

  /****************************************************************************************
   * 
   *  createClient
   * 
   ***************************************************************************************/
  public async create(clientId: string, createdBy: string): Promise<{ client: WhatsAppAccountClient }> {
    try {
      // Create a client instance (new or restored)
      const client:WhatsAppAccountClient = new WhatsAppAccountClient(clientId);
      
      // Initialize the client (load user info, etc.)
      await client.init();
      
      // Register the client
      this.clients.set(clientId, client);
      
      // Set up client event forwarding
      // this.setupClientEvents(client);
      
      // Connect the client
      // await client.connect();
      
      return { client };
    } catch (error) {
      logger.error(`[WhatsappAccountManager] Error creating/restoring WhatsApp client: ${error}`);
      throw error;
    }
  }

  /****************************************************************************************
   * 
   *  getClients
   * 
   ***************************************************************************************/
  public getClient(sessionId: string): WhatsAppAccountClient | null {
    return this.clients.get(sessionId) || null;
  }

  // public getClientsByUserId(userId: string): WhatsAppAccountClient[] {
  //   return Array.from(this.clients.values()).filter(client => client.getCreatedBy() === userId);
  // }

  public getAllClients(): WhatsAppAccountClient[] {
    return Array.from(this.clients.values());
  }
  
 
  // public getClientByAccountId(accountId: string): WhatsAppAccountClient | null {
  //   if (!accountId) return null;
    
  //   for (const client of this.clients.values()) {
  //     if (client.getAccountId() === accountId) {
  //       return client;
  //     }
  //   }
    
  //   logger.debug(`No client found with account ID ${accountId}`);
  //   return null;
  // }

  // public getClientInfo(clientId: string): any | null {
  //   const client = this.getClient(clientId);
  //   return client ? client.getInfo() : null;
  // }
  
  // Message sending is handled directly by the WhatsAppAccountClient

  // public getAllClientsInfo(): any[] {
  //   return this.getAllClients().map(client => client.getInfo());
  // }

  /**
   * Disconnects a client and removes it from the registry
   */
  // public async disconnectClient(clientId: string): Promise<boolean> {
  //   const client = this.getClient(clientId);
  //   if (!client) return false;
    
  //   try {
  //     const success = await client.disconnect();
  //     if (success) {
  //       this.clients.delete(clientId);
  //     }
  //     return success;
  //   } catch (error) {
  //     logger.error(`Error disconnecting client ${clientId}: ${error}`);
  //     return false;
  //   }
  // }


  /**
   * Initializes clients from the database
   */
  public async initializeClientsFromDatabase(): Promise<void> {
    logger.info('Initializing WhatsApp clients from database');
    
    try {
      const accounts = await this.prisma.whatsAppAccount.findMany();
      logger.info(`Found ${accounts.length} WhatsApp accounts to initialize`);

      for (const account of accounts) {
        // try {
        //   // Fetch user info for the account creator
        //   const userInfo = await userInfoByUserId(account.createdBy);
        //   if (!userInfo) {
        //     logger.warn(`Could not find user info for account ${account.id} creator (${account.createdBy}), skipping initialization`);
        //     continue;
        //   }
          
        //   const client = new WhatsAppAccountClient(
        //     account.client_id, 
        //     account.phone_number, 
        //     account.id, 
        //     account.createdBy, 
        //     this.options
        //   );
          
        //   // Set the userInfo on the client to enable message routing
        //   client.setUserInfo(userInfo);
          
        //   // Register the client
        //   this.clients.set(account.client_id, client);
        //   this.setupClientEvents(client);
          
        //   // Connect the client
        //   await client.connect();
        //   logger.info(`Initialized WhatsApp client for account ${account.id} (${account.description}) with user info`);
        // } catch (error) {
        //   logger.error(`Failed to initialize WhatsApp client for account ${account.id}: ${error}`);
        //   await this.prisma.whatsAppAccount.update({
        //     where: { id: account.id },
        //     data: { client_status: 'disconnected' }
        //   });
        // }
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
    // this.cleanupInterval = setInterval(() => this.cleanupStaleClients(), this.CLEANUP_INTERVAL_MS);
    // logger.info(`Started client cleanup interval (every ${this.CLEANUP_INTERVAL_MS / 1000} seconds)`);
  }

  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped client cleanup interval');
    }
  }

}

// Export a singleton instance
export const whatsAppAccountManager = new WhatsAppAccountManager();
