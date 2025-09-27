// Centralized WebRTCClient used by both admin and user routes
// Moved from route-specific implementations to avoid duplication.

import { socketStore } from "$lib/stores/websocket-store";
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
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
  }

  connect() {
    const message = {
      type: 'device',
      payload: { action: 'message', type: 'webrtc:connect', deviceId: this.deviceId },
      scope: `subscription:device:${this.deviceId}`
    };
    socketStore.send(message);
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
    if (this.dataChannel) { this.dataChannel.close(); this.dataChannel = null; }
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
    webRTCStore.update(state => ({ ...state, dataChannelStatus: 'closed', dataChannel: null }));
  }

  async handleWebRTCMessage(message: WebRTCMessage) {
    console.log('[WebRTCClient] ===== HANDLING WEBRTC MESSAGE =====');
    console.log('[WebRTCClient] Received message:', message);
    const msg_type = message.type;
    console.log('[WebRTCClient] Message type:', msg_type);
    switch (msg_type) {
      case 'webrtc:offer':
        console.log('[WebRTCClient] Processing webrtc:offer');
        this.handleOffer(message);
        break;
      case 'webrtc:answer':
        console.log('[WebRTCClient] Processing webrtc:answer');
        break;
      case 'webrtc:ice-candidate':
        console.log('[WebRTCClient] Processing webrtc:ice-candidate');
        await this.handleIceCandidate(message);
        break;
      default:
        console.log('[WebRTCClient] Unknown message type:', msg_type);
        break;
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
    const cand = message.candidate || message.payload?.candidate;
    console.log('[WebRTCClient] ICE candidate:', cand);
    
    if (cand) {
      await this.peerConnection?.addIceCandidate(cand);
      console.log('[WebRTCClient] ICE candidate added successfully');
    } else {
      console.warn('[WebRTCClient] No ICE candidate found in message');
    }
  }

  private handleOffer(message: any) {
    console.log('[WebRTCClient] ===== HANDLING OFFER =====');
    console.log('[WebRTCClient] Offer message:', message);
    try {
      if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        console.log('[WebRTCClient] PeerConnection not stable, current state:', this.peerConnection.signalingState);
        return;
      }
      if (!this.peerConnection) {
        console.log('[WebRTCClient] Creating new PeerConnection');
        this.peerConnection = new RTCPeerConnection({ iceServers: this.config.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] });
        
        // Add video transceiver to receive video from device
        this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
        
        this.peerConnection.onicecandidate = (event) => {
          const iceMessage = {
            type: 'device',
            payload: { action: 'message', type: 'webrtc:ice-candidate', deviceId: this.deviceId, candidate: event.candidate ? event.candidate.toJSON() : null },
            scope: "subscription:device:" + this.deviceId
          };
          socketStore.send(iceMessage);
        };
        this.peerConnection.oniceconnectionstatechange = () => {};
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
          webRTCStore.update(s => ({ ...s, connectionStatus: state === 'connected' ? 'connected' : state === 'failed' ? 'error' : 'disconnected' }));
          if (this.onConnectionStateCB) this.onConnectionStateCB(state);
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
      const offerDesc = new RTCSessionDescription({ type: 'offer', sdp: message.sdp });
      this.peerConnection.setRemoteDescription(offerDesc)
        .then(() => this.peerConnection?.createAnswer())
        .then(answer => this.peerConnection?.setLocalDescription(answer))
        .then(() => {
          const answerMessage = {
            type: 'device',
            payload: { action: 'message', type: 'webrtc:answer', deviceId: this.deviceId, sdp: this.peerConnection?.localDescription?.sdp },
            scope: "subscription:device:" + this.deviceId
          };
          socketStore.send(answerMessage);
        })
        .catch((error) => {
          webRTCStore.update(state => ({ ...state, error: `Error handling offer: ${error.message}` }));
        });
    } catch (error: any) {
      webRTCStore.update(state => ({ ...state, error: `Exception in handleOffer: ${error.message}` }));
    }
  }
}


