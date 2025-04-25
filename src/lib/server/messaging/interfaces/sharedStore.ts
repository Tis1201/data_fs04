import type { ConnectionMeta } from './connection';

export interface SharedStore {
  debugPrint?(): void;
  setConnection(meta: ConnectionMeta, ttlSeconds?: number): Promise<void>;
  removeConnection(connId: string): Promise<void>;

  getConnection(connId: string): Promise<ConnectionMeta | null>;
  getConnectionsByUser(userId: string): Promise<ConnectionMeta[]>;

  getAllConnections(): Promise<ConnectionMeta[]>;
  getConnectionCount(): Promise<number>;
}
