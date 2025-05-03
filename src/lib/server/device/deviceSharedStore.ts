import type { SharedStore } from '$lib/server/messaging/interfaces/sharedStore';
import { createMemoryStore } from '$lib/server/stores/memorySharedStore';
import type { DeviceMeta } from './deviceMeta';
// import { RedisSharedStore } from '../stores/redisSharedStore';
// import { config } from '$lib/config';

export const pinSharedStore: SharedStore<DeviceMeta> = createMemoryStore<DeviceMeta>();
export const deviceSharedStore: SharedStore<DeviceMeta> = createMemoryStore<DeviceMeta>();

// export const sharedStore: SharedStore = MemorySharedStore;
// Later:
// export const SharedStore: SharedStore = config.useRedis ? RedisSharedStore : MemorySharedStore;
class DefaultDeviceManager {
  
    registerDevice(pin: string, device: DeviceMeta, ttlSeconds: number = 3600): void {
        pinSharedStore.addMember(pin, device);
    }
    
}

export const DeviceManager = new DefaultDeviceManager();
