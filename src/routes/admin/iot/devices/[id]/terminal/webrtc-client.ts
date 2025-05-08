import { socketStore } from "$lib/stores/websocket-store";
import { webRTCStore } from "$lib/stores/webrtc-store";
import type { WebRTCMessage, DataChannelMessage } from "$lib/stores/webrtc-store";

// WebRTC client class for handling WebRTC operations
export class WebRTCClient {
    private deviceId: string;
    private terminalCallback: ((message: string) => void) | null = null;
    private peerConnection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;

    /****************************************************************************
    * 
    * Constructure
    * 
    ****************************************************************************/
    constructor(deviceId: string) {
        this.deviceId = deviceId;
    }

    /****************************************************************************
    * 
    * Passing message back to Page by callback
    * 
    ****************************************************************************/
    setTerminalCallback(callback: (message: string) => void) {
        this.terminalCallback = callback;
    }

    /****************************************************************************
    * 
    * Innitialize WebRTC connection
    * 
    ****************************************************************************/
    initializePeerConnection(): RTCPeerConnection {
        if (this.peerConnection) {
            // Close existing connection if it exists
            this.peerConnection.close();
        }

        console.log("Initializing WebRTC peer connection");

        // Close existing connection if it exists
        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            } catch (e) {
                console.warn('[Terminal WebRTC] Error closing existing peer connection:', e);
            }
        }

        this.peerConnection = this.peerConnection = new RTCPeerConnection({
            iceServers:  [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // Set up ICE candidate handling
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[Terminal WebRTC] Local ICE candidate: ${event.candidate.candidate}`);

                // Send ICE candidate to the device
                const iceCandidateMessage = {
                    type: "device",
                    scope: `subscription:device:${this.deviceId}`,
                    payload: {
                        action: "message",
                        type: "webrtc:ice-candidate",
                        deviceId: this.deviceId,
                        candidate: {
                            candidate: event.candidate.candidate,
                            sdpMid: event.candidate.sdpMid,
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                            usernameFragment: event.candidate.usernameFragment
                        },
                        _clientMessageId: `ice-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 10)}`
                    }
                };

                socketStore.send(iceCandidateMessage);
            } else {
                console.log('[Terminal WebRTC] ICE candidate gathering complete');
            }
        };

        // Monitor connection state changes
        // this.peerConnection.oniceconnectionstatechange = () => {
        //     const iceState = this.peerConnection?.iceConnectionState;
        //     console.log(`[Terminal WebRTC] ICE connection state changed to: ${iceState}`);

        //     if (iceState === 'connected' || iceState === 'completed') {
        //         console.log('[Terminal WebRTC] Connection established');
        //         // Only update UI and store if we're transitioning from a non-connected state
        //         // This prevents repeated notifications when the state cycles between connected and disconnected
        //         if (webRTCStore.connectionStatus !== 'connected') {
        //             webRTCStore.update(state => ({ ...state, connectionStatus: 'connected' }));
        //             if (this.terminalCallback) {
        //                 this.terminalCallback("\r\n\x1b[1;32mWebRTC connection established!\x1b[0m\r\n");
        //             }
        //         }
        //     } else if (iceState === 'failed') {
        //         // Only treat 'failed' as a definite error
        //         console.error('[Terminal WebRTC] Connection failed');
        //         webRTCStore.update(state => ({ ...state, connectionStatus: 'disconnected' }));
        //         if (this.terminalCallback) {
        //             this.terminalCallback("\r\n\x1b[1;31mWebRTC connection failed.\x1b[0m\r\n");
        //         }
        //     } else if (iceState === 'closed') {
        //         // Handle 'closed' state - this is a normal state when connection is deliberately closed
        //         console.log('[Terminal WebRTC] Connection closed');
        //         webRTCStore.update(state => ({ ...state, connectionStatus: 'disconnected' }));
        //     }
        //     // Note: We're intentionally ignoring 'disconnected' state as it's temporary
        //     // and the connection often recovers automatically
        // };

        // Add a grace period timer for ICE disconnections
        let disconnectionTimer: ReturnType<typeof setTimeout> | null = null;
        
        this.peerConnection.oniceconnectionstatechange = () => {
            const iceState = this.peerConnection?.iceConnectionState;
            console.log(`[WebRTC] ICE connection state changed to: ${iceState}`);

            if (iceState === 'connected' || iceState === 'completed') {
                console.log('[WebRTC] ICE connection established');
                
                // Clear any pending disconnection timer
                if (disconnectionTimer) {
                    clearTimeout(disconnectionTimer);
                    disconnectionTimer = null;
                }
                
                // Update the store to connected state
                webRTCStore.update(state => ({
                    ...state,
                    connectionStatus: 'connected'
                }));
                
                if (this.terminalCallback) {
                    this.terminalCallback("\r\n\x1b[1;32mWebRTC connection established!\x1b[0m\r\n");
                }
            } else if (iceState === 'disconnected') {
                // Don't immediately mark as disconnected - this can happen temporarily
                // especially in mobile networks or when network conditions change
                console.log('[WebRTC] ICE connection disconnected, waiting for recovery...');
                
                // Set a timer to mark as disconnected only if it doesn't recover within 5 seconds
                if (!disconnectionTimer) {
                    disconnectionTimer = setTimeout(() => {
                        console.log('[WebRTC] ICE connection still disconnected after grace period');
                        webRTCStore.update(state => ({
                            ...state,
                            connectionStatus: 'disconnected'
                        }));
                        disconnectionTimer = null;
                    }, 5000); // 5 second grace period
                }
            } else if (iceState === 'failed') {
                console.error('[WebRTC] ICE connection failed');
                
                // Clear any pending disconnection timer
                if (disconnectionTimer) {
                    clearTimeout(disconnectionTimer);
                    disconnectionTimer = null;
                }
                
                webRTCStore.update(state => ({
                    ...state,
                    connectionStatus: 'error',
                    error: 'ICE connection failed'
                }));
                
                if (this.terminalCallback) {
                    this.terminalCallback("\r\n\x1b[1;31mWebRTC connection failed.\x1b[0m\r\n");
                }
            } else if (iceState === 'closed') {
                // Clear any pending disconnection timer
                if (disconnectionTimer) {
                    clearTimeout(disconnectionTimer);
                    disconnectionTimer = null;
                }
                
                webRTCStore.update(state => ({
                    ...state,
                    connectionStatus: 'disconnected'
                }));
            }
        };

        // Add connection state change handler for additional stability
        this.peerConnection.ondatachannel = (event) => {
            console.log('[WebRTC] Data channel received:', event.channel.label);
            this.dataChannel = event.channel;

            // Set up event handlers for the data channel
            this.dataChannel.onmessage = (msgEvent) => {
                console.log('[WebRTC] Data channel message received:', msgEvent.data);
                // this.handleDataChannelMessage({ data: msgEvent.data });
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


        // Add negotiation needed handler
        this.peerConnection.onnegotiationneeded = () => {
            console.log('[Terminal WebRTC] Negotiation needed event fired');
            // We don't automatically renegotiate, but log this for debugging
        };

     

        webRTCStore.update(state => ({ ...state, peerConnection: this.peerConnection }));
        return this.peerConnection;
    }

    /**
     * Handle WebRTC messages from the device
     */
    handleWebRTCMessage(message: any) {
        if (!message) return;

        // Only process messages for this specific device
        if (message.deviceId && message.deviceId !== this.deviceId) {
            return;
        }

        console.log("Processing WebRTC message:", message);

        // Handle different WebRTC message types
        switch (message.type) {
            case "webrtc:offer":
                this.handleOffer(message);
                break;
            case "webrtc:answer":
                this.handleAnswer(message);
                break;
            case "webrtc:ice-candidate":
                this.handleIceCandidate(message);
                break;
            default:
                console.log(`[Terminal WebRTC] Unhandled message type: ${message.type}`);
        }
    }

    /**
     * Handle WebRTC offer messages
     */
    private handleOffer(message: any) {
        console.log("Received WebRTC offer:", message);

        // Check if we're in a state where we can process an offer
        if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
            console.log('[Terminal WebRTC] Ignoring offer in non-stable state:', this.peerConnection.signalingState);
            return;
        }

        // Initialize peer connection if it doesn't exist
        if (!this.peerConnection) {
            this.peerConnection = this.initializePeerConnection();
        }

        // Ensure we have a valid SDP
        if (!message.sdp) {
            console.error("Missing SDP in offer message");
            webRTCStore.update(state => ({ ...state, error: "Missing SDP in offer message" }));
            return;
        }

        // Create a proper RTCSessionDescription object
        const offerDesc = new RTCSessionDescription({
            type: 'offer',
            sdp: message.sdp
        });

        console.log('[Terminal WebRTC] Setting remote description for offer');
        this.peerConnection.setRemoteDescription(offerDesc)
            .then(() => {
                console.log('[Terminal WebRTC] Creating answer...');
                return this.peerConnection!.createAnswer();
            })
            .then(answer => {
                console.log('[Terminal WebRTC] Setting local description for answer');
                return this.peerConnection!.setLocalDescription(answer);
            })
            .then(() => {
                console.log('[Terminal WebRTC] Sending answer to device');

                // Create a proper WebRTC answer message
                const answerMessage = {
                    type: "device",
                    scope: `subscription:device:${this.deviceId}`,
                    payload: {
                        action: "message",
                        type: "webrtc:answer",
                        deviceId: this.deviceId,
                        sdp: this.peerConnection!.localDescription!.sdp,
                        _clientMessageId: `answer-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 10)}`
                    }
                };

                // Send the answer message via socketStore
                console.log("Sending WebRTC answer:", answerMessage);
                socketStore.send(answerMessage);
            })
            .catch(error => {
                console.error('[Terminal WebRTC] Error handling offer:', error);
                webRTCStore.update(state => ({ ...state, error: `Error handling offer: ${error.message}` }));
            });
    }

    /**
     * Handle WebRTC answer messages
     */
    private handleAnswer(message: any) {
        console.log("Received WebRTC answer:", message);

        // Ensure we have a peer connection and valid SDP
        if (!this.peerConnection) {
            console.error("No peer connection available for answer");
            webRTCStore.update(state => ({ ...state, error: "No peer connection available for answer" }));
            return;
        }

        // Check if we're in the right state to receive an answer
        if (this.peerConnection.signalingState !== 'have-local-offer') {
            console.log(`[Terminal WebRTC] Ignoring answer in wrong state: ${this.peerConnection.signalingState}`);
            return;
        }

        if (!message.sdp) {
            console.error("Missing SDP in answer message");
            webRTCStore.update(state => ({ ...state, error: "Missing SDP in answer message" }));
            return;
        }

        // Create a proper RTCSessionDescription object
        const answerDesc = new RTCSessionDescription({
            type: 'answer',
            sdp: message.sdp
        });

        console.log('[Terminal WebRTC] Setting remote description for answer');
        this.peerConnection.setRemoteDescription(answerDesc)
            .then(() => {
                console.log('[Terminal WebRTC] Remote description set successfully');
            })
            .catch(error => {
                console.error('[Terminal WebRTC] Error setting remote description:', error);
                webRTCStore.update(state => ({ ...state, error: `Error setting remote description: ${error.message}` }));
            });
    }

    /**
     * Handle WebRTC ICE candidate messages
     */
    private handleIceCandidate(message: any) {
        // Ensure we have a peer connection and valid candidate
        if (!this.peerConnection) {
            console.error("No peer connection available for ICE candidate");
            webRTCStore.update(state => ({ ...state, error: "No peer connection available for ICE candidate" }));
            return;
        }

        if (!message.candidate) {
            console.warn("[Terminal WebRTC] Received empty ICE candidate, ignoring");
            return;
        }

        // Check connection state before processing new ICE candidates
        const currentIceState = this.peerConnection.iceConnectionState;
        const currentConnectionState = this.peerConnection.connectionState;
        
        // Log the actual candidate string for debugging
        if (message.candidate.candidate) {
            console.log(`[Terminal WebRTC] Received ICE candidate: ${message.candidate.candidate}`);
            console.log(`[Terminal WebRTC] Current ICE state: ${currentIceState}, Connection state: ${currentConnectionState}`);
        }

        // If we're already connected or completed, be more selective about adding candidates
        if (currentIceState === 'connected' || currentIceState === 'completed') {
            // For already connected sessions, only add candidates that might improve the connection
            // This helps prevent unnecessary connection state changes
            const candidateStr = message.candidate.candidate.toLowerCase();
            
            // Only add certain types of candidates when already connected
            // Typically relay candidates might be useful even after connection
            if (candidateStr.includes('relay') || candidateStr.includes('srflx')) {
                console.log('[Terminal WebRTC] Adding potential improvement candidate despite already being connected');
            } else {
                console.log('[Terminal WebRTC] Ignoring redundant ICE candidate as connection is already established');
                return; // Skip adding this candidate
            }
        }

        // Create a proper RTCIceCandidate object
        const iceCandidate = new RTCIceCandidate({
            candidate: message.candidate.candidate,
            sdpMid: message.candidate.sdpMid,
            sdpMLineIndex: message.candidate.sdpMLineIndex
        });

        console.log('[Terminal WebRTC] Adding ICE candidate');
        this.peerConnection.addIceCandidate(iceCandidate)
            .then(() => {
                console.log('[Terminal WebRTC] ICE candidate added successfully');
            })
            .catch(error => {
                console.error('[Terminal WebRTC] Error adding ICE candidate:', error);
                webRTCStore.update(state => ({ ...state, error: `Error adding ICE candidate: ${error.message}` }));
            });
    }

    /**
     * Send a message through the WebRTC data channel
     */
    sendMessage(message: string): boolean {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            console.error('[Terminal WebRTC] Cannot send message: Data channel not open');
            return false;
        }

        try {
            this.dataChannel.send(message);
            return true;
        } catch (error) {
            console.error('[Terminal WebRTC] Error sending message:', error);
            return false;
        }
    }

    /**
     * Initialize WebRTC connection to the device
     */
    connect() {
        try {
            const message = {
                type: "device",
                scope: `subscription:device:${this.deviceId}`,
                payload: {
                    action: "message",
                    type: "webrtc:connect",
                    deviceId: this.deviceId,
                    timestamp: new Date().toISOString(),
                },
            };

            // Send the complete message object
            socketStore.send(message);
            if (this.terminalCallback) {
                this.terminalCallback("\r\n\x1b[1;32mWebRTC connection request sent!\x1b[0m\r\n");
                this.terminalCallback("\r\nWaiting for device response...\r\n");
            }
            return true;
        } catch (error) {
            console.error("Error sending WebRTC connection request:", error);
            webRTCStore.update(state => ({ ...state, error: `Error sending connection request: ${error.message}` }));
            if (this.terminalCallback) {
                this.terminalCallback(
                    `\r\n\x1b[1;31mError sending WebRTC connection request: ${error.message}\x1b[0m\r\n`,
                );
            }
            return false;
        }
    }

    /**
     * Clean up WebRTC resources
     */
    cleanup() {
        console.log('[Terminal WebRTC] Starting cleanup of WebRTC resources');

        // Close data channel if it exists
        if (this.dataChannel) {
            try {
                this.dataChannel.close();
            } catch (e) {
                console.warn('[Terminal WebRTC] Error closing data channel:', e);
            }
            this.dataChannel = null;
            webRTCStore.update(state => ({ ...state, dataChannel: null, dataChannelStatus: 'closed' }));
        }

        // Close peer connection if it exists
        if (this.peerConnection) {
            try {
                // Remove all event listeners before closing
                this.peerConnection.onicecandidate = null;
                this.peerConnection.oniceconnectionstatechange = null;
                this.peerConnection.onconnectionstatechange = null;
                this.peerConnection.ondatachannel = null;
                this.peerConnection.onnegotiationneeded = null;

                // Close the connection
                this.peerConnection.close();
            } catch (e) {
                console.warn('[Terminal WebRTC] Error closing peer connection:', e);
            }
            this.peerConnection = null;
            webRTCStore.update(state => ({ ...state, peerConnection: null }));
        }

        webRTCStore.update(state => ({ ...state, connectionStatus: 'disconnected' }));
        console.log('[Terminal WebRTC] Cleaned up WebRTC resources');
    }
}

/**
 * Helper function to create a client message
 */
export function createClientMessage(type: string, scope: string, payload: any) {
    return {
        type,
        scope: `subscription:${scope}`,
        payload: {
            ...payload,
            timestamp: new Date().toISOString(),
            _clientMessageId: `${type}-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 10)}`
        }
    };
}
