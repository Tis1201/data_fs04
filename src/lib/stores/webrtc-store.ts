import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { sseStore } from './sse-store';

export interface WebRTCMessage {
    type: WebRTCMessageType;
    sdp?: string;
    candidate?: RTCIceCandidate;
    data?: any;
    label?: string;
    channelId?: string;
    timestamp?: string;
}

export interface DataChannelMessage {
    content: string;
    timestamp: string;
    direction: 'sent' | 'received';
}

export interface WebRTCState {
    connectionStatus: 'disconnected' | 'connected' | 'error';
    peerConnection: RTCPeerConnection | null;
    dataChannel: RTCDataChannel | null;
    dataChannelStatus?: 'open' | 'closed' | 'connecting';
    dataChannelMessages?: DataChannelMessage[];
    lastDataChannelMessage?: string;
    videoStream: MediaStream | null;
    latestMessage: WebRTCMessage | null;
    error: string | null;
}

const initialState: WebRTCState = {
    connectionStatus: 'disconnected',
    peerConnection: null,
    dataChannel: null,
    dataChannelStatus: 'closed',
    dataChannelMessages: [],
    videoStream: null,
    latestMessage: null,
    error: null
};

function createWebRTCStore() {
    const { subscribe, update } = writable<WebRTCState>(initialState);

    if (browser) {
        // Listen to WebRTC messages via SSE (device events)
        sseStore.on('device', (message: any) => {
            const payload = message.data?.payload || message.data || message.payload;
            
            // Check if this is a WebRTC message
            if (payload?.action === 'message' && payload?.type?.startsWith('webrtc:')) {
                console.log(`[WebRTCStore] Received WebRTC message via SSE:`, payload);
                
                const webrtcMessage: WebRTCMessage = {
                    type: payload.type as any,
                    sdp: payload.sdp,
                    candidate: payload.candidate,
                    data: payload,
                    timestamp: payload.timestamp || new Date().toISOString()
                };
                
                // Store only the latest message
                update(state => ({
                    ...state,
                    latestMessage: webrtcMessage
                }));
            }
        });
    }

    return { subscribe, update };
}

export const webRTCStore = createWebRTCStore();