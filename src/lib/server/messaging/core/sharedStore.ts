import type { SharedStore } from '../interfaces/sharedStore';
import { MemorySharedStore } from '../stores/memorySharedStore';
// import { RedisSharedStore } from '../stores/redisSharedStore';
// import { config } from '$lib/config';

export const sharedStore: SharedStore = MemorySharedStore;
// Later:
// export const SharedStore: SharedStore = config.useRedis ? RedisSharedStore : MemorySharedStore;
