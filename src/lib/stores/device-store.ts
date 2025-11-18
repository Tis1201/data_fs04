import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { sseStore } from './sse-store';

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

    // Set up SSE listener for device messages
    if (browser) {
        sseStore.on('device', (message: any) => {
            console.log('[DEVICE_STORE] ===== DEVICE STORE RECEIVED SSE MESSAGE =====');
            console.log('[DEVICE_STORE] Full SSE message:', message);
            
            // SSE messages have payload in message.data.payload, not message.payload
            const payload = message.data?.payload || message.data || message.payload;
            
            // Check if this is a WebRTC message (old structure)
            if (payload?.type && payload.type.startsWith('webrtc:')) {
                console.log('[DEVICE_STORE] ===== WEBRTC MESSAGE DETECTED IN SSE (OLD STRUCTURE) =====');
                console.log('[DEVICE_STORE] WebRTC message type:', payload.type);
                console.log('[DEVICE_STORE] WebRTC device ID:', payload.deviceId);
            }
            console.log('[DEVICE_STORE] Final payload:', payload);
            
            if (!payload?.action) {
                console.log('[DEVICE_STORE] No action in SSE data, ignoring message');
                return;
            }
            
            switch (payload.action) {
                case 'message': {
                    const messageType = payload.type || '';
                    const deviceId = payload.deviceId || '';
                    
                    // Handle terminal-related messages
                    if (messageType.startsWith('terminal-')) {
                        const terminalMessageType = messageType as 'terminal-response' | 'terminal-connected' | 'terminal-error';
                        
                        // Create a terminal message object
                        const terminalMessage: TerminalMessage = {
                            type: terminalMessageType,
                            deviceId,
                            output: payload.output,
                            error: payload.error,
                            timestamp: new Date().toISOString()
                        };
                        
                        // Update the store with the new terminal message
                        update(state => ({
                            ...state,
                            terminalMessages: [...state.terminalMessages, terminalMessage],
                            latestTerminalMessage: terminalMessage
                        }));
                    }
                    // Handle WebRTC-related messages
                    else if (messageType.startsWith('webrtc:')) {
                        console.log('[DEVICE_STORE] ===== WEBRTC MESSAGE DETECTED VIA SSE =====');
                        console.log('[DEVICE_STORE] Full message:', message);
                        console.log('[DEVICE_STORE] Message type:', messageType);
                        console.log('[DEVICE_STORE] Device ID:', deviceId);
                        
                        const webrtcMessageType = messageType as 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice-candidate';
                        
                        // Create a WebRTC message object
                        const webrtcMessage: WebRTCMessage = {
                            type: webrtcMessageType,
                            deviceId,
                            sdp: payload.sdp,
                            candidate: payload.candidate,
                            clientMessageId: payload._clientMessageId,
                            timestamp: new Date().toISOString(),
                            scope: message.scope,
                            senderId: message.senderId
                        };
                        
                        console.log('[DEVICE_STORE] WebRTC message created:', webrtcMessage);
                        
                        // Update the store with the new WebRTC message
                        update(state => {
                            console.log('[DEVICE_STORE] Current state deviceId:', state.deviceId);
                            console.log('[DEVICE_STORE] Target deviceId:', deviceId);
                            // Only store the latest WebRTC message for the current device
                            if (!state.deviceId || state.deviceId === deviceId) {
                                console.log('[DEVICE_STORE] Updating WebRTC message in store via SSE');
                                return {
                                    ...state,
                                    latestWebRTCMessage: webrtcMessage
                                };
                            } else {
                                console.log('[DEVICE_STORE] Device ID mismatch, not updating store via SSE');
                            }
                            return state;
                        });
                    }
                    break;
                }
                
                case 'error': {
                    const errorDetails = payload.details || payload.error || 'Unknown error occurred';
                    update(state => ({
                        ...state,
                        claimStatus: 'failed',
                        error: errorDetails
                    }));
                    break;
                }
                
                case 'registered': {
                    console.log('[DEVICE_STORE] Device registered:', payload);
                    update(state => ({
                        ...state,
                        deviceId: payload.id || null,
                        claimStatus: 'claimed'
                    }));
                    break;
                }
                    
                case 'claimed': {
                    if (payload.success) {
                        console.log('[DEVICE_STORE] Device claimed successfully:', payload);
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
                    break;
                }
                    
                default:
                    console.log('[DEVICE_STORE] Unhandled action:', payload.action);
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
