export interface SharedStore<T> {
  set(id: string, obj: T, ttlSeconds?: number): Promise<void>;
  get(id: string): Promise<T | null>;
  remove(id: string): Promise<void>;
  getAll(): Promise<T[]>;
  count(): Promise<number>;
  debugPrint?(): void;
}