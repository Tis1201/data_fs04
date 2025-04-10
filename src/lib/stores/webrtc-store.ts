import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

export interface WebRTCMessage {
    type: WebRTCMessageType;
    sdp?: string;
    candidate?: RTCIceCandidate;
    data?: any;
    label?: string;
    channelId?: string;
    timestamp?: string;
}

export interface WebRTCState {
    connectionStatus: 'disconnected' | 'connected' | 'error';
    peerConnection: RTCPeerConnection | null;
    dataChannel: RTCDataChannel | null;
    videoStream: MediaStream | null;
    latestMessage: WebRTCMessage | null;
    error: string | null;
}

const initialState: WebRTCState = {
    connectionStatus: 'disconnected',
    peerConnection: null,
    dataChannel: null,
    videoStream: null,
    latestMessage: null,
    error: null
};

function createWebRTCStore() {
    const { subscribe, update } = writable<WebRTCState>(initialState);

    if (browser) {
        socketStore.on('webrtc', (message: any) => {
            console.log(`Received WebRTC message:`, message);
            
            // Store only the latest message
            update(state => ({
                ...state,
                latestMessage: message
            }));
        });
    }

    return { subscribe, update };
}

export const webRTCStore = createWebRTCStore();