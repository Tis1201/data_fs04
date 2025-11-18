// Centralized WebRTCClient used by both admin and user routes
// Moved from route-specific implementations to avoid duplication.

import { sseStore } from "$lib/stores/sse-store";
import { webRTCStore } from "$lib/stores/webrtc-store";
import type { WebRTCMessage } from "$lib/stores/webrtc-store";

export interface RDPOptions {
  frameRate?: number;
  quality?: number;
  captureMode?: 'test' | 'screen';
  resolution?: { width: number; height: number };
}

export type DataChannelCallback = (dataChannel: RTCDataChannel) => void;
export type ConnectionStateCallback = (state: RTCPeerConnectionState) => void;
export type TerminalOutputCallback = (output: string) => void;
export type TrackCallback = (track: MediaStreamTrack) => void;

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private terminalCB: TerminalOutputCallback | null = null;
  private onDataChannelOpenCB: DataChannelCallback | null = null;
  private onConnectionStateCB: ConnectionStateCallback | null = null;
  onTrackHandler: TrackCallback | null = null;

  config: any;

  constructor(private deviceId: string) {
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: [
            "turn:ss-turn1.xirsys.com:80?transport=udp",
            "turn:ss-turn1.xirsys.com:3478?transport=udp",
            "turn:ss-turn1.xirsys.com:80?transport=tcp",
            "turn:ss-turn1.xirsys.com:3478?transport=tcp",
            "turns:ss-turn1.xirsys.com:443?transport=tcp",
            "turns:ss-turn1.xirsys.com:5349?transport=tcp"
          ],
          username: 'S2kFk44DqbzeOOJ03gLpLJ1512TN2tgH42g02QBLGyVZ8bmv47Zm6QsRqdu1KfnKAAAAAGjaCsdiYWNoc29kYTMyNg==',
          credential: 'a919482e-9cec-11f0-998a-0242ac140004'
        }
      ]
    };
  }

  connect() {
    console.log('[WebRTCClient] ===== INITIATING CONNECTION =====');
    console.log('[WebRTCClient] Device ID:', this.deviceId);
    console.log('[WebRTCClient] SSE store available:', !!sseStore);
    
    // Clean up any existing connection before connecting
    if (this.peerConnection || this.dataChannel) {
      console.log('[WebRTCClient] Cleaning up existing connection before reconnecting');
      this.cleanup();
    }
    
    // Ensure SSE connection is established
    if (!sseStore.isConnected) {
      console.log('[WebRTCClient] SSE not connected, connecting...');
      sseStore.connect('/api/sse', { withCredentials: true });
    }
    
    console.log('[WebRTCClient] ===== PREPARING TO SEND CONNECT MESSAGE VIA SSE =====');
    
    // Send webrtc:connect via SSE (fire-and-forget, no response needed)
    sseStore.sendMessageWithoutResponse({
      type: 'device',
      scope: 'user:self',
      payload: {
        action: 'message',
        type: 'webrtc:connect',
        deviceId: this.deviceId
      }
    }).then(() => {
      console.log('[WebRTCClient] ✅ webrtc:connect sent via SSE successfully');
    }).catch(error => {
      console.error('[WebRTCClient] ❌ Error sending webrtc:connect via SSE:', error);
      console.error('[WebRTCClient] Error stack:', error instanceof Error ? error.stack : 'No stack');
    });
  }

  setTerminalCallback(cb: TerminalOutputCallback) {
    this.terminalCB = cb;
  }

  setDataChannelOpenCallback(cb: DataChannelCallback) {
    this.onDataChannelOpenCB = cb;
    if (this.dataChannel && this.dataChannel.readyState === 'open') cb(this.dataChannel);
  }

  setConnectionStateCallback(cb: ConnectionStateCallback) {
    this.onConnectionStateCB = cb;
    if (this.peerConnection) cb(this.peerConnection.connectionState as RTCPeerConnectionState);
  }

  private handleDataChannelOpen = () => {
    webRTCStore.update(state => ({ ...state, dataChannelStatus: 'open', dataChannel: this.dataChannel }));
    if (this.onDataChannelOpenCB && this.dataChannel) this.onDataChannelOpenCB(this.dataChannel);
  };

  sendTerminalInput(input: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      if (this.terminalCB) this.terminalCB("\r\n\x1b[1;31mError: Data channel not open\x1b[0m\r\n");
      return;
    }
    let processedInput = input;
    if (processedInput === '\r\n' || processedInput === '\n') processedInput = '\r';
    const message = { type: 'terminal:input', data: processedInput, timestamp: Date.now() };
    try { this.dataChannel.send(JSON.stringify(message)); } catch {}
  }

  sendTerminalResize(rows: number, cols: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    const message = { type: 'terminal:resize', rows, cols, timestamp: Date.now() };
    try { this.dataChannel.send(JSON.stringify(message)); } catch {}
  }

  sendPing() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try { this.dataChannel.send(JSON.stringify({ type: 'ping', timestamp: Date.now() })); } catch {}
  }

  sendMouseMove(x: number, y: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try { this.dataChannel.send(JSON.stringify({ type: 'mouse:move', x, y, timestamp: Date.now() })); } catch {}
  }

  sendMouseClick(button: string, x: number, y: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try { this.dataChannel.send(JSON.stringify({ type: 'mouse:click', button, x, y, timestamp: Date.now() })); } catch {}
  }

  sendMouseScroll(direction: string, amount: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try { this.dataChannel.send(JSON.stringify({ type: 'mouse:scroll', direction, amount, timestamp: Date.now() })); } catch {}
  }

  sendKeyPress(key: string, modifiers: string[] = []) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try { this.dataChannel.send(JSON.stringify({ type: 'key:press', key, modifiers, timestamp: Date.now() })); } catch {}
  }

  sendTextInput(text: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try { this.dataChannel.send(JSON.stringify({ type: 'text:input', text, timestamp: Date.now() })); } catch {}
  }

  sendRDPStart(options: RDPOptions = {}) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    const payload = { frameRate: options.frameRate || 15, quality: options.quality || 80, captureMode: options.captureMode || 'screen', ...options };
    try { this.dataChannel.send(JSON.stringify({ type: 'rdp:start', options: payload, timestamp: Date.now() })); } catch {}
  }

  sendRDPStop() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try { this.dataChannel.send(JSON.stringify({ type: 'rdp:stop', timestamp: Date.now() })); } catch {}
  }

  cleanup() {
    console.log('[WebRTCClient] Cleaning up WebRTC resources...');
    
    // Close data channel
    if (this.dataChannel) { 
      try {
        this.dataChannel.close();
        console.log('[WebRTCClient] Data channel closed');
      } catch (err) {
        console.warn('[WebRTCClient] Error closing data channel:', err);
      }
      this.dataChannel = null;
    }
    
    // Close peer connection
    if (this.peerConnection) { 
      try {
        this.peerConnection.close();
        console.log('[WebRTCClient] Peer connection closed');
      } catch (err) {
        console.warn('[WebRTCClient] Error closing peer connection:', err);
      }
      this.peerConnection = null;
    }
    
    // Update store
    webRTCStore.update(state => ({ 
      ...state, 
      dataChannelStatus: 'closed', 
      dataChannel: null,
      peerConnection: null,
      videoStream: null,
      connectionState: 'closed',
      connectionStatus: 'disconnected'
    }));
    
    console.log('[WebRTCClient] Cleanup complete');
  }

  async handleWebRTCMessage(message: WebRTCMessage) {
    console.log('[WebRTCClient] ===== HANDLING WEBRTC MESSAGE =====');
    console.log('[WebRTCClient] Received message:', message);
    console.log('[WebRTCClient] Current peerConnection state:', this.peerConnection?.signalingState);
    console.log('[WebRTCClient] Current dataChannel state:', this.dataChannel?.readyState);
    const msg_type = message.type;
    console.log('[WebRTCClient] Message type:', msg_type);
    
    try {
      switch (msg_type) {
        case 'webrtc:offer':
          console.log('[WebRTCClient] Processing webrtc:offer - will create answer');
          await this.handleOffer(message);
          console.log('[WebRTCClient] handleOffer completed');
          break;
        case 'webrtc:answer':
          console.log('[WebRTCClient] Processing webrtc:answer');
          await this.handleAnswer(message);
          break;
        case 'webrtc:ice-candidate':
          console.log('[WebRTCClient] Processing webrtc:ice-candidate');
          await this.handleIceCandidate(message);
          break;
        default:
          console.log('[WebRTCClient] Unknown message type:', msg_type);
          break;
      }
    } catch (error: any) {
      console.error('[WebRTCClient] Error handling WebRTC message:', error);
      console.error('[WebRTCClient] Error stack:', error.stack);
      webRTCStore.update(state => ({ 
        ...state, 
        error: `Failed to handle WebRTC message: ${error.message}`,
        connectionState: 'failed'
      }));
    }
  }

  private handleDataChannelMessage(data: string) {
    if (!data || data.length === 0) return;
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case 'pong':
          break;
        case 'terminal:output':
          if (this.terminalCB && message.data) this.terminalCB(message.data);
          break;
        case 'terminal:error':
          if (this.terminalCB && message.data) this.terminalCB(`\r\n\x1b[1;31mError: ${message.data}\x1b[0m\r\n`);
          break;
        default:
          break;
      }
    } catch {
      if (this.terminalCB) this.terminalCB(data);
    }
  }

  private async handleIceCandidate(message: any) {
    console.log('[WebRTCClient] ===== HANDLING ICE CANDIDATE =====');
    console.log('[WebRTCClient] ICE candidate message:', message);
    
    if (!this.peerConnection) {
      console.warn('[WebRTCClient] No peer connection available for ICE candidate');
      return;
    }
    
    const cand = message.candidate || message.payload?.candidate;
    console.log('[WebRTCClient] ICE candidate:', cand);
    
    if (cand) {
      try {
        const iceCandidate = new RTCIceCandidate(cand);
        await this.peerConnection.addIceCandidate(iceCandidate);
        console.log('[WebRTCClient] ICE candidate added successfully');
      } catch (error: any) {
        console.error('[WebRTCClient] Error adding ICE candidate:', error);
        webRTCStore.update(state => ({ 
          ...state, 
          error: `Failed to add ICE candidate: ${error.message}` 
        }));
      }
    } else {
      console.warn('[WebRTCClient] No ICE candidate found in message');
    }
  }

  private async handleAnswer(message: any) {
    console.log('[WebRTCClient] ===== HANDLING ANSWER =====');
    console.log('[WebRTCClient] Answer message:', message);
    try {
      if (!this.peerConnection) {
        console.error('[WebRTCClient] No peer connection available for answer');
        return;
      }
      
      if (!message.sdp) throw new Error('Missing SDP in answer message');
      
      console.log('[WebRTCClient] Setting remote description with answer');
      const answerDesc = new RTCSessionDescription({ type: 'answer', sdp: message.sdp });
      
      await this.peerConnection.setRemoteDescription(answerDesc);
      console.log('[WebRTCClient] Remote description set successfully with answer');
    } catch (error: any) {
      console.error('[WebRTCClient] Error handling answer:', error);
      webRTCStore.update(state => ({ 
        ...state, 
        error: `Failed to handle answer: ${error.message}`,
        connectionState: 'failed'
      }));
    }
  }

  private async handleOffer(message: any) {
    console.log('[WebRTCClient] ===== HANDLING OFFER =====');
    console.log('[WebRTCClient] Offer message:', message);
    console.log('[WebRTCClient] Offer SDP length:', message.sdp?.length);
    try {
      console.log('[WebRTCClient] Step 1: Updating connection state to connecting');
      // Update connection state to connecting
      webRTCStore.update(state => ({ 
        ...state, 
        connectionState: 'connecting',
        error: null
      }));

      console.log('[WebRTCClient] Step 2: Checking for existing peerConnection');
      // If we have an existing peer connection, close it to ensure clean reconnection
      if (this.peerConnection) {
        console.log('[WebRTCClient] Closing existing PeerConnection for reconnection, current state:', this.peerConnection.signalingState);
        try {
          this.peerConnection.close();
        } catch (err) {
          console.warn('[WebRTCClient] Error closing old peer connection:', err);
        }
        this.peerConnection = null;
      }
      
      console.log('[WebRTCClient] Step 3: Checking for existing dataChannel');
      // Close existing data channel if any
      if (this.dataChannel) {
        console.log('[WebRTCClient] Closing existing data channel for reconnection');
        try {
          this.dataChannel.close();
        } catch (err) {
          console.warn('[WebRTCClient] Error closing old data channel:', err);
        }
        this.dataChannel = null;
      }
      
      console.log('[WebRTCClient] Step 4: Creating new peer connection');
      // Create new peer connection
      if (!this.peerConnection) {
        console.log('[WebRTCClient] Creating new PeerConnection with config:', this.config);
        this.peerConnection = new RTCPeerConnection(this.config);
        
        // Add video transceiver to receive video from device
        this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
        
        this.peerConnection.onicecandidate = (event) => {
          console.log('[WebRTCClient] ICE candidate generated:', event.candidate);
          if (event.candidate) {
            // Send ICE candidate via SSE (fire-and-forget, no response needed)
            sseStore.sendMessageWithoutResponse({
              type: 'device',
              scope: 'user:self',
              payload: {
                action: 'message',
                type: 'webrtc:ice-candidate',
                deviceId: this.deviceId,
                candidate: event.candidate.toJSON()
              }
            }).catch(error => {
              // Silently fail for ICE candidates to avoid console spam
              console.debug('[WebRTCClient] Failed to send ICE candidate via SSE:', error);
            });
          } else {
            console.log('[WebRTCClient] ICE candidate gathering complete');
          }
        };
        
        this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection?.iceConnectionState;
          console.log('[WebRTCClient] ICE connection state changed:', state);
          
          switch (state) {
            case 'connected':
            case 'completed':
              console.log('[WebRTCClient] ICE connection established');
              webRTCStore.update(s => ({ ...s, connectionState: 'connected' }));
              break;
            case 'disconnected':
              console.log('[WebRTCClient] ICE connection disconnected');
              webRTCStore.update(s => ({ ...s, connectionState: 'disconnected' }));
              break;
            case 'failed':
              console.log('[WebRTCClient] ICE connection failed');
              webRTCStore.update(s => ({ ...s, connectionState: 'failed', error: 'ICE connection failed' }));
              break;
            case 'closed':
              console.log('[WebRTCClient] ICE connection closed');
              webRTCStore.update(s => ({ ...s, connectionState: 'closed' }));
              break;
          }
        };
        this.peerConnection.ondatachannel = (event) => {
          console.log('[WebRTCClient] Data channel received:', event.channel.label);
          this.dataChannel = event.channel;
          this.dataChannel.onmessage = (msgEvent) => {
            console.log('[WebRTCClient] Data channel message received:', msgEvent.data);
            if (msgEvent.data instanceof ArrayBuffer) {
              const decoder = new TextDecoder('utf-8');
              const text = decoder.decode(msgEvent.data);
              console.log('[WebRTCClient] Decoded ArrayBuffer message:', text);
              this.handleDataChannelMessage(text);
            } else {
              console.log('[WebRTCClient] Text message received:', msgEvent.data);
              this.handleDataChannelMessage(msgEvent.data);
            }
          };
          this.dataChannel.onopen = () => {
            console.log('[WebRTCClient] Data channel opened');
            this.handleDataChannelOpen();
          };
          this.dataChannel.onclose = () => {
            console.log('[WebRTCClient] Data channel closed');
            webRTCStore.update(state => ({ ...state, dataChannelStatus: 'closed' }));
          };
          webRTCStore.update(state => ({ ...state, dataChannel: this.dataChannel }));
        };
        this.peerConnection.onconnectionstatechange = () => {
          const state = this.peerConnection?.connectionState as RTCPeerConnectionState;
          console.log('[WebRTCClient] Connection state changed:', state);
          
          webRTCStore.update(s => ({ 
            ...s, 
            connectionState: state,
            connectionStatus: state === 'connected' ? 'connected' : state === 'failed' ? 'error' : 'disconnected',
            error: state === 'failed' ? 'Connection failed' : null
          }));
          
          if (this.onConnectionStateCB) this.onConnectionStateCB(state);
          
          // Handle connection state changes
          switch (state) {
            case 'connected':
              console.log('[WebRTCClient] WebRTC connection established');
              break;
            case 'disconnected':
              console.log('[WebRTCClient] WebRTC connection disconnected');
              break;
            case 'failed':
              console.log('[WebRTCClient] WebRTC connection failed');
              webRTCStore.update(s => ({ 
                ...s, 
                error: 'WebRTC connection failed - check network connectivity' 
              }));
              break;
            case 'closed':
              console.log('[WebRTCClient] WebRTC connection closed');
              break;
          }
        };
        this.peerConnection.ontrack = (event) => {
          console.log('[WebRTCClient] Video track received:', event.track.kind, event.track.readyState);
          
          if (event.streams && event.streams.length > 0) {
            const videoStream = event.streams[0];
            console.log('[WebRTCClient] Video stream received, active:', videoStream.active, 'tracks:', videoStream.getTracks().length);
            
            // Update the WebRTC store with the video stream
            webRTCStore.update(state => ({
              ...state,
              videoStream: videoStream
            }));
          } else {
            console.warn('[WebRTCClient] No streams in track event');
          }
          
          if (this.onTrackHandler) this.onTrackHandler(event.track);
        };
      }

      if (!message.sdp) throw new Error('Missing SDP in offer message');
      
      console.log('[WebRTCClient] Step 5: Setting remote description with offer');
      const offerDesc = new RTCSessionDescription({ type: 'offer', sdp: message.sdp });
      
      await this.peerConnection.setRemoteDescription(offerDesc);
      console.log('[WebRTCClient] Step 6: Remote description set successfully, signalingState:', this.peerConnection.signalingState);
      
      console.log('[WebRTCClient] Step 7: Creating answer');
      const answer = await this.peerConnection.createAnswer();
      console.log('[WebRTCClient] Step 8: Answer created, SDP length:', answer.sdp?.length);
      
      console.log('[WebRTCClient] Step 9: Setting local description with answer');
      await this.peerConnection.setLocalDescription(answer);
      console.log('[WebRTCClient] Step 10: Local description set successfully, signalingState:', this.peerConnection.signalingState);
      
      console.log('[WebRTCClient] Step 11: Sending answer message via SSE');
      
      // Send webrtc:answer via SSE (fire-and-forget, no response needed)
      sseStore.sendMessageWithoutResponse({
        type: 'device',
        scope: 'user:self',
        payload: {
          action: 'message',
          type: 'webrtc:answer',
          deviceId: this.deviceId,
          sdp: this.peerConnection.localDescription?.sdp
        }
      }).then(() => {
        console.log('[WebRTCClient] Step 12: Answer sent successfully via SSE!');
      }).catch(error => {
        console.error('[WebRTCClient] Failed to send answer via SSE:', error);
      });
    } catch (error: any) {
      console.error('[WebRTCClient] CRITICAL ERROR in handleOffer:', error);
      console.error('[WebRTCClient] Error stack:', error.stack);
      webRTCStore.update(state => ({ ...state, error: `Exception in handleOffer: ${error.message}` }));
    }
  }
}


