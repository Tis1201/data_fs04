// src/lib/server/messaging/stores/memorySharedStore.ts
import type { SharedStore } from "../interfaces/sharedStore";

export function createMemoryStore<T>(): SharedStore<T> {
  const memory = new Map<string, { obj: T; expiresAt?: number }>();

  return {
    async set(id, obj, ttlSeconds) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
      memory.set(id, { obj, expiresAt });
    },
    async get(id) {
      const entry = memory.get(id);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        memory.delete(id);
        return null;
      }
      return entry.obj;
    },
    async remove(id) {
      memory.delete(id);
    },
    async getAll() {
      const now = Date.now();
      return Array.from(memory.values())
        .filter(e => !e.expiresAt || e.expiresAt > now)
        .map(e => e.obj);
    },
    async count() {
      return (await this.getAll()).length;
    },
    debugPrint() {
      console.log('[MemoryStore] Dump:');
      for (const [id, entry] of memory.entries()) {
        const { obj, expiresAt } = entry;
        console.log(`  id: ${id}, expiresAt: ${expiresAt ? new Date(expiresAt).toISOString() : 'none'}`);
      }
    }
  };
}