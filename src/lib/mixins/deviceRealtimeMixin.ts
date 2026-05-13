import { onMount, onDestroy } from 'svelte';
import { derived, type Readable } from 'svelte/store';
import { deviceRealtimeStore, initializeDeviceRealtime, cleanupDeviceRealtime, type DeviceConnectionUpdate } from '$lib/stores/deviceRealtimeStore';

export interface DeviceRealtimeMixinOptions {
    deviceIds?: string[];
    autoSubscribe?: boolean;
    debug?: boolean;
}

export interface DeviceRealtimeMixinState {
    deviceStates: Readable<{ [deviceId: string]: DeviceConnectionUpdate }>;
    isDeviceConnected: (deviceId: string) => boolean;
    getDeviceConnectionTime: (deviceId: string) => string | null;
    subscribeToDevice: (deviceId: string) => Promise<void>;
    unsubscribeFromDevice: (deviceId: string) => Promise<void>;
    updateDeviceInArray: <T extends { id: string; connected?: boolean; connectedAt?: string; disconnectedAt?: string }>(
        devices: T[],
        deviceId: string
    ) => T[];
}

/**
 * Mixin for handling device real-time updates in Svelte components
 * Provides reactive device connection states and automatic SSE subscription management
 */
export function useDeviceRealtime(options: DeviceRealtimeMixinOptions = {}): DeviceRealtimeMixinState {
    const {
        deviceIds = [],
        autoSubscribe = true,
        debug = false
    } = options;

    // Initialize the global device real-time store
    initializeDeviceRealtime();

    // Create a derived store for easy access to device states
    const deviceStates = derived(deviceRealtimeStore, ($store: any) => {
        const states: { [deviceId: string]: DeviceConnectionUpdate } = {};
        $store.getAllDevices().forEach((device: DeviceConnectionUpdate) => {
            states[device.deviceId] = device;
        });
        return states;
    });

    // Track subscribed device IDs
    const subscribedDeviceIds = new Set<string>();
    let connectionId: string | null = null;

    // Helper function to subscribe to a device channel
    async function subscribeToDevice(deviceId: string): Promise<void> {
        if (subscribedDeviceIds.has(deviceId)) {
            if (debug) console.debug(`[DeviceRealtimeMixin] Already subscribed to device ${deviceId}`);
            return;
        }

        // Device subscriptions now handled via MQTT automatically
        // MQTT client automatically receives device notifications based on user permissions
        // No manual subscription needed
        subscribedDeviceIds.add(deviceId);
        if (debug) console.debug(`[DeviceRealtimeMixin] Device ${deviceId} will receive updates via MQTT`);
    }

    // Helper function to unsubscribe from a device channel
    async function unsubscribeFromDevice(deviceId: string): Promise<void> {
        if (!subscribedDeviceIds.has(deviceId)) {
            if (debug) console.debug(`[DeviceRealtimeMixin] Not subscribed to device ${deviceId}`);
            return;
        }

        // Device subscriptions now handled via MQTT automatically
        // MQTT client manages subscriptions - no manual unsubscribe needed
        subscribedDeviceIds.delete(deviceId);
        if (debug) console.debug(`[DeviceRealtimeMixin] Device ${deviceId} tracking removed (MQTT handles subscriptions)`);
    }

    // Helper function to check if a device is connected
    function isDeviceConnected(deviceId: string): boolean {
        let result = false;
        deviceRealtimeStore.subscribe((store: any) => {
            result = store.isDeviceConnected(deviceId);
        })();
        return result;
    }

    // Helper function to get device connection time
    function getDeviceConnectionTime(deviceId: string): string | null {
        let result: string | null = null;
        deviceRealtimeStore.subscribe((store: any) => {
            result = store.getDeviceConnectionTime(deviceId);
        })();
        return result;
    }

    // Helper function to update device in an array (for table components)
    function updateDeviceInArray<T extends { id: string; connected?: boolean; connectedAt?: string; disconnectedAt?: string }>(
        devices: T[],
        deviceId: string
    ): T[] {
        let deviceState: DeviceConnectionUpdate | null = null;
        deviceStates.subscribe(states => {
            deviceState = states[deviceId] || null;
        })();
        
        if (!deviceState) return devices;

        return devices.map(device => {
            if (device.id === deviceId) {
                return {
                    ...device,
                    connected: deviceState!.connected,
                    connectedAt: deviceState!.connectedAt || device.connectedAt,
                    disconnectedAt: deviceState!.disconnectedAt || device.disconnectedAt
                };
            }
            return device;
        });
    }

    // Auto-subscribe to devices on mount
    onMount(async () => {
        if (autoSubscribe && deviceIds.length > 0) {
            if (debug) console.debug(`[DeviceRealtimeMixin] Tracking ${deviceIds.length} devices (MQTT handles subscriptions automatically)`);
            
            // MQTT automatically handles device subscriptions - no manual subscription needed
            // Just track the device IDs for local state management
            deviceIds.forEach(deviceId => {
                subscribeToDevice(deviceId);
            });
        }
    });

    // Cleanup on destroy
    onDestroy(async () => {
        if (debug) console.debug('[DeviceRealtimeMixin] Cleaning up device real-time mixin');
        
        // Unsubscribe from all subscribed devices
        const unsubscribePromises = Array.from(subscribedDeviceIds).map(deviceId => 
            unsubscribeFromDevice(deviceId)
        );
        
        try {
            await Promise.all(unsubscribePromises);
            if (debug) console.debug('[DeviceRealtimeMixin] All devices unsubscribed');
        } catch (error) {
            if (debug) console.error('[DeviceRealtimeMixin] Error during cleanup:', error);
        }
        
        // Note: We don't cleanup the global store as other components might be using it
    });

    return {
        deviceStates,
        isDeviceConnected,
        getDeviceConnectionTime,
        subscribeToDevice,
        unsubscribeFromDevice,
        updateDeviceInArray
    };
}

// Export the derived store for direct use
export { deviceRealtimeStore };
