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

  registerConnection(connection: Connection, ttlSeconds: number = 3600): void {
    // Set a UUID in connection.meta if not present
    if (!('id' in connection.meta)) {
      (connection.meta as any).id = uuidv4();
    }

    const { id, userInfo } = connection.meta;

    this.liveConnections.set(id, connection);

    const connSet = this.userConnections.get(userInfo.id) ?? new Set();
    connSet.add(id);

    logger.debug(`[ConnectionManager] Registered connection: ${id} for user: ${userInfo.id}`);

    this.userConnections.set(userInfo.id, connSet);

    // Store metadata in the shared store
    connectionSharedStore.addMember(connection.meta.id,connection.meta);
  }

  unregisterConnection(connId: ConnectionId): void {
    const connection = this.liveConnections.get(connId);
    if (!connection) return;

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

    logger.debug(`[ConnectionManager] Unregistered connection: ${connId}`);
  }

  getConnection(connId: ConnectionId): Connection | undefined {
    return this.liveConnections.get(connId);
  }

  getUserConnections(userId: UserId): Connection[] {
    const ids = this.userConnections.get(userId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.liveConnections.get(id))
      .filter((conn): conn is Connection => !!conn);
  }

  async sendTo(connId: ConnectionId, payload: any): Promise<void> {
    const conn = this.liveConnections.get(connId);
    if (!conn) {
      console.warn(`[ConnectionManager] Missing connection: ${connId}`);
      return;
    }
    await conn.send(payload);
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
}

export const ConnectionManager = new DefaultConnectionManager();
