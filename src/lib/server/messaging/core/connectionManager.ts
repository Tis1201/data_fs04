import type { Connection } from '../interfaces/connection';
import type { ConnectionMeta } from '../interfaces/connection';
import { v4 as uuidv4 } from 'uuid';

import { connectionSharedStore } from './stores/connectionSharedStore';
import { logger } from '$lib/server/logger';



type ConnectionId = string;
type UserId = string;

class DefaultConnectionManager {
  private liveConnections = new Map<ConnectionId, Connection>();
  private userConnections = new Map<UserId, Set<ConnectionId>>();
  private connectionLogInterval: NodeJS.Timeout | null = null;
  
  private startConnectionLogging(): void {
    if (this.connectionLogInterval) return; // Already running
    
    // this.connectionLogInterval = setInterval(() => {
    //   logger.info(`[ConnectionManager] Active connections: ${this.liveConnections.size}, Users: ${this.userConnections.size}`);
      
    //   // Log detailed connection info
    //   if (this.liveConnections.size > 0) {
    //     logger.info(`[ConnectionManager] Connection IDs: ${Array.from(this.liveConnections.keys()).join(', ')}`);
    //   }
    // }, 60000); // Log every minute
  }

  registerConnection(connection: Connection, ttlSeconds: number = 3600): void {

    logger.debug(`Registering connection: ${JSON.stringify(connection.meta)}`)

    // Set a UUID in connection.meta if not present
    if (!('id' in connection.meta)) {
      (connection.meta as any).id = uuidv4();
    }

    const { id, userInfo } = connection.meta;

    this.liveConnections.set(id, connection);

    const connSet = this.userConnections.get(userInfo.id) ?? new Set();
    connSet.add(id);

    logger.info(`[ConnectionManager] Registered connection: ${id}, [${connection.meta.protocol}] for user: ${userInfo.id}`);
    // logger.info(`[ConnectionManager] Total connections: ${this.liveConnections.size}, Users with connections: ${this.userConnections.size}`);

    this.userConnections.set(userInfo.id, connSet);

    // Store metadata in the shared store
    connectionSharedStore.addMember(connection.meta.id,connection.meta);
    
    // Log connection counts every minute
    if (this.liveConnections.size === 1) {
      this.startConnectionLogging();
    }
  }

  unregisterConnection(connId: ConnectionId): void {
    const connection = this.liveConnections.get(connId);
    if (!connection) {
      logger.warn(`[ConnectionManager] Attempted to unregister non-existent connection: ${connId}`);
      return;
    }

    this.liveConnections.delete(connId);

    const { userInfo } = connection.meta;
    const connSet = this.userConnections.get(userInfo.id);
    if (connSet) {
      connSet.delete(connId);
      if (connSet.size === 0) {
        this.userConnections.delete(userInfo.id);
      }
    }

    connectionSharedStore.remove(connId);

    logger.info(`[ConnectionManager] Unregistered connection: ${connId}`);
    logger.info(`[ConnectionManager] Remaining connections: ${this.liveConnections.size}, Users: ${this.userConnections.size}`);
    
    // Log remaining connection IDs if any
    if (this.liveConnections.size > 0) {
      logger.info(`[ConnectionManager] Remaining connection IDs: ${Array.from(this.liveConnections.keys()).join(', ')}`);
    }
  }

  getConnection(connId: ConnectionId): Connection | undefined {
    console.log(`[ConnectionManager] ===== GETTING CONNECTION =====`);
    console.log(`[ConnectionManager] Looking for connection ID: ${connId}`);
    console.log(`[ConnectionManager] Available connections:`, Array.from(this.liveConnections.keys()));
    
    const connection = this.liveConnections.get(connId);
    console.log(`[ConnectionManager] Connection found: ${!!connection}`);
    if (connection) {
      console.log(`[ConnectionManager] Connection details:`, {
        id: connection.meta.id,
        protocol: connection.meta.protocol,
        userInfo: connection.meta.userInfo?.id,
        createdAt: connection.meta.createdAt
      });
    }
    
    return connection;
  }

