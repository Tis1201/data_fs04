// src/lib/server/messaging/stores/memorySharedStore.ts
import type { SharedStore } from "../messaging/interfaces/sharedStore";

/**
 * A generic in-memory set store for storing multiple values per key.
 * API is compatible with Redis Set operations and your SharedStore interface.
 */
export function createMemoryStore<T>(): SharedStore<T> {
  const memory = new Map<string, Set<T>>();

  return {
    /**
     * Overwrite the set at id with the provided members.
     */
    async set(id, members, _ttlSeconds) {
      // TTL is ignored in memory, but kept for API compatibility.
      memory.set(id, new Set(members));
    },

    /**
     * Get a single (first) member for an id, or null if none.
     */
    async getSingle(id) {
      const set = memory.get(id);
      if (!set || set.size === 0) return null;
      return set.values().next().value ?? null;
    },

    /**
     * Add a member to the set at id.
     */
    async addMember(id, member) {
      if (!memory.has(id)) {
        memory.set(id, new Set<T>());
      }
      memory.get(id)!.add(member);
    },

    /**
     * Remove a member from the set at id.
     */
    async removeMember(id, member) {
      const set = memory.get(id);
      if (set) {
        set.delete(member);
        if (set.size === 0) memory.delete(id);
      }
    },

    /**
     * Remove the entire set for an id.
     */
    async remove(id) {
      memory.delete(id);
    },

    /**
     * Get all members for an id.
     */
    async getMembers(id) {
      return Array.from(memory.get(id) ?? []);
    },

    /**
     * Get the total number of members across all ids.
     */
    async count() {
      let total = 0;
      for (const set of memory.values()) total += set.size;
      return total;
    },

    async getAllMembers() {
      // Flatten all sets into a single array
      return Array.from(memory.values()).flatMap(set => Array.from(set));
    },

    /**
     * Print debug info for all ids and their members.
     */
    debugPrint() {
      for (const [id, set] of memory.entries()) {
        console.log(`key: ${id}, members: ${Array.from(set).join(',')}`);
      }
    }
  };
}