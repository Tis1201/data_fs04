import { writable, derived, type Readable } from 'svelte/store';
import { sseStore } from './sse-store';
import { browser } from '$app/environment';

export interface DeviceConnectionUpdate {
    deviceId: string;
    connected: boolean;
    connectedAt?: string;
    disconnectedAt?: string;
    protocol?: 'sse' | 'pushpin';
    timestamp: string;
}

export interface DeviceRealtimeState {
    devices: Map<string, DeviceConnectionUpdate>;
    lastUpdate: number;
}

// Internal store for device connection states
const deviceStates = writable<Map<string, DeviceConnectionUpdate>>(new Map());

// Derived store for easy access to individual device states
export const deviceRealtimeStore = derived(deviceStates, ($states) => ({
    getDevice: (deviceId: string): DeviceConnectionUpdate | null => {
        return $states.get(deviceId) || null;
    },
    isDeviceConnected: (deviceId: string): boolean => {
        const state = $states.get(deviceId);
        return state ? state.connected : false;
    },
    getDeviceConnectionTime: (deviceId: string): string | null => {
        const state = $states.get(deviceId);
        if (!state) return null;
        return state.connected ? state.connectedAt || null : state.disconnectedAt || null;
    },
    getAllDevices: (): DeviceConnectionUpdate[] => {
        return Array.from($states.values());
    },
    getConnectedDevices: (): DeviceConnectionUpdate[] => {
        return Array.from($states.values()).filter(device => device.connected);
    },
    getDisconnectedDevices: (): DeviceConnectionUpdate[] => {
        return Array.from($states.values()).filter(device => !device.connected);
    }
}));

// SSE message handler for device connection updates
let sseUnsubscribe: (() => void) | null = null;

export function initializeDeviceRealtime(): void {
    if (sseUnsubscribe) {
        if (browser) console.debug('[DeviceRealtimeStore] Already initialized');
        return;
    }

    if (browser) console.log('[DeviceRealtimeStore] Initializing device real-time updates');

    sseUnsubscribe = sseStore.on('*', (msg: any) => {
        try {
            if (browser) console.log('[DeviceRealtimeStore] Received SSE message:', msg);
            const raw = msg?.data ?? msg;
            const evtType = raw?.type || msg?.event || raw?.payload?.type;
            
            // Normalize payloads that carry action in payload
            const normalized = raw?.payload?.action === 'device:connection' 
                ? { ...raw.payload, type: 'device:connection' }
                : raw;

            // Only process device:connection events
            if (evtType !== 'device:connection' && normalized?.type !== 'device:connection') {
                return;
            }

            const connectionData = normalized as any;
            if (!connectionData?.deviceId) {
                if (browser) console.debug('[DeviceRealtimeStore] No deviceId in connection event');
                return;
            }

            // Extract connection data with proper fallbacks
            const deviceId = connectionData.deviceId || connectionData.payload?.deviceId;
            const connected = connectionData.connected ?? connectionData.payload?.connected ?? false;
            const connectedAt = connectionData.connectedAt ?? connectionData.payload?.connectedAt;
            const disconnectedAt = connectionData.disconnectedAt ?? connectionData.payload?.disconnectedAt;
            const protocol = connectionData.protocol ?? connectionData.payload?.protocol ?? 'sse';

            if (!deviceId) {
                if (browser) console.warn('[DeviceRealtimeStore] No deviceId found in connection event');
                return;
            }

            const update: DeviceConnectionUpdate = {
                deviceId,
                connected: !!connected,
                connectedAt: connected ? (connectedAt || new Date().toISOString()) : undefined,
                disconnectedAt: !connected ? (disconnectedAt || new Date().toISOString()) : undefined,
                protocol,
                timestamp: new Date().toISOString()
            };

            if (browser) console.debug(`[DeviceRealtimeStore] Updating device ${deviceId}:`, {
                connected: update.connected,
                protocol: update.protocol,
                connectedAt: update.connectedAt,
                disconnectedAt: update.disconnectedAt
            });

            // Update the device state
            deviceStates.update(states => {
                const newStates = new Map(states);
                newStates.set(deviceId, update);
                if (browser) console.log(`[DeviceRealtimeStore] Updated device state for ${deviceId}:`, update);
                return newStates;
            });

        } catch (error) {
            if (browser) console.error('[DeviceRealtimeStore] Error processing device connection event:', error as any);
        }
    });
}

export function cleanupDeviceRealtime(): void {
    if (sseUnsubscribe) {
        if (browser) console.debug('[DeviceRealtimeStore] Cleaning up device real-time updates');
        sseUnsubscribe();
        sseUnsubscribe = null;
    }
}

// Utility function to get device connection state
export function getDeviceConnectionState(deviceId: string): DeviceConnectionUpdate | null {
    let result: DeviceConnectionUpdate | null = null;
    deviceRealtimeStore.subscribe(store => {
        result = store.getDevice(deviceId);
    })();
    return result;
}

// Utility function to check if device is connected
export function isDeviceConnected(deviceId: string): boolean {
    let result = false;
    deviceRealtimeStore.subscribe(store => {
        result = store.isDeviceConnected(deviceId);
    })();
    return result;
}
