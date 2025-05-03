import type { SharedStore } from '$lib/server/messaging/interfaces/sharedStore';
import { createMemoryStore } from '$lib/server/stores/memorySharedStore';
import type { DeviceMeta } from './deviceMeta';

/**
 * Shared stores for device management
 * 
 * pinSharedStore: Maps PIN codes to device metadata
 * deviceSharedStore: Maps device IDs to device metadata
 */
export const pinSharedStore: SharedStore<DeviceMeta> = createMemoryStore<DeviceMeta>();
export const deviceSharedStore: SharedStore<DeviceMeta> = createMemoryStore<DeviceMeta>();
