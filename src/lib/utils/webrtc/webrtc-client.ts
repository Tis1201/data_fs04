import { webRTCStore } from '$lib/stores/webrtc-store';
import { socketStore } from '$lib/stores/websocket-store';
import { get, writable } from 'svelte/store';
import { roomStore } from '$lib/stores/room-store';

export interface WebRTCClientConfig {
    iceServers?: RTCIceServer[];
}

export class WebRTCClient {
    private peerConnection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private _processedMessages = new Set<string>();

    constructor(private config: WebRTCClientConfig = {}) {
        this.setupEventListeners();
    }

    private setupEventListeners() {
        webRTCStore.subscribe(state => {
            if (state.peerConnection) {
                this.peerConnection = state.peerConnection;
            }
            if (state.dataChannel) {
                this.dataChannel = state.dataChannel;
                
                // Set up data channel event handlers if they're not already set
                if (this.dataChannel && !this.dataChannel.onmessage) {
                    this.dataChannel.onmessage = (event) => {
                        // console.log('[WebRTC] Data channel message received:', event.data);
                        this.handleDataChannelMessage({ data: event.data });
                    };
                    
                    this.dataChannel.onopen = () => {
                        console.log('[WebRTC] Data channel opened');
                        webRTCStore.update(state => ({
                            ...state,
                            dataChannelStatus: 'open'
                        }));
                    };
                    
                    this.dataChannel.onclose = () => {
                        console.log('[WebRTC] Data channel closed');
                        webRTCStore.update(state => ({
                            ...state,
                            dataChannelStatus: 'closed'
                        }));
                    };
                }
            }
            
            // Process the latest message from the store if available
            if (state.latestMessage) {
                const message = state.latestMessage;
                
                // The message is already filtered by the WebRTC store
                // It will be the actual WebRTC message (offer, answer, candidate, etc.)
                
                // Use a simple string-based tracking to avoid processing the same message twice
                const messageKey = `${message.type}-${message.timestamp || new Date().toISOString()}`;
                if (!this._processedMessages.has(messageKey)) {
                    this._processedMessages.add(messageKey);
                    console.log('[WebRTC] Processing message:', message);
                    
                    // Handle the message based on its type
                    // Cast to string to allow compatibility cases not in WebRTCMessageType
                    switch (message.type as string) {
                        case 'offer':
                            this.handleOffer(message);
                            break;
                        case 'answer':
                            this.handleAnswer(message);
                            break;
                        case 'ice-candidate':
                        case 'candidate': // Support both naming conventions
                            this.handleIceCandidate(message);
                            break;
                        case 'data-channel-open':
                            this.handleDataChannelOpen(message);
                            break;
                        case 'data-channel-close':
                            this.handleDataChannelClose(message);
                            break;
                        case 'data-channel-message':
                            this.handleDataChannelMessage(message);
                            break;
                        case 'video-stream':
                            this.handleVideoStream(message);
                            break;
                        default:
                            console.log('[WebRTC] Unhandled message type:', message.type);
                    }
                }
            }
        });
    }

    private handleOffer(message: any) {
        try {
            console.log('[WebRTC] Handling offer:', message);
            
            // Check if we're the initiator (we created the offer)
            // If we are, we shouldn't be receiving an offer
            if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
                console.log('[WebRTC] Ignoring offer in non-stable state');
                return;
            }
            
            // Initialize peer connection if it doesn't exist
            if (!this.peerConnection) {
                this.peerConnection = new RTCPeerConnection({
                    iceServers: this.config.iceServers || [
                        { urls: 'stun:stun.l.google.com:19302' }
                    ]
                });

                this.peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log(`[WebRTC] Local ICE candidate: ${event.candidate.candidate}`);
                        // Always include the current roomId from roomStore
                        const currentRoomState = get(roomStore);
                        const roomId = currentRoomState?.roomId;
                        socketStore.send('webrtc', {
                            type: 'ice-candidate',
                            roomId,
                            candidate: event.candidate
                        });
                    } else {
                        console.log('[WebRTC] ICE candidate gathering complete');
                    }
                };
                
