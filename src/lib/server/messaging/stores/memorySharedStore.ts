import type { SharedStore } from '../interfaces/sharedStore';
import type { ConnectionMeta } from '../interfaces/connection';

const memory = new Map<string, { meta: ConnectionMeta; userId?: string; expiresAt?: number }>();

export const MemorySharedStore: SharedStore = {
  debugPrint() {
    console.log('[MemorySharedStore] Dump:');
    for (const [id, entry] of memory.entries()) {
      const { meta, userId, expiresAt } = entry;
      console.log(`  id: ${id}, userId: ${userId}, expiresAt: ${expiresAt ? new Date(expiresAt).toISOString() : 'none'}`);
    }
  },
  async setConnection(meta, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    // Store both the original meta and extract userId for easier querying
    const entry = { 
      meta,
      userId: meta.userInfo?.id,
      expiresAt 
    };
    memory.set(meta.id, entry);
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
      .filter(e => e.userId === userId && (!e.expiresAt || e.expiresAt > Date.now()))
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
