import type { Connection } from '../interfaces/connection';
import type { SharedStore } from '../interfaces/sharedStore';
import type { ConnectionMeta } from '../interfaces/connection';

import { MemorySharedStore } from '../stores/memorySharedStore';
// import { RedisSharedStore } from '../stores/redisSharedStore';
// import { config } from '$lib/config'; // Optional toggle

// Swap stores based on environment/config
// const store: SharedStore = config.useRedis
//   ? (() => { throw new Error('RedisSharedStore not implemented yet'); })()
//   : MemorySharedStore;

const store: SharedStore = MemorySharedStore;

type ConnectionId = string;
type UserId = string;

class DefaultConnectionManager {
  private liveConnections = new Map<ConnectionId, Connection>();
  private userConnections = new Map<UserId, Set<ConnectionId>>();

  registerConnection(connection: Connection, ttlSeconds: number = 3600): void {
    const { id, userId } = connection.meta;

    this.liveConnections.set(id, connection);

    const connSet = this.userConnections.get(userId) ?? new Set();
    connSet.add(id);
    this.userConnections.set(userId, connSet);

    // Store metadata in the shared store
    store.setConnection(connection.meta, ttlSeconds);
  }

  unregisterConnection(connId: ConnectionId): void {
    const connection = this.liveConnections.get(connId);
    if (!connection) return;

    this.liveConnections.delete(connId);

    const { userId } = connection.meta;
    const connSet = this.userConnections.get(userId);
    if (connSet) {
      connSet.delete(connId);
      if (connSet.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    store.removeConnection(connId);
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
    return store.getConnection(connId);
  }

  async getAllConnectionMetas(): Promise<ConnectionMeta[]> {
    return store.getAllConnections();
  }

  getLiveConnectionCount(): number {
    return this.liveConnections.size;
  }
}

export const ConnectionManager = new DefaultConnectionManager();
