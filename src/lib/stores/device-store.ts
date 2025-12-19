import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { mqttClient } from '$lib/client/mqtt/mqttClient';

interface DeviceMessage {
    type: string;
    payload: {
        action: 'error' | 'registered' | 'claimed' | 'message';
        details?: string;
        error?: string;
        id?: string;
        deviceId?: string;
        deviceName?: string;
        success?: boolean;
        type?: string; // For message types like 'terminal-response', 'terminal-connected', 'webrtc:offer', etc.
        output?: string; // For terminal output
        sdp?: string; // For WebRTC SDP
        candidate?: any; // For WebRTC ICE candidates
        _clientMessageId?: string; // For message deduplication
    };
    scope?: string;
    senderId?: string;
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

export interface TerminalMessage {
    type: 'terminal-response' | 'terminal-connected' | 'terminal-error';
    deviceId: string;
    output?: string;
    error?: string;
    timestamp: string;
}

export interface WebRTCMessage {
    type: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice-candidate';
    deviceId: string;
    sdp?: string;
    candidate?: any;
    clientMessageId?: string;
    timestamp: string;
    scope?: string;
    senderId?: string;
}

export interface DeviceState {
    deviceId: string | null;
    name: string | null;
    deviceType: string | null;
    status: string | null;
    claimStatus: DeviceClaimStatus;
    error: string | null;
    terminalMessages: TerminalMessage[]; // Store terminal messages
    latestTerminalMessage: TerminalMessage | null; // Latest terminal message
    latestWebRTCMessage: WebRTCMessage | null; // Latest WebRTC message
}

// Initial state
const initialState: DeviceState = {
    deviceId: null,
    name: null,
    deviceType: null,
    status: null,
    claimStatus: 'idle',
    error: null,
    terminalMessages: [],
    latestTerminalMessage: null,
    latestWebRTCMessage: null
};

// Create the store
function createDeviceStore() {
    const { subscribe, set, update } = writable<DeviceState>(initialState);

    // Set up MQTT listeners for device messages
    if (browser) {
        // Listen for terminal messages
        mqttClient.onNotification('device:terminal', (payload: any) => {
            console.log('[DEVICE_STORE] Received terminal notification via MQTT:', payload);
            
            const messageType = payload?.type || 'terminal-response';
            const deviceId = payload?.deviceId || '';
            
            if (messageType.startsWith('terminal-')) {
                const terminalMessageType = messageType as 'terminal-response' | 'terminal-connected' | 'terminal-error';
                
                const terminalMessage: TerminalMessage = {
                    type: terminalMessageType,
                    deviceId,
                    output: payload.output,
                    error: payload.error,
                    timestamp: payload.timestamp || new Date().toISOString()
                };
                
                update(state => ({
                    ...state,
                    terminalMessages: [...state.terminalMessages, terminalMessage],
                    latestTerminalMessage: terminalMessage
                }));
            }
        });

        // Listen for WebRTC messages
        mqttClient.onNotification('device:webrtc', (payload: any) => {
            console.log('[DEVICE_STORE] Received WebRTC notification via MQTT:', payload);
            
            const messageType = payload?.type || '';
            const deviceId = payload?.deviceId || '';
            
            if (messageType.startsWith('webrtc:')) {
                const webrtcMessageType = messageType as 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice-candidate';
                
                const webrtcMessage: WebRTCMessage = {
                    type: webrtcMessageType,
                    deviceId,
                    sdp: payload.sdp,
                    candidate: payload.candidate,
                    clientMessageId: payload._clientMessageId,
                    timestamp: payload.timestamp || new Date().toISOString(),
                    scope: payload.scope,
                    senderId: payload.senderId
                };
                
                update(state => {
                    // Only store the latest WebRTC message for the current device
                    if (!state.deviceId || state.deviceId === deviceId) {
                        return {
                            ...state,
                            latestWebRTCMessage: webrtcMessage
                        };
                    }
                    return state;
                });
            }
        });

        // Listen for device claim/registration messages
        mqttClient.onNotification('device:claim', (payload: any) => {
            console.log('[DEVICE_STORE] Received device claim notification via MQTT:', payload);
            
            if (payload.success) {
                update(state => ({
                    ...state,
                    deviceId: payload.deviceId || payload.device?.id || null,
                    name: payload.deviceName || payload.device?.name || null,
                    deviceType: payload.device?.deviceType || null,
                    status: payload.device?.status || null,
                    claimStatus: 'claimed',
                    error: null
                }));
            } else {
                update(state => ({
                    ...state,
                    claimStatus: 'failed',
                    error: payload.error || payload.message || 'Claim failed'
                }));
            }
        });

        // Listen for device registration messages
        mqttClient.onNotification('device:registered', (payload: any) => {
            console.log('[DEVICE_STORE] Device registered via MQTT:', payload);
            update(state => ({
                ...state,
                deviceId: payload.id || payload.deviceId || null,
                claimStatus: 'claimed'
            }));
        });

        // Listen for device errors
        mqttClient.onNotification('device:error', (payload: any) => {
            const errorDetails = payload?.details || payload?.error || 'Unknown error occurred';
            update(state => ({
                ...state,
                claimStatus: 'failed',
                error: errorDetails
            }));
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
        },
        
        // Set claimed device information
        setClaimedDevice: (device: Device) => {
            update(state => ({
                ...state,
                deviceId: device.id,
                name: device.name,
                deviceType: device.deviceType,
                status: device.status
            }));
        }
    };
}

// Export the store instance
export const deviceStore = createDeviceStore();