                // Add ice connection state change listener
                this.peerConnection.oniceconnectionstatechange = () => {
                    const iceState = this.peerConnection?.iceConnectionState;
                    console.log(`[WebRTC] ICE connection state changed to: ${iceState}`);
                    
                    if (iceState === 'connected' || iceState === 'completed') {
                        console.log('[WebRTC] ICE connection established');
                    } else if (iceState === 'failed') {
                        console.error('[WebRTC] ICE connection failed');
                    }
                };

                this.peerConnection.ondatachannel = (event) => {
                    console.log('[WebRTC] Data channel received:', event.channel.label);
                    this.dataChannel = event.channel;
                    
                    // Set up event handlers for the data channel
                    this.dataChannel.onmessage = (msgEvent) => {
                        // console.log('[WebRTC] Data channel message received:', msgEvent.data);
                        this.handleDataChannelMessage({ data: msgEvent.data });
                    };
                    
                    this.dataChannel.onopen = () => {
                        console.log('[WebRTC] Data channel opened');
                        webRTCStore.update(state => ({
                            ...state,
                            dataChannelStatus: 'open'
                        }));
                    };
                    
                    this.dataChannel.onclose = () => {
                        console.log('[WebRTC] Data channel closed');
                        webRTCStore.update(state => ({
                            ...state,
                            dataChannelStatus: 'closed'
                        }));
                    };
                    
                    webRTCStore.update(state => ({
                        ...state,
                        dataChannel: this.dataChannel
                    }));
                };
                
                // Add connection state change listener
                this.peerConnection.onconnectionstatechange = () => {
                    const connectionState = this.peerConnection?.connectionState;
                    console.log(`[WebRTC] Connection state changed to: ${connectionState}`);
                    
                    // Map RTCPeerConnectionState to our expected types
                    let status: 'disconnected' | 'connected' | 'error' = 'disconnected';
                    if (connectionState === 'connected') {
                        status = 'connected';
                    } else if (connectionState === 'failed' || connectionState === 'closed') {
                        status = 'error';
                    }
                    
                    webRTCStore.update(state => ({
                        ...state,
                        connectionStatus: status
                    }));
                    
                    if (connectionState === 'connected') {
                        console.log('[WebRTC] Connection established with remote peer!');
                    } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
                        console.log('[WebRTC] Connection lost or failed');
                    }
                };
                
                // Add track event handler
                this.peerConnection.ontrack = (event) => {
                    console.log('[WebRTC] Track received:', event);
                    
                    if (event.streams && event.streams[0]) {
                        const stream = event.streams[0];
                        console.log('[WebRTC] Received remote stream:', stream);
                        
                        webRTCStore.update(state => ({
                            ...state,
                            videoStream: stream
                        }));
                    } else {
                        console.warn('[WebRTC] Received track but no stream');
                    }
                };

                webRTCStore.update(state => ({
                    ...state,
                    peerConnection: this.peerConnection,
                    connectionStatus: 'disconnected' as const
                }));
            }

            // Ensure we have a valid SDP
            if (!message.sdp) {
                throw new Error('Missing SDP in offer message');
            }
            
            // Create a proper RTCSessionDescription object
            const offerDesc = new RTCSessionDescription({
                type: 'offer',
                sdp: message.sdp
            });
            
            console.log('[WebRTC] Setting remote description for offer');
            this.peerConnection.setRemoteDescription(offerDesc)
                .then(() => {
                    console.log('[WebRTC] Creating answer...');
                    if (!this.peerConnection) throw new Error('Peer connection lost');
                    return this.peerConnection.createAnswer();
                })
                .then(answer => {
                    console.log('[WebRTC] Setting local description for answer');
                    if (!this.peerConnection) throw new Error('Peer connection lost');
                    return this.peerConnection.setLocalDescription(answer);
                })
                .then(() => {
                    console.log('[WebRTC] Sending answer to remote peer');
                    const currentRoomState = get(roomStore);
                    const roomId = currentRoomState?.roomId;
                    // Always include the current roomId from roomStore
                    if (!this.peerConnection?.localDescription) throw new Error('No local description');
                    socketStore.send('webrtc', {
                        type: 'answer',
                        roomId,
                        sdp: this.peerConnection.localDescription.sdp
                    });
                })
                .catch((error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('[WebRTC] Error handling offer:', errorMessage);
                    webRTCStore.update(state => ({
                        ...state,
                        error: `Error handling offer: ${errorMessage}`
                    }));
                });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[WebRTC] Exception in handleOffer:', errorMessage);
            webRTCStore.update(state => ({
                ...state,
                error: `Exception in handleOffer: ${errorMessage}`
            }));
        }
    }

    private handleAnswer(message: any) {
        try {
            console.log('[WebRTC] Handling answer:', message);
            
            if (!this.peerConnection) {
                throw new Error('No peer connection established');
            }
            
            // Check if we're in the right state to receive an answer
            if (this.peerConnection.signalingState !== 'have-local-offer') {
                console.log(`[WebRTC] Ignoring answer in wrong state: ${this.peerConnection.signalingState}`);
                return;
            }
            
            // Ensure we have a valid SDP
            if (!message.sdp) {
                throw new Error('Missing SDP in answer message');
            }
            
            // Handle both string SDP and object with SDP property
            const sdp = typeof message.sdp === 'string' ? message.sdp : 
                       (message.sdp && message.sdp.sdp ? message.sdp.sdp : null);
                       
            if (!sdp) {
                throw new Error('Invalid SDP format in answer');
            }
            
            // Create a proper RTCSessionDescription object
            const answerDesc = new RTCSessionDescription({
                type: 'answer',
                sdp: sdp
            });
            
            console.log('[WebRTC] Setting remote description for answer');
            this.peerConnection.setRemoteDescription(answerDesc)
                .then(() => {
                    console.log('[WebRTC] Answer processed successfully');
                    webRTCStore.update(state => ({
                        ...state,
                        connectionStatus: 'connected'
                    }));
                })
                .catch((error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('[WebRTC] Error handling answer:', errorMessage);
                    webRTCStore.update(state => ({
                        ...state,
                        error: `Error handling answer: ${errorMessage}`
                    }));
                });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[WebRTC] Exception in handleAnswer:', errorMessage);
            webRTCStore.update(state => ({
                ...state,
                error: `Exception in handleAnswer: ${errorMessage}`
            }));
        }
    }

    private handleIceCandidate(message: any) {
        console.log('[WebRTC] Received ICE candidate from remote peer:', message.candidate);
        
        if (!this.peerConnection) {
            console.error('[WebRTC] Cannot add ICE candidate: No peer connection established');
            return;
        }
        
        if (!message.candidate) {
            console.warn('[WebRTC] Received empty ICE candidate, ignoring');
            return;
        }
        
        try {
            // Log the actual candidate string for debugging
            if (message.candidate.candidate) {
                console.log(`[WebRTC] Adding ICE candidate: ${message.candidate.candidate}`);
            }
            
            this.peerConnection.addIceCandidate(message.candidate)
                .then(() => {
                    console.log('[WebRTC] Added ICE candidate successfully');
                })
                .catch((error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('[WebRTC] Error adding ICE candidate:', errorMessage);
                    webRTCStore.update(state => ({
                        ...state,
                        error: `Error adding ICE candidate: ${errorMessage}`
                    }));
                });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[WebRTC] Exception adding ICE candidate:', errorMessage);
            webRTCStore.update(state => ({
                ...state,
                error: `Exception adding ICE candidate: ${errorMessage}`
            }));
        }
    }

    private handleDataChannelOpen(message: any) {
        if (message.channel) {
            this.dataChannel = message.channel;
            webRTCStore.update(state => ({
                ...state,
                dataChannel: this.dataChannel
            }));
        }
    }

    private handleDataChannelClose(message: any) {
        this.dataChannel = null;
        webRTCStore.update(state => ({
            ...state,
            dataChannel: null
        }));
    }

    private handleDataChannelMessage(message: any) {
        // console.log('[WebRTC] Received data channel message:', message);
        
        // Extract the message content
        let messageContent = '';
        if (typeof message.data === 'string') {
            messageContent = message.data;
        } else if (message.message && typeof message.message === 'string') {
            messageContent = message.message;
        } else {
            console.warn('[WebRTC] Data channel message has unknown format:', message);
            return;
        }
        
        // Update the store with the received message
        webRTCStore.update(state => ({
            ...state,
            lastDataChannelMessage: messageContent,
            dataChannelMessages: [...(state.dataChannelMessages || []), {
                content: messageContent,
                timestamp: new Date().toISOString(),
                direction: 'received'
            }]
        }));
        
        // Emit an event for the message
        const event = new CustomEvent('datachannel-message', {
            detail: { message: messageContent }
        });
        window.dispatchEvent(event);
    }

    private handleVideoStream(message: any) {
        console.log('[WebRTC] Handling video stream message:', message);
        
        if (!this.peerConnection) {
            console.error('[WebRTC] No peer connection established');
            return;
        }
        
        // If the message contains a stream URL or stream ID, we can handle it here
        if (message.streamId) {
            console.log(`[WebRTC] Received stream ID: ${message.streamId}`);
            // Additional handling for stream IDs if needed
        }
        
        // If the message contains any stream configuration, apply it
        if (message.config) {
            console.log('[WebRTC] Applying stream configuration:', message.config);
            // Apply any stream configuration
        }
    }

    public createDataChannel(label: string): RTCDataChannel {
        if (!this.peerConnection) {
            throw new Error('Peer connection not established');
        }
        const channel = this.peerConnection.createDataChannel(label);
        this.dataChannel = channel;
        webRTCStore.update(state => ({
            ...state,
            dataChannel: channel
        }));
        return channel;
    }

    public close() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        webRTCStore.update(state => ({
            ...state,
            peerConnection: null,
            dataChannel: null,
            connectionStatus: 'disconnected'
        }));
    }
}

