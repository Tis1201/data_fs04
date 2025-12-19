import { writable, derived, type Readable } from 'svelte/store';
import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { browser } from '$app/environment';

export interface DeviceConnectionUpdate {
    deviceId: string;
    connected: boolean;
    connectedAt?: string;
    disconnectedAt?: string;
    protocol?: 'mqtt';
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

// MQTT notification handlers for device connection updates
let mqttUnsubscribes: (() => void)[] = [];

export function initializeDeviceRealtime(): void {
    if (mqttUnsubscribes.length > 0) {
        if (browser) console.debug('[DeviceRealtimeStore] Already initialized');
        return;
    }

    if (!browser) {
        return;
    }

    if (browser) console.log('[DeviceRealtimeStore] Initializing device real-time updates via MQTT');

    // Subscribe to device connection notifications
    const unsubConnection = mqttClient.onNotification('device:connection', (payload: any) => {
        try {
            if (browser) console.log('[DeviceRealtimeStore] Received device:connection notification:', payload);
            
            const deviceId = payload?.deviceId;
            if (!deviceId) {
                if (browser) console.debug('[DeviceRealtimeStore] No deviceId in connection notification');
                return;
            }

            const update: DeviceConnectionUpdate = {
                deviceId,
                connected: true,
                connectedAt: payload?.connectedAt || payload?.timestamp || new Date().toISOString(),
                protocol: 'mqtt',
                timestamp: new Date().toISOString()
            };

            if (browser) console.debug(`[DeviceRealtimeStore] Updating device ${deviceId} as connected:`, update);

            // Update the device state
            deviceStates.update(states => {
                const newStates = new Map(states);
                newStates.set(deviceId, update);
                if (browser) console.log(`[DeviceRealtimeStore] Updated device state for ${deviceId}:`, update);
                return newStates;
            });

        } catch (error) {
            if (browser) console.error('[DeviceRealtimeStore] Error processing device connection notification:', error as any);
        }
    });

    // Subscribe to device disconnection notifications
    const unsubDisconnection = mqttClient.onNotification('device:disconnection', (payload: any) => {
        try {
            if (browser) console.log('[DeviceRealtimeStore] Received device:disconnection notification:', payload);
            
            const deviceId = payload?.deviceId;
            if (!deviceId) {
                if (browser) console.debug('[DeviceRealtimeStore] No deviceId in disconnection notification');
                return;
            }

            const update: DeviceConnectionUpdate = {
                deviceId,
                connected: false,
                disconnectedAt: payload?.disconnectedAt || payload?.timestamp || new Date().toISOString(),
                protocol: 'mqtt',
                timestamp: new Date().toISOString()
            };

            if (browser) console.debug(`[DeviceRealtimeStore] Updating device ${deviceId} as disconnected:`, update);

            // Update the device state
            deviceStates.update(states => {
                const newStates = new Map(states);
                newStates.set(deviceId, update);
                if (browser) console.log(`[DeviceRealtimeStore] Updated device state for ${deviceId}:`, update);
                return newStates;
            });

        } catch (error) {
            if (browser) console.error('[DeviceRealtimeStore] Error processing device disconnection notification:', error as any);
        }
    });

    mqttUnsubscribes = [unsubConnection, unsubDisconnection];
}

export function cleanupDeviceRealtime(): void {
    if (mqttUnsubscribes.length > 0) {
        if (browser) console.debug('[DeviceRealtimeStore] Cleaning up device real-time updates');
        mqttUnsubscribes.forEach(unsub => unsub());
        mqttUnsubscribes = [];
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
