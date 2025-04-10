import { webRTCStore } from '$lib/stores/webrtc-store';
import { socketStore } from '$lib/stores/websocket-store';
import { get, writable } from 'svelte/store';

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
                    switch (message.type) {
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
                        socketStore.send('webrtc', {
                            type: 'ice-candidate',
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
                    this.dataChannel = event.channel;
                    webRTCStore.update(state => ({
                        ...state,
                        dataChannel: this.dataChannel
                    }));
                };
                
                // Add connection state change listener
                this.peerConnection.onconnectionstatechange = () => {
                    const connectionState = this.peerConnection?.connectionState;
                    console.log(`[WebRTC] Connection state changed to: ${connectionState}`);
                    
                    webRTCStore.update(state => ({
                        ...state,
                        connectionStatus: connectionState
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
                    connectionStatus: 'connecting'
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
                    return this.peerConnection.createAnswer();
                })
                .then(answer => {
                    console.log('[WebRTC] Setting local description for answer');
                    return this.peerConnection.setLocalDescription(answer);
                })
                .then(() => {
                    console.log('[WebRTC] Sending answer to remote peer');
                    socketStore.send('webrtc', {
                        type: 'answer',
                        sdp: this.peerConnection.localDescription.sdp
                    });
                })
                .catch(error => {
                    console.error('[WebRTC] Error handling offer:', error);
                    webRTCStore.update(state => ({
                        ...state,
                        error: `Error handling offer: ${error.message}`
                    }));
                });
        } catch (error) {
            console.error('[WebRTC] Exception in handleOffer:', error);
            webRTCStore.update(state => ({
                ...state,
                error: `Exception in handleOffer: ${error.message}`
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
                .catch(error => {
                    console.error('[WebRTC] Error handling answer:', error);
                    webRTCStore.update(state => ({
                        ...state,
                        error: `Error handling answer: ${error.message}`
                    }));
                });
        } catch (error) {
            console.error('[WebRTC] Exception in handleAnswer:', error);
            webRTCStore.update(state => ({
                ...state,
                error: `Exception in handleAnswer: ${error.message}`
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
                .catch(error => {
                    console.error('[WebRTC] Error adding ICE candidate:', error);
                    webRTCStore.update(state => ({
                        ...state,
                        error: `Error adding ICE candidate: ${error.message}`
                    }));
                });
        } catch (error) {
            console.error('[WebRTC] Exception adding ICE candidate:', error);
            webRTCStore.update(state => ({
                ...state,
                error: `Exception adding ICE candidate: ${error.message}`
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
        // Handle data channel messages if needed
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
    }
}

export function initWebRTCClient(config?: WebRTCClientConfig) {
    const client = new WebRTCClient(config);
    return () => client.close();
}

// Create proper Svelte stores
const _webrtcEvents = writable([]);
const _webrtcStatus = writable({});
const _videoStream = writable(null);

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
            _webrtcEvents.update(events => [...events, state.latestMessage]);
        }
    }
});

// Export the stores
export const webrtcEvents = _webrtcEvents;
export const webrtcStatus = _webrtcStatus;
export const videoStream = _videoStream;
