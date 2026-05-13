export interface SharedStore<T> {
  /**
   * Overwrite the set at id with the provided members.
   */
  set(id: string, members: T[] | Set<T>, ttlSeconds?: number): Promise<void>;

  /**
   * Get a single (first) member for an id, or null if none.
   */
  getSingle(id: string): Promise<T | null>;

  /**
   * Add a member to the set at id.
   */
  addMember(id: string, member: T): Promise<void>;

  /**
   * Remove a member from the set at id.
   */
  removeMember(id: string, member: T): Promise<void>;

  /**
   * Remove the entire set for an id.
   */
  remove(id: string): Promise<void>;

  /**
   * Get all members for an id.
   */
  getMembers(id: string): Promise<T[]>;

  getAllMembers(): Promise<T[]>;


  /**
   * Get the total number of members across all ids.
   */
  count(): Promise<number>;

  /**
   * Print debug info for all ids and their members.
   */
  debugPrint?(): void;
}