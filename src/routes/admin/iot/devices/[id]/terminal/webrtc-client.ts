import { socketStore } from "$lib/stores/websocket-store";
import { writable, type Writable } from "svelte/store";

// WebRTC store for state management
export const webrtcStore = createWebRTCStore();

// WebRTC state interface
interface WebRTCState {
  isConnected: boolean;
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  lastMessage: string | null;
  error: string | null;
}

// Create WebRTC store with initial state
function createWebRTCStore() {
  const initialState: WebRTCState = {
    isConnected: false,
    peerConnection: null,
    dataChannel: null,
    lastMessage: null,
    error: null
  };

  const { subscribe, set, update } = writable<WebRTCState>(initialState);

  return {
    subscribe,
    reset: () => set(initialState),
    setConnected: (isConnected: boolean) => update(state => ({ ...state, isConnected })),
    setError: (error: string | null) => update(state => ({ ...state, error })),
    setLastMessage: (lastMessage: string | null) => update(state => ({ ...state, lastMessage })),
    setPeerConnection: (peerConnection: RTCPeerConnection | null) => 
      update(state => ({ ...state, peerConnection })),
    setDataChannel: (dataChannel: RTCDataChannel | null) => 
      update(state => ({ ...state, dataChannel })),
    // Additional methods can be added here
  };
}

// WebRTC client class for handling WebRTC operations
export class WebRTCClient {
  private deviceId: string;
  private terminalCallback: ((message: string) => void) | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  /**
   * Set a callback function to handle terminal output
   */
  setTerminalCallback(callback: (message: string) => void) {
    this.terminalCallback = callback;
  }

  /**
   * Initialize WebRTC peer connection
   */
  initializePeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      // Close existing connection if it exists
      this.peerConnection.close();
    }
    
    console.log("Initializing WebRTC peer connection");
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
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
              sdpMLineIndex: event.candidate.sdpMLineIndex
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
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log(`[Terminal WebRTC] ICE connection state changed to: ${iceState}`);
      
      if (iceState === 'connected' || iceState === 'completed') {
        console.log('[Terminal WebRTC] Connection established');
        webrtcStore.setConnected(true);
        if (this.terminalCallback) {
          this.terminalCallback("\r\n\x1b[1;32mWebRTC connection established!\x1b[0m\r\n");
        }
      } else if (iceState === 'failed') {
        // Only treat 'failed' as a definite error, not 'disconnected' or 'closed'
        console.error('[Terminal WebRTC] Connection failed');
        webrtcStore.setConnected(false);
        if (this.terminalCallback) {
          this.terminalCallback("\r\n\x1b[1;31mWebRTC connection failed.\x1b[0m\r\n");
        }
      } else if (iceState === 'closed') {
        // Handle 'closed' state separately - this is a normal state when connection is deliberately closed
        console.log('[Terminal WebRTC] Connection closed');
        webrtcStore.setConnected(false);
      }
      // Note: 'disconnected' is a temporary state and might recover, so we don't treat it as an error
    };
    
    // Handle incoming data channels
    this.peerConnection.ondatachannel = (event) => {
      console.log('[Terminal WebRTC] Data channel received:', event.channel.label);
      this.dataChannel = event.channel;
      webrtcStore.setDataChannel(this.dataChannel);
      
      // Set up data channel event handlers
      this.dataChannel.onmessage = (msgEvent) => {
        console.log('[Terminal WebRTC] Data channel message received:', msgEvent.data);
        webrtcStore.setLastMessage(msgEvent.data);
        if (this.terminalCallback) {
          this.terminalCallback(`\r\n[WebRTC] ${msgEvent.data}\r\n`);
        }
      };
      
      this.dataChannel.onopen = () => {
        console.log('[Terminal WebRTC] Data channel opened');
        if (this.terminalCallback) {
          this.terminalCallback("\r\n\x1b[1;32mWebRTC data channel opened!\x1b[0m\r\n");
        }
      };
      
      this.dataChannel.onclose = () => {
        console.log('[Terminal WebRTC] Data channel closed');
        if (this.terminalCallback) {
          this.terminalCallback("\r\n\x1b[1;31mWebRTC data channel closed.\x1b[0m\r\n");
        }
      };
    };
    
    webrtcStore.setPeerConnection(this.peerConnection);
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
        console.log("Received WebRTC offer:", message);
        
        // Initialize peer connection if it doesn't exist
        if (!this.peerConnection) {
          this.peerConnection = this.initializePeerConnection();
        }
        
        // Ensure we have a valid SDP
        if (!message.sdp) {
          console.error("Missing SDP in offer message");
          webrtcStore.setError("Missing SDP in offer message");
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
            webrtcStore.setError(`Error handling offer: ${error.message}`);
          });
        break;
        
      case "webrtc:answer":
        console.log("Received WebRTC answer:", message);
        
        // Ensure we have a peer connection and valid SDP
        if (!this.peerConnection) {
          console.error("No peer connection available for answer");
          webrtcStore.setError("No peer connection available for answer");
          return;
        }
        
        if (!message.sdp) {
          console.error("Missing SDP in answer message");
          webrtcStore.setError("Missing SDP in answer message");
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
            webrtcStore.setError(`Error setting remote description: ${error.message}`);
          });
        break;
        
      case "webrtc:ice-candidate":
        console.log("Received WebRTC ICE candidate:", message);
        
        // Ensure we have a peer connection and valid candidate
        if (!this.peerConnection) {
          console.error("No peer connection available for ICE candidate");
          webrtcStore.setError("No peer connection available for ICE candidate");
          return;
        }
        
        if (!message.candidate) {
          console.error("Missing candidate data in ICE candidate message");
          webrtcStore.setError("Missing candidate data in ICE candidate message");
          return;
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
            webrtcStore.setError(`Error adding ICE candidate: ${error.message}`);
          });
        break;
    }
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
      webrtcStore.setError(`Error sending connection request: ${error.message}`);
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
    // Close data channel if it exists
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
      webrtcStore.setDataChannel(null);
    }
    
    // Close peer connection if it exists
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      webrtcStore.setPeerConnection(null);
    }
    
    webrtcStore.setConnected(false);
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
