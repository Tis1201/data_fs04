import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

interface DeviceMessage {
    type: string;
    payload: {
        action: 'error' | 'registered' | 'claimed';
        details?: string;
        error?: string;
        id?: string;
        deviceId?: string;
        deviceName?: string;
        success?: boolean;
    };
}

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
        socketStore.on('device', (message: DeviceMessage) => {
            console.log('[DEVICE_STORE] Received device event:', message);
            
            if (!message?.payload?.action) return;
            
            switch (message.payload.action) {
                case 'error': {
                    const errorDetails = message.payload.details || message.payload.error || 'Unknown error';
                    console.log('[DEVICE_STORE] Error received:', errorDetails);
                    
                    update(state => ({
                        ...state,
                        claimStatus: 'failed',
                        error: errorDetails
                    }));
                    break;
                }
                
                case 'registered':
                    console.log('[DEVICE_STORE] Device registered:', message.payload);
                    
                    update(state => ({
                        ...state,
                        deviceId: message.payload.id,
                        claimStatus: 'claimed'
                    }));
                    break;
                    
                case 'claimed':
                    if (message.payload.success) {
                        console.log('[DEVICE_STORE] Device claimed successfully:', message.payload);
                        
                        update(state => ({
                            ...state,
                            deviceId: message.payload.deviceId,
                            name: message.payload.deviceName,
                            claimStatus: 'claimed',
                            error: null
                        }));
                    }
                    break;
                    
                default:
                    console.log('[DEVICE_STORE] Unhandled action:', message.payload.action);
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
