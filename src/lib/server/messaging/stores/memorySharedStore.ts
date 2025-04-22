import type { SharedStore } from '../interfaces/sharedStore';
import type { ConnectionMeta } from '../interfaces/connection';

const memory = new Map<string, { meta: ConnectionMeta; expiresAt?: number }>();

export const MemorySharedStore: SharedStore = {
  async setConnection(meta, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    memory.set(meta.id, { meta, expiresAt });
  },

  async removeConnection(connId) {
    memory.delete(connId);
  },

  async getConnection(connId) {
    const entry = memory.get(connId);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      memory.delete(connId);
      return null;
    }
    return entry.meta;
  },

  async getConnectionsByUser(userId) {
    return Array.from(memory.values())
      .filter(e => e.meta.userId === userId && (!e.expiresAt || e.expiresAt > Date.now()))
      .map(e => e.meta);
  },

  async getAllConnections() {
    const now = Date.now();
    return Array.from(memory.values())
      .filter(e => !e.expiresAt || e.expiresAt > now)
      .map(e => e.meta);
  },

  async getConnectionCount() {
    return (await MemorySharedStore.getAllConnections()).length;
  }
};
