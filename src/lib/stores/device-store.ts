import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

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

    // Set up WebSocket listener if in browser environment
    if (browser) {
        socketStore.on('device', (message: DeviceMessage) => {
            console.log('[DEVICE_STORE] Received device event:', message);
            
            if (!message?.payload?.action) return;
            
            switch (message.payload.action) {
                case 'message': {
                    const messageType = message.payload.type || '';
                    const deviceId = message.payload.deviceId || '';
                    
                    // Handle terminal-related messages
                    if (messageType.startsWith('terminal-')) {
                        const terminalMessageType = messageType as 'terminal-response' | 'terminal-connected' | 'terminal-error';
                        
                        // Create a terminal message object
                        const terminalMessage: TerminalMessage = {
                            type: terminalMessageType,
                            deviceId,
                            output: message.payload.output,
                            error: message.payload.error,
                            timestamp: new Date().toISOString()
                        };
                        
                        console.log('[DEVICE_STORE] Terminal message received:', terminalMessage);
                        
                        // Update the store with the new terminal message
                        update(state => {
                            // Only store messages for the current device
                            if (state.deviceId && state.deviceId === deviceId) {
                                return {
                                    ...state,
                                    terminalMessages: [...state.terminalMessages, terminalMessage],
                                    latestTerminalMessage: terminalMessage
                                };
                            }
                            return state;
                        });
                    }
                    // Handle WebRTC-related messages
                    else if (messageType.startsWith('webrtc:')) {
                        const webrtcMessageType = messageType as 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice-candidate';
                        
                        // Create a WebRTC message object
                        const webrtcMessage: WebRTCMessage = {
                            type: webrtcMessageType,
                            deviceId,
                            sdp: message.payload.sdp,
                            candidate: message.payload.candidate,
                            clientMessageId: message.payload._clientMessageId,
                            timestamp: new Date().toISOString(),
                            scope: message.scope,
                            senderId: message.senderId
                        };
                        
                        console.log('[DEVICE_STORE] WebRTC message received:', webrtcMessage);
                        
                        // Update the store with the new WebRTC message
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
                    break;
                }
                
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
