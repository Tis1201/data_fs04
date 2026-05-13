/**
 * WebRTC Manager
 * 
 * Dedicated WebRTC handling that replaces the messy mixed approach.
 * Provides clean separation of concerns for WebRTC functionality.
 */

import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';
import type { 
  WebRTCMessage, 
  WebRTCAction, 
  WebRTCData
} from '../types/unified';
import { MessageFactory } from '../types/unified';
import { getLoggingManager } from './LoggingManager';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
  iceTransportPolicy?: RTCIceTransportPolicy;
}

export interface WebRTCState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  dataChannelStatus: 'closed' | 'connecting' | 'open' | 'closing';
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  latestMessage: WebRTCMessage | null;
  error: string | null;
  stats: RTCStatsReport | null;
}

export interface WebRTCEventHandlers {
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onDataChannelStateChange?: (state: RTCDataChannelState) => void;
  onVideoTrack?: (track: MediaStreamTrack) => void;
  onAudioTrack?: (track: MediaStreamTrack) => void;
  onMessage?: (message: WebRTCMessage) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// WEBRTC MANAGER CLASS
// ============================================================================

class WebRTCManagerClass {
  private config: WebRTCConfig;
  private state: Writable<WebRTCState>;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private eventHandlers: WebRTCEventHandlers = {};
  private logger = getLoggingManager();
  private isDestroyed = false;

  constructor(config: WebRTCConfig) {
    const defaultIceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    
    this.config = {
      iceCandidatePoolSize: 10,
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
      ...config,
      iceServers: config.iceServers && config.iceServers.length > 0 ? config.iceServers : defaultIceServers
    };

    this.state = writable({
      connectionStatus: 'disconnected',
      peerConnection: null,
      dataChannel: null,
      dataChannelStatus: 'closed',
      videoStream: null,
      audioStream: null,
      latestMessage: null,
      error: null,
      stats: null
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Subscribe to state changes
   */
  get subscribe() {
    return this.state.subscribe;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: WebRTCEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Connect to a device
   */
  async connect(deviceId: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('WebRTCManager has been destroyed');
    }

    if (!browser) {
      throw new Error('WebRTC not available in SSR');
    }

    this.logger?.logWebRTC('connect', deviceId, 'Initiating WebRTC connection');
    this.updateState({ connectionStatus: 'connecting', error: null });

    try {
      // Create peer connection
      await this.createPeerConnection();

      // Create data channel
      await this.createDataChannel();

      // Send connect message
      await this.sendMessage(MessageFactory.createWebRTC('connect', deviceId, {
        connectionState: 'connecting'
      }));

      this.logger?.logWebRTC('connect', deviceId, 'WebRTC connection initiated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error('webrtc', 'WebRTC connection failed', { error: errorMessage, deviceId });
      this.updateState({ 
        connectionStatus: 'failed', 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    this.logger?.logWebRTC('disconnect', 'unknown', 'Disconnecting WebRTC');

    try {
      // Close data channel
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      this.updateState({
        connectionStatus: 'disconnected',
        peerConnection: null,
        dataChannel: null,
        dataChannelStatus: 'closed',
        videoStream: null,
        audioStream: null,
        error: null
      });

      this.logger?.logWebRTC('disconnect', 'unknown', 'WebRTC disconnected successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'WebRTC disconnect error', { error });
    }
  }

  /**
   * Handle incoming WebRTC message
   */
  async handleMessage(message: WebRTCMessage): Promise<void> {
    this.logger?.logWebRTC('message', message.deviceId, `Handling ${message.action}`, message.data);
    
    this.updateState({ latestMessage: message });

    try {
      switch (message.action) {
        case 'offer':
          await this.handleOffer(message);
          break;
        case 'answer':
          await this.handleAnswer(message);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message);
          break;
        case 'error':
          await this.handleError(message);
          break;
        default:
          this.logger?.warn('webrtc', `Unknown WebRTC action: ${message.action}`);
      }

      // Call message handler
      if (this.eventHandlers.onMessage) {
        this.eventHandlers.onMessage(message);
      }
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle WebRTC message', { error, message });
      throw error;
    }
  }

  /**
   * Send a WebRTC message
   */
  async sendMessage(message: WebRTCMessage): Promise<void> {
    this.logger?.logWebRTC('send', message.deviceId, `Sending ${message.action}`, message.data);
    
    // This would typically send through the CommunicationManager
    // For now, we'll just log it
    console.log('[WebRTCManager] Sending message:', message);
  }

  /**
   * Send terminal input via data channel
   */
  async sendTerminalInput(input: string): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not available');
    }

    const message = JSON.stringify({
      type: 'terminal:input',
      data: { input }
    });

    this.dataChannel.send(message);
    this.logger?.logWebRTC('terminal-input', 'unknown', 'Sent terminal input', { input });
  }

  /**
   * Send RDP start command
   */
  async sendRDPStart(options: any): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not available');
    }

    const message = JSON.stringify({
      type: 'rdp:start',
      data: { options }
    });

    this.dataChannel.send(message);
    this.logger?.logWebRTC('rdp-start', 'unknown', 'Sent RDP start', { options });
  }

  /**
   * Send mouse event
   */
  async sendMouseEvent(event: any): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not available');
    }

    const message = JSON.stringify({
      type: 'rdp:mouse',
      data: { event }
    });

    this.dataChannel.send(message);
    this.logger?.logWebRTC('mouse-event', 'unknown', 'Sent mouse event', { event });
  }

  /**
   * Send keyboard event
   */
  async sendKeyboardEvent(event: any): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not available');
    }

