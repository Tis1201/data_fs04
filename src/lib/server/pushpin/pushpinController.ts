import { logger } from '$lib/server/logger';
import type { RedisService } from '$lib/server/services/redisService';
import type { UserInfo } from '$lib/server/types/user';
import type { Connection, ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';

export class PushpinController {
  
  private redisService: RedisService;
  
  public constructor(redisService: RedisService) {
    this.redisService = redisService;
  }

 public async loadOnlineDevices(): Promise<void> {
    try {
      logger.info('[PushpinController] Loading online devices from Redis');
      
      // Get all keys matching the pattern for online devices
      const keys = await this.redisService.client.keys('device:*:status');
      logger.info(`[PushpinController] Found ${keys.length} device status keys`);
      
      // Filter for online devices only
      const onlineDevices = [];
      
    //   for (const key of keys) {
    //     const status = await this.redisService.get(key);
    //     if (status === 'online') {
    //       // Extract device ID from the key (format: device:<id>:status)
    //       const deviceId = key.split(':')[1];
    //       onlineDevices.push(deviceId);
          
    //       // Get additional device info if available
    //       const deviceInfoKey = `device:${deviceId}:info`;
    //       let deviceInfo: any = {};
          
    //       try {
    //         const infoStr = await this.redisService.get(deviceInfoKey);
    //         if (infoStr) {
    //           deviceInfo = JSON.parse(infoStr);
    //         }
    //       } catch (error) {
    //         logger.warn(`[PushpinController] Error parsing device info for ${deviceId}: ${error.message}`);
    //       }
          
    //       // Register the device as a connection
    //       this.registerDeviceConnection(deviceId, deviceInfo);
    //     }
    //   }
      
      logger.info(`[PushpinController] Loaded ${onlineDevices.length} online devices`);
    } catch (error: any) {
      logger.error(`[PushpinController] Failed to load online devices: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Subscribe to device status changes from Redis
   */
  public subscribeToDeviceStatusChanges(): void {
    try {
      logger.info('[PushpinController] Subscribing to device status changes');
      
      const subscriber = this.redisService.subscribeToChannel('device_status_changes', (message) => {
        this.handleDeviceStatusChange(message);
      });
      
      subscriber.on('error', (err) => {
        logger.error(`[PushpinController] Redis subscription error: ${err.message}`, {
          error: err.message,
          stack: err.stack
        });
      });
    } catch (error) {
      logger.error(`[PushpinController] Failed to subscribe to device status changes: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Handle device status change messages from Redis
   */
  private handleDeviceStatusChange(message: string): void {
    try {
      const statusUpdate = JSON.parse(message);
      const { id, status, timestamp } = statusUpdate;
      
      logger.info(`[PushpinController] Device ${id} status changed to ${status} at ${timestamp}`);
      
      if (status === 'online') {
        // Register or update the device connection
        this.registerDeviceConnection(id, statusUpdate);
      } else if (status === 'offline') {
        // Unregister the device connection
        const connectionId = `device:${id}`;
        const connection = ConnectionManager.getConnection(connectionId);
        
        if (connection) {
          logger.info(`[PushpinController] Unregistering offline device: ${id}`);
          ConnectionManager.unregisterConnection(connectionId);
        }
      }
    } catch (error:any) {
      logger.error(`[PushpinController] Error handling device status change: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        message
      });
    }
  }

  private registerDeviceConnection(deviceId: string, deviceInfo: any = {}): void {
    // Create a mock user info for the device
    // In a real implementation, this would be based on actual device authentication
    const userInfo: UserInfo = {
      id: `device:${deviceId}`,
      email: '',
      name: deviceInfo.name || deviceId,
      roles: ['DEVICE']
    };
    
    // Create connection metadata
    const connectionMeta: ConnectionMeta = {
      id: `device:${deviceId}`,
      userInfo,
      nodeId: process.env.NODE_ID || 'default-node',
      protocol: 'pushpin-sse',
      connectedAt: Date.now(),
      deviceId: deviceId,
      ...deviceInfo
    };
    
    // Create and register the connection
    const connection = new PushpinConnection(connectionMeta);
    ConnectionManager.registerConnection(connection);
    
    logger.info(`[PushpinController] Registered device connection: ${deviceId}`);
  }
}

/**
 * Initialize the PushpinController with the given RedisService
 * This should be called during application startup
 */
export async function initializePushpinConnections(redisService: RedisService): Promise<void> {
  const manager = PushpinController.getInstance(redisService);
  
  // Load existing online devices
  await manager.loadOnlineDevices();
  
  // Subscribe to device status changes
  manager.subscribeToDeviceStatusChanges();
  
  logger.info('[PushpinController] Initialization complete');
}