// Export utility functions
export function clearEvents() {
    webRTCStore.update(state => ({
        ...state,
        latestMessage: null
    }));
}

export function sendWebRTCMessage(message: any) {
    socketStore.send('webrtc', message);
}

export function sendDataChannelMessage(message: string) {
    const state = get(webRTCStore);
    if (state.dataChannel && state.dataChannel.readyState === 'open') {
        state.dataChannel.send(message);
        
        // Also update the store with the sent message
        webRTCStore.update(state => ({
            ...state,
            dataChannelMessages: [...(state.dataChannelMessages || []), {
                content: message,
                timestamp: new Date().toISOString(),
                direction: 'sent'
            }]
        }));
        
        return true;
    } else {
        // If the data channel isn't ready, try to send via signaling server
        console.log('[WebRTC] Data channel not ready, sending via signaling');
        socketStore.send('webrtc', {
            type: 'data-channel-message',
            data: message
        });
        
        return false;
    }
}

export function initWebRTCClient(config?: WebRTCClientConfig) {
    const client = new WebRTCClient(config);
    return () => client.close();
}

// Create proper Svelte stores
const _webrtcEvents = writable<any[]>([]);
const _webrtcStatus = writable<any>({});
const _videoStream = writable<MediaStream | null>(null);

// Track the last message to avoid duplicates
let lastMessageKey = '';

// Subscribe to the main store and update the derived stores
webRTCStore.subscribe(state => {
    _webrtcStatus.set(state);
    _videoStream.set(state.videoStream);
    
    // Add the latest message to the events array if it's new
    if (state.latestMessage) {
        const messageKey = `${state.latestMessage.type}-${state.latestMessage.timestamp || new Date().toISOString()}`;
        if (messageKey !== lastMessageKey) {
            lastMessageKey = messageKey;
            _webrtcEvents.update(events => [...events, state.latestMessage!]);
        }
    }
});

// Export the stores
export const webrtcEvents = _webrtcEvents;
export const webrtcStatus = _webrtcStatus;
export const videoStream = _videoStream;