    const message = JSON.stringify({
      type: 'rdp:keyboard',
      data: { event }
    });

    this.dataChannel.send(message);
    this.logger?.logWebRTC('keyboard-event', 'unknown', 'Sent keyboard event', { event });
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) {
      return null;
    }

    try {
      const stats = await this.peerConnection.getStats();
      this.updateState({ stats });
      return stats;
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to get stats', { error });
      return null;
    }
  }

  /**
   * Get current state
   */
  getCurrentState(): WebRTCState {
    let state: WebRTCState;
    this.state.subscribe(s => state = s)();
    return state!;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.getCurrentState().connectionStatus === 'connected';
  }

  /**
   * Destroy the manager
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;
    await this.disconnect();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updateState(updates: Partial<WebRTCState>): void {
    this.state.update(current => ({ ...current, ...updates }));
  }

  private async createPeerConnection(): Promise<void> {
    if (!browser) {
      throw new Error('WebRTC not available in SSR');
    }

    this.peerConnection = new RTCPeerConnection(this.config);

    // Set up event handlers
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.logger?.logWebRTC('connection-state-change', 'unknown', `Connection state: ${state}`);
      
      this.updateState({ 
        connectionStatus: state === 'connected' ? 'connected' : 
                        state === 'connecting' ? 'connecting' : 
                        state === 'failed' ? 'failed' : 'disconnected'
      });

      if (this.eventHandlers.onConnectionStateChange) {
        this.eventHandlers.onConnectionStateChange(state!);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.logger?.logWebRTC('ice-candidate', 'unknown', 'ICE candidate generated');
        // Send ICE candidate
        this.sendMessage(MessageFactory.createWebRTC('ice-candidate', 'unknown', {
          candidate: event.candidate.toJSON()
        }));
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.logger?.logWebRTC('track', 'unknown', 'Media track received', { 
        kind: event.track.kind,
        id: event.track.id 
      });

      if (event.track.kind === 'video') {
        this.updateState({ videoStream: event.streams[0] });
        if (this.eventHandlers.onVideoTrack) {
          this.eventHandlers.onVideoTrack(event.track);
        }
      } else if (event.track.kind === 'audio') {
        this.updateState({ audioStream: event.streams[0] });
        if (this.eventHandlers.onAudioTrack) {
          this.eventHandlers.onAudioTrack(event.track);
        }
      }
    };

    this.updateState({ peerConnection: this.peerConnection });
  }

  private async createDataChannel(): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not available');
    }

    this.dataChannel = this.peerConnection.createDataChannel('messages', {
      ordered: true
    });

    this.dataChannel.onopen = () => {
      this.logger?.logWebRTC('data-channel-open', 'unknown', 'Data channel opened');
      this.updateState({ dataChannelStatus: 'open' });
      
      if (this.eventHandlers.onDataChannelStateChange) {
        this.eventHandlers.onDataChannelStateChange('open');
      }
    };

    this.dataChannel.onclose = () => {
      this.logger?.logWebRTC('data-channel-close', 'unknown', 'Data channel closed');
      this.updateState({ dataChannelStatus: 'closed' });
      
      if (this.eventHandlers.onDataChannelStateChange) {
        this.eventHandlers.onDataChannelStateChange('closed');
      }
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.logger?.logWebRTC('data-channel-message', 'unknown', 'Data channel message received', data);
        
        // Handle different message types
        if (data.type === 'terminal:output') {
          // Handle terminal output
        } else if (data.type === 'rdp:video') {
          // Handle RDP video data
        }
      } catch (error) {
        this.logger?.error('webrtc', 'Failed to parse data channel message', { error, data: event.data });
      }
    };

    this.dataChannel.onerror = (error) => {
      this.logger?.error('webrtc', 'Data channel error', { error });
      this.updateState({ error: 'Data channel error' });
    };

    this.updateState({ 
      dataChannel: this.dataChannel,
      dataChannelStatus: 'connecting'
    });
  }

  private async handleOffer(message: WebRTCMessage): Promise<void> {
    if (!this.peerConnection || !message.data.sdp) {
      throw new Error('Invalid offer message');
    }

    this.logger?.logWebRTC('handle-offer', message.deviceId, 'Handling WebRTC offer');

    try {
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: message.data.sdp
      });

      await this.peerConnection.setRemoteDescription(offer);

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer
      await this.sendMessage(MessageFactory.createWebRTC('answer', message.deviceId, {
        sdp: answer.sdp
      }));

      this.logger?.logWebRTC('handle-offer', message.deviceId, 'WebRTC offer handled successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle offer', { error, deviceId: message.deviceId });
      throw error;
    }
  }

  private async handleAnswer(message: WebRTCMessage): Promise<void> {
    if (!this.peerConnection || !message.data.sdp) {
      throw new Error('Invalid answer message');
    }

    this.logger?.logWebRTC('handle-answer', message.deviceId, 'Handling WebRTC answer');

    try {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: message.data.sdp
      });

      await this.peerConnection.setRemoteDescription(answer);
      this.logger?.logWebRTC('handle-answer', message.deviceId, 'WebRTC answer handled successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle answer', { error, deviceId: message.deviceId });
      throw error;
    }
  }

  private async handleIceCandidate(message: WebRTCMessage): Promise<void> {
    if (!this.peerConnection || !message.data.candidate) {
      throw new Error('Invalid ICE candidate message');
    }

    this.logger?.logWebRTC('handle-ice-candidate', message.deviceId, 'Handling ICE candidate');

    try {
      await this.peerConnection.addIceCandidate(message.data.candidate);
      this.logger?.logWebRTC('handle-ice-candidate', message.deviceId, 'ICE candidate handled successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle ICE candidate', { error, deviceId: message.deviceId });
      throw error;
    }
  }

  private async handleError(message: WebRTCMessage): Promise<void> {
    this.logger?.error('webrtc', 'WebRTC error received', { 
      error: message.data.error,
      deviceId: message.deviceId 
    });

    this.updateState({ 
      connectionStatus: 'failed',
      error: message.data.error || 'Unknown WebRTC error'
    });

    if (this.eventHandlers.onError) {
      this.eventHandlers.onError(new Error(message.data.error || 'Unknown WebRTC error'));
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let webRTCManagerInstance: WebRTCManagerClass | null = null;

export function createWebRTCManager(config: WebRTCConfig): WebRTCManagerClass {
  if (webRTCManagerInstance) {
    return webRTCManagerInstance;
  }
  
  webRTCManagerInstance = new WebRTCManagerClass(config);
  return webRTCManagerInstance;
}

export function getWebRTCManager(): WebRTCManagerClass | null {
  return webRTCManagerInstance;
}

export function destroyWebRTCManager(): void {
  if (webRTCManagerInstance) {
    webRTCManagerInstance.destroy();
    webRTCManagerInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function connectWebRTC(deviceId: string, config?: WebRTCConfig): Promise<WebRTCManagerClass> {
  const manager = createWebRTCManager(config || { iceServers: [] });
  await manager.connect(deviceId);
  return manager;
}

export function getWebRTCState(): WebRTCState | null {
  const manager = getWebRTCManager();
  return manager ? manager.getCurrentState() : null;
}

export function isWebRTCConnected(): boolean {
  const manager = getWebRTCManager();
  return manager ? manager.isConnected() : false;
}