  getUserConnections(userId: UserId): Connection[] {
    const ids = this.userConnections.get(userId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.liveConnections.get(id))
      .filter((conn): conn is Connection => !!conn);
  }

  async sendTo(connId: ConnectionId, payload: any): Promise<void> {
    console.log(`[ConnectionManager] ===== SENDING TO CONNECTION =====`);
    console.log(`[ConnectionManager] Connection ID: ${connId}`);
    console.log(`[ConnectionManager] Payload:`, JSON.stringify(payload, null, 2));
    
    const conn = this.liveConnections.get(connId);
    if (!conn) {
      console.warn(`[ConnectionManager] Missing connection: ${connId}`);
      console.log(`[ConnectionManager] Available connections:`, Array.from(this.liveConnections.keys()));
      return;
    }
    
    console.log(`[ConnectionManager] Found connection, sending message...`);
    await conn.send(payload);
    console.log(`[ConnectionManager] Message sent successfully to ${connId}`);
  }

  async sendToUser(userId: UserId, payload: any): Promise<void> {
    const connections = this.getUserConnections(userId);
    for (const conn of connections) {
      await conn.send(payload);
    }
  }

  async getConnectionMeta(connId: ConnectionId): Promise<ConnectionMeta | null> {
    return connectionSharedStore.getSingle(connId);
  }

  async getAllConnectionMetas(): Promise<ConnectionMeta[]> {
    return connectionSharedStore.getAllMembers();
  }

  getLiveConnectionCount(): number {
    return this.liveConnections.size;
  }

  async getConnectionsByUser(userId: string): Promise<ConnectionMeta[]> {
    // Use your connectionSharedStore here
    return connectionSharedStore.getAllMembers().then(metas =>
      metas.filter(meta => meta.userInfo?.id === userId)
    );
  }

  // Debug method to list all connections
  listAllConnections(): void {
    console.log(`[ConnectionManager] ===== ALL CONNECTIONS DEBUG =====`);
    console.log(`[ConnectionManager] Total connections: ${this.liveConnections.size}`);
    
    for (const [connId, connection] of this.liveConnections) {
      console.log(`[ConnectionManager] Connection ${connId}:`, {
        id: connection.meta.id,
        protocol: connection.meta.protocol,
        userInfo: connection.meta.userInfo?.id,
        deviceId: connection.meta.deviceId,
        createdAt: connection.meta.createdAt
      });
    }
  }

  getConnectionCount(): number {
    return this.liveConnections.size;
  }

  async getConnectionByDeviceId(deviceId: string): Promise<Connection | undefined> {
    console.log(`[ConnectionManager] ===== GETTING CONNECTION BY DEVICE ID =====`);
    console.log(`[ConnectionManager] Looking for device ID: ${deviceId}`);
    console.log(`[ConnectionManager] Total connections: ${this.liveConnections.size}`);
    
    const allConnections = Array.from(this.liveConnections.values());
    
    // Debug: Log all connections and their deviceIds
    allConnections.forEach((conn, index) => {
      console.log(`[ConnectionManager] Connection ${index}:`, {
        id: conn.meta.id,
        deviceId: conn.meta.deviceId,
        protocol: conn.meta.protocol,
        userInfo: conn.meta.userInfo?.id,
        nodeId: conn.meta.nodeId
      });
    });
    
    const foundConnection = allConnections.find(conn => conn.meta.deviceId === deviceId);
    
    if (foundConnection) {
      console.log(`[ConnectionManager] Found connection for device ${deviceId}:`, {
        id: foundConnection.meta.id,
        protocol: foundConnection.meta.protocol,
        userInfo: foundConnection.meta.userInfo?.id
      });
    } else {
      console.log(`[ConnectionManager] No connection found for device ${deviceId}`);
      console.log(`[ConnectionManager] Available device IDs:`, allConnections.map(conn => conn.meta.deviceId).filter(Boolean));
    }
    
    return foundConnection;
  }
}

export const ConnectionManager = new DefaultConnectionManager();
