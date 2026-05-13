import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { mqttClient } from '$lib/client/mqtt/mqttClient';
import type { WebRTCMessageType } from '$lib/server/webrtc/WebrtcSignalingUtils';

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
        // Listen to WebRTC messages via MQTT
        mqttClient.onNotification('webrtc:*', (payload: any) => {
            console.log(`[WebRTCStore] Received WebRTC notification via MQTT:`, payload);
            
            // Check if this is a WebRTC message
            const messageType = payload?.type || '';
            if (messageType.startsWith('webrtc:')) {
                const webrtcMessage: WebRTCMessage = {
                    type: messageType as any,
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