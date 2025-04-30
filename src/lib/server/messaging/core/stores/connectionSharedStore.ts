import type { SharedStore } from '../../interfaces/sharedStore';
import { createMemoryStore } from '../../stores/memorySharedStore';
import type { ConnectionMeta } from '../../interfaces/connection';
// import { RedisSharedStore } from '../stores/redisSharedStore';
// import { config } from '$lib/config';

export const connectionSharedStore: SharedStore<ConnectionMeta> = createMemoryStore<ConnectionMeta>();

// export const sharedStore: SharedStore = MemorySharedStore;
// Later:
// export const SharedStore: SharedStore = config.useRedis ? RedisSharedStore : MemorySharedStore;
