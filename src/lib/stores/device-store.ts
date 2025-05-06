import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

// Define types for device store
export type DeviceClaimStatus = 'idle' | 'claiming' | 'claimed' | 'failed';

export interface Device {
    id: string;
    name: string;
    deviceType: string;
    status: string;
    hardwareId?: string;
    manufacturer?: string;
    model?: string;
    claimedAt?: string;
    claimedBy?: string;
}

export interface DeviceState {
    deviceId: string | null;
    name: string | null;
    deviceType: string | null;
    status: string | null;
    claimStatus: DeviceClaimStatus;
    error: string | null;
}

// Initial state
const initialState: DeviceState = {
    deviceId: null,
    name: null,
    deviceType: null,
    status: null,
    claimStatus: 'idle',
    error: null
};

// Create the store
function createDeviceStore() {
    const { subscribe, set, update } = writable<DeviceState>(initialState);

    // Set up WebSocket listener if in browser environment
    if (browser) {
        // Listen for device-related events
        // socketStore.on('device:claimed', (message: any) => {
        //     console.log('[DEVICE_STORE] Received device:claimed event:', message);

        //     if (message && message.data) {
        //         const { deviceId, name, deviceType, status } = message.data;

        //         update(state => ({
        //             ...state,
        //             deviceId,
        //             name,
        //             deviceType,
        //             status: status || 'ACTIVE',
        //             claimStatus: 'claimed'
        //         }));
        //     }
        // });

        // // Listen for device claim errors
        // socketStore.on('device:claim_error', (message: any) => {
        //     console.log('[DEVICE_STORE] Received device:claim_error event:', message);

        //     if (message && message.data && message.data.error) {
        //         update(state => ({
        //             ...state,
        //             claimStatus: 'failed',
        //             error: message.data.error
        //         }));
        //     }
        // });
        socketStore.on('device', (message: any) => {
            console.log('[DEVICE_STORE] Received device event:', message);
            if (message && message.data && message.data.error) {
                update(state => ({
                    ...state,
                    claimStatus: 'failed',
                    error: message.data.error
                }));
            }
        });


    }

    return {
        subscribe,

        // Update device information
        updateDevice: (deviceInfo: Partial<DeviceState>) => {
            update(state => ({
                ...state,
                ...deviceInfo
            }));
        },

        // Set claim status
        setClaimStatus: (status: DeviceClaimStatus, error: string | null = null) => {
            update(state => ({
                ...state,
                claimStatus: status,
                error
            }));
        },

        // Clear error
        clearError: () => {
            update(state => ({
                ...state,
                error: null
            }));
        },

        // Reset store to initial state
        reset: () => {
            set(initialState);
        }
    };
}

// Export the store instance
export const deviceStore = createDeviceStore();
