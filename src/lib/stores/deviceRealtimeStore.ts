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

/** Last radar USB link status from device MQTT (`radar:usb_status`). */
export type RadarUsbStatusUpdate = {
    deviceId: string;
    sensorId?: string;
    controllerId?: string;
    usbConnected: boolean;
    timestamp: string;
};

const radarUsbBySensorKey = writable<Map<string, RadarUsbStatusUpdate>>(new Map());
const radarUsbByDeviceControllerKey = writable<Map<string, RadarUsbStatusUpdate>>(new Map());

/** Real-time radar USB status (populated when device publishes `radar:usb_status`). */
export const radarUsbRealtimeStore = derived(
    [radarUsbBySensorKey, radarUsbByDeviceControllerKey],
    ([$bySensor, $byDevCtrl]) => ({
        getForRadar(sensorId: string, deviceId: string, controllerId: string): RadarUsbStatusUpdate | null {
            const bySensor = $bySensor.get(sensorId);
            if (bySensor) return bySensor;
            const k = `${deviceId}:${controllerId}`;
            return $byDevCtrl.get(k) ?? null;
        }
    })
);

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

            // Update the device state
            deviceStates.update(states => {
                const newStates = new Map(states);
                newStates.set(deviceId, update);
                return newStates;
            });

        } catch (error) {
            if (browser) console.error('[DeviceRealtimeStore] Error processing device connection notification:', error as any);
        }
    });

    // Subscribe to device disconnection notifications
    const unsubDisconnection = mqttClient.onNotification('device:disconnection', (payload: any) => {
        try {

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

            // Update the device state
            deviceStates.update(states => {
                const newStates = new Map(states);
                newStates.set(deviceId, update);
                return newStates;
            });

        } catch (error) {
            if (browser) console.error('[DeviceRealtimeStore] Error processing device disconnection notification:', error as any);
        }
    });

    const unsubRadarUsb = mqttClient.onNotification('radar:usb_status', (payload: any) => {
        try {
            const deviceId = payload?.deviceId as string | undefined;
            if (!deviceId) {
                if (browser) console.debug('[DeviceRealtimeStore] radar:usb_status missing deviceId');
                return;
            }
            const row: RadarUsbStatusUpdate = {
                deviceId,
                sensorId: typeof payload?.sensorId === 'string' ? payload.sensorId : undefined,
                controllerId: typeof payload?.controllerId === 'string' ? payload.controllerId : undefined,
                usbConnected: Boolean(payload?.usbConnected),
                timestamp:
                    typeof payload?.timestamp === 'string'
                        ? payload.timestamp
                        : new Date().toISOString()
            };
            const sensorId = row.sensorId;
            if (sensorId) {
                radarUsbBySensorKey.update((m) => {
                    const n = new Map(m);
                    n.set(sensorId, row);
                    return n;
                });
            }
            if (row.controllerId) {
                const dcKey = `${deviceId}:${row.controllerId}`;
                radarUsbByDeviceControllerKey.update((m) => {
                    const n = new Map(m);
                    n.set(dcKey, row);
                    return n;
                });
            }
        } catch (error) {
            if (browser) console.error('[DeviceRealtimeStore] radar:usb_status handler error:', error as any);
        }
    });

    mqttUnsubscribes = [unsubConnection, unsubDisconnection, unsubRadarUsb];
}

export function cleanupDeviceRealtime(): void {
    if (mqttUnsubscribes.length > 0) {
        if (browser) console.debug('[DeviceRealtimeStore] Cleaning up device real-time updates');
        mqttUnsubscribes.forEach(unsub => unsub());
        mqttUnsubscribes = [];
    }
    radarUsbBySensorKey.set(new Map());
    radarUsbByDeviceControllerKey.set(new Map());
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
