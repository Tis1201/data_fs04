import type { SharedStore } from '../../interfaces/sharedStore';
import { createMemoryStore } from '$lib/server/stores/memorySharedStore';
import type { SubscriptionMeta } from '../../interfaces/subscriptionRegistry';

export const subscriptionSharedStore: SharedStore<SubscriptionMeta> = createMemoryStore<SubscriptionMeta>();

// export const sharedStore: SharedStore = MemorySharedStore;
// Later:
// export const SharedStore: SharedStore = config.useRedis ? RedisSharedStore : MemorySharedStore;
