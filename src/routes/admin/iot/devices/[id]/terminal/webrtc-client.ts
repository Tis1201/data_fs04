// -----------------------------------------------------------------------------
//  WebRTCClient.ts – Modular WebRTC client for different applications
// -----------------------------------------------------------------------------
//  ▸ Works with socketStore / webRTCStore (SvelteKit + Vite)                   
//  ▸ Supports both terminal and video streaming use cases
//  ▸ Provides callbacks for connection events and data channel readiness
//  ▸ Grace‑period for transient "disconnected" flips (4 s)                    
//  ▸ Automatic ICE‑restart, then full back‑off reconnect if needed            
//  ▸ Lightweight data‑channel keep‑alive (ping / pong every 10 s)             
// -----------------------------------------------------------------------------

import { socketStore } from "$lib/stores/websocket-store";
import { webRTCStore } from "$lib/stores/webrtc-store";
import type {
  WebRTCMessage,
  DataChannelMessage,
} from "$lib/stores/webrtc-store";
import { get } from 'svelte/store';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface RDPOptions {
  frameRate?: number;
  quality?: number;
  captureMode?: 'test' | 'screen';
  resolution?: { width: number; height: number };
}

/* -------------------------------------------------------------------------- */
/*  WebRTC client                                                              */
/* -------------------------------------------------------------------------- */

// Define callback types for better type safety
export type DataChannelCallback = (dataChannel: RTCDataChannel) => void;
export type ConnectionStateCallback = (state: RTCPeerConnectionState) => void;
export type TerminalOutputCallback = (output: string) => void;
export type TrackCallback = (track: MediaStreamTrack) => void;

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private _processedMessages = new Set<string>();

  // Callbacks for different events
  private terminalCB: TerminalOutputCallback | null = null;
  private onDataChannelOpenCB: DataChannelCallback | null = null;
  private onConnectionStateCB: ConnectionStateCallback | null = null;
  onTrackHandler: TrackCallback | null = null;
  
  config: any;

  constructor(private deviceId: string) {
    console.log(`WebRTCClient: ${this.deviceId}`);

    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
  }

  /******************************************************************************
   * 
   *  Connect
   * 
   ******************************************************************************/
  connect() {
    console.log(`Connecting: ${this.deviceId}`);

    // Send WebRTC connect message
    const message = {
      type: 'device',
      payload: {
        action: 'message',
        type: 'webrtc:connect',
        deviceId: this.deviceId
      },
      scope: `subscription:device:${this.deviceId}`
    };
    console.log(`Coming socket store :${JSON.stringify(message)}`);
    socketStore.send(message);

    // No terminal message needed for connect request
  }

  /******************************************************************************
   * 
   *  Callbacks
   * 
   ******************************************************************************/
  setTerminalCallback(cb: TerminalOutputCallback) {
    this.terminalCB = cb;
  }
  
  /**
   * Set callback for when the data channel is open and ready
   * This is useful for applications to know when they can start sending data
   */
  setDataChannelOpenCallback(cb: DataChannelCallback) {
    this.onDataChannelOpenCB = cb;
    
    // If data channel is already open, call the callback immediately
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      cb(this.dataChannel);
    }
  }
  
  /**
   * Set callback for connection state changes
   * This allows applications to react to connection state changes
   */
  setConnectionStateCallback(cb: ConnectionStateCallback) {
    this.onConnectionStateCB = cb;
    
    // If peer connection already exists, call the callback with current state
    if (this.peerConnection) {
      cb(this.peerConnection.connectionState as RTCPeerConnectionState);
    }
  }
  
  /**
   * Handle data channel open event
   * Updates store and calls callback if set
   */
  private handleDataChannelOpen = (event: Event) => {
    console.log('[WebRTC] Data channel opened');
    
    // Update the WebRTC store
    webRTCStore.update(state => ({
      ...state,
      dataChannelStatus: 'open',
      dataChannel: this.dataChannel
    }));
    
    // Start sending ping messages to keep the connection alive
    // this.startPingMessages();
    
    // Call the data channel open callback if set
    if (this.onDataChannelOpenCB && this.dataChannel) {
      this.onDataChannelOpenCB(this.dataChannel);
    }
  };

  private startPingMessages() {
    // Send pings every 10 seconds to keep the connection alive
    setInterval(() => {
      this.sendPing();
    }, 60000);
  }
  
  /**
   * Handle connection state change event
   * Updates store and calls callback if set
   */
  private handleConnectionStateChange = () => {
    if (!this.peerConnection) return;
    
    const state = this.peerConnection.connectionState;
    console.log(`[WebRTC] Connection state changed: ${state}`);
    
    // Update the WebRTC store
    webRTCStore.update(s => ({
      ...s,
      connectionStatus: state === 'connected' ? 'connected' : state === 'failed' ? 'error' : 'disconnected'
    }));
    
    // Call the connection state callback if set
    if (this.onConnectionStateCB) {
      this.onConnectionStateCB(state as RTCPeerConnectionState);
    }
    
    // Handle different connection states
    switch (state) {
      case 'connected':
        console.log('[WebRTC] Connection established');
        break;
        
      case 'disconnected':
        console.log('[WebRTC] Connection disconnected, waiting for reconnection...');
        break;
        
      case 'failed':
        console.error('[WebRTC] Connection failed');
        this.cleanup();
        break;
        
      case 'closed':
        console.log('[WebRTC] Connection closed');
        this.cleanup();
        break;
    }
  };

  /******************************************************************************
   * 
   *  Send Terminal Input
   * 
   ******************************************************************************/
  sendTerminalInput(input: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send terminal input: data channel not open');
      if (this.terminalCB) {
        this.terminalCB("\r\n\x1b[1;31mError: Data channel not open\x1b[0m\r\n");
      }
      return;
    }

    // Handle special keys and escape sequences
    let processedInput = input;
    
    // Log the exact input for debugging
    // console.log(`[WebRTC] Raw terminal input: ${JSON.stringify(input)}`);
    
    // Handle various line ending scenarios
    // This is critical to prevent double line breaks
    if (processedInput === '\r\n') {
      console.log('[WebRTC] Normalizing CR+LF to just CR');
      processedInput = '\r';
    } else if (processedInput === '\n') {
      console.log('[WebRTC] Normalizing LF to CR');
      processedInput = '\r';
    }
    
    // Create the terminal input message
    const message = {
      type: 'terminal:input',
      data: processedInput,
      timestamp: Date.now()
    };

    // Send the message
    try {
      const jsonMessage = JSON.stringify(message);
      this.dataChannel.send(jsonMessage);
      
      // Only log non-control characters to avoid console spam
      // if (processedInput.length === 1 && processedInput.charCodeAt(0) < 32) {
      //   console.log(`[WebRTC] Sent control character: ${processedInput.charCodeAt(0)}`);
      // } else {
      //   console.log(`[WebRTC] Sent terminal input: ${JSON.stringify(processedInput)}`);
      // }
    } catch (error) {
      console.error('[WebRTC] Error sending terminal input:', error);
      if (this.terminalCB) {
        this.terminalCB(`\r\n\x1b[1;31mError sending command: ${error.message}\x1b[0m\r\n`);
      }
    }
  }

  /******************************************************************************
   * 
   *  Send Terminal Resize
   * 
   ******************************************************************************/
  sendTerminalResize(rows: number, cols: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send terminal resize: data channel not open');
      return;
    }

    // Create the terminal resize message
    const message = {
      type: 'terminal:resize',
      rows: rows,
      cols: cols,
      timestamp: Date.now()
    };

    // Send the message
    try {
      this.dataChannel.send(JSON.stringify(message));
      // console.log('[WebRTC] Sent terminal resize:', rows, cols);
    } catch (error) {
      console.error('[WebRTC] Error sending terminal resize:', error);
    }
  }

  /******************************************************************************
   * 
   *  Send Ping
   * 
   ******************************************************************************/
  sendPing() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send ping: data channel not open');
      return;
    }

    // Create the ping message
    const message = {
      type: 'ping',
      timestamp: Date.now()
    };

    // Send the message
    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log('[WebRTC] Sent ping');
    } catch (error) {
      console.error('[WebRTC] Error sending ping:', error);
    }
  }

  /******************************************************************************
   * 
   *  Input Methods
   * 
   ******************************************************************************/

  /**
   * Send mouse movement to the device
   */
  sendMouseMove(x: number, y: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send mouse move: data channel not open');
      return;
    }

    const message = {
      type: 'mouse:move',
      x: x,
      y: y,
      timestamp: Date.now()
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log(`[WebRTC] Sent mouse move: (${x}, ${y})`);
    } catch (error: unknown) {
      console.error('[WebRTC] Error sending mouse move:', error);
    }
  }

  /**
   * Send mouse click to the device
   */
  sendMouseClick(button: string, x: number, y: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send mouse click: data channel not open');
      return;
    }

    const message = {
      type: 'mouse:click',
      button: button, // 'left', 'right', 'middle'
      x: x,
      y: y,
      timestamp: Date.now()
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log(`[WebRTC] Sent mouse click: ${button} at (${x}, ${y})`);
    } catch (error: unknown) {
      console.error('[WebRTC] Error sending mouse click:', error);
    }
  }

  /**
   * Send mouse scroll to the device
   */
  sendMouseScroll(direction: string, amount: number) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send mouse scroll: data channel not open');
      return;
    }

    const message = {
      type: 'mouse:scroll',
      direction: direction, // 'up', 'down', 'left', 'right'
      amount: amount,
      timestamp: Date.now()
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log(`[WebRTC] Sent mouse scroll: ${direction} by ${amount}`);
    } catch (error: unknown) {
      console.error('[WebRTC] Error sending mouse scroll:', error);
    }
  }

  /**
   * Send key press to the device
   */
  sendKeyPress(key: string, modifiers: string[] = []) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send key press: data channel not open');
      return;
    }

    const message = {
      type: 'key:press',
      key: key,
      modifiers: modifiers, // ['ctrl', 'shift', 'alt', 'meta']
      timestamp: Date.now()
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log(`[WebRTC] Sent key press: ${key} with modifiers: ${modifiers.join(', ')}`);
    } catch (error) {
      console.error('[WebRTC] Error sending key press:', error);
    }
  }

  /**
   * Send text input to the device
   */
  sendTextInput(text: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send text input: data channel not open');
      return;
    }

    const message = {
      type: 'text:input',
      text: text,
      timestamp: Date.now()
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log(`[WebRTC] Sent text input: ${text}`);
    } catch (error) {
      console.error('[WebRTC] Error sending text input:', error);
    }
  }

  /**
   * Send RDP start request to the device
   */
  sendRDPStart(options: RDPOptions = {}) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send RDP start: data channel not open');
      return;
    }

    const message = {
      type: 'rdp:start',
      options: {
        frameRate: options.frameRate || 15,
        quality: options.quality || 80,
        captureMode: options.captureMode || 'screen',
        ...options
      },
      timestamp: Date.now()
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log('[WebRTC] Sent RDP start request:', options);
    } catch (error) {
      console.error('[WebRTC] Error sending RDP start:', error);
    }
  }

  /**
   * Send RDP stop request to the device
   */
  sendRDPStop() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('[WebRTC] Cannot send RDP stop: data channel not open');
      return;
    }

    const message = {
      type: 'rdp:stop',
      timestamp: Date.now()
    };

    try {
      this.dataChannel.send(JSON.stringify(message));
      console.log('[WebRTC] Sent RDP stop request');
    } catch (error) {
      console.error('[WebRTC] Error sending RDP stop:', error);
    }
  }

  /******************************************************************************
   * 
   *  Cleanup
   * 
   ******************************************************************************/
  cleanup() {
    // Close the data channel if it exists
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close the peer connection if it exists
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Update the WebRTC store
    webRTCStore.update(state => ({
      ...state,
      dataChannelStatus: 'closed',
      dataChannel: null
    }));

    console.log('[WebRTC] Cleaned up resources');
  }

  /******************************************************************************
   * 
   *  Handle Message
   * 
   ******************************************************************************/
  handleWebRTCMessage(message: WebRTCMessage) {
    console.log('Received message:', message);

    const msg_type = message.type;

    switch (msg_type) {
      case 'webrtc:offer':
        console.log('Received offer:', message);
        this.handleOffer(message);
        break;
      case 'webrtc:answer':
        console.log('Received answer:', message);
        // this.handleAnswer(message);
        break;
      case 'webrtc:ice-candidate':
        console.log('Received ice candidate:', message);
        this.handleIceCandidate(message);
        break;
      default:
        console.log('Unknown message type:', msg_type);
    }
  }

  /******************************************************************************
   * 
   *  Handle Data Channel Message
   * 
   ******************************************************************************/
  private handleDataChannelMessage(data: string) {
    // Skip empty data
    if (!data || data.length === 0) {
      console.warn('[WebRTC] Received empty data');
      return;
    }

    try {
      // Parse the message as JSON
      const message = JSON.parse(data);
      
      // Only log non-terminal output messages to avoid console spam
      // if (message.type !== 'terminal:output') {
      //   console.log('[WebRTC] Parsed data channel message:', message);
      // } else {
      //   // Log terminal output size for debugging
      //   console.log(`[WebRTC] Received terminal output: ${message.data ? message.data.length : 0} bytes`);
      // }

      // Handle different message types
      switch (message.type) {
        case 'pong':
          // Calculate latency if needed
          if (message.replyTo) {
            const latency = Date.now() - message.replyTo;
            console.log(`[WebRTC] Ping latency: ${latency}ms`);
          }
          break;

        case 'terminal:output':
          // Send the terminal output to the terminal callback
          if (this.terminalCB && message.data) {
            // Debug log a sample of the output
            const sample = message.data.length > 20 ? 
              message.data.substring(0, 20) + '...' : 
              message.data;
            // console.log(`[WebRTC] Terminal output sample: ${JSON.stringify(sample)}`);
            
            // Send the data to the terminal
            this.terminalCB(message.data);
          } else if (!message.data) {
            console.warn('[WebRTC] Received empty terminal output');
          }
          break;

        case 'terminal:error':
          console.log('[WebRTC] Received terminal error:', message);
          // Send the terminal error to the terminal callback
          if (this.terminalCB && message.data) {
            this.terminalCB(`\r\n\x1b[1;31mError: ${message.data}\x1b[0m\r\n`);
          }
          break;

        default:
          console.log('[WebRTC] Unknown data channel message type:', message.type);
      }
    } catch (error) {
      console.error('[WebRTC] Error parsing data channel message:', error);
      // If it's not JSON, treat it as raw terminal output
      if (this.terminalCB) {
        console.log('[WebRTC] Treating message as raw terminal output:', data.length, 'bytes');
        // Log a sample of the data for debugging
        const sample = data.length > 20 ? data.substring(0, 20) + '...' : data;
        console.log(`[WebRTC] Raw output sample: ${JSON.stringify(sample)}`);
        this.terminalCB(data);
      }
    }
  }

  /******************************************************************************
   * 
   *  Handle Offer
   * 
   ******************************************************************************/
  
  private async handleIceCandidate(message: any) {
    const cand = message.payload.candidate;
    // when Python sends `null` you must pass null
    await this.peerConnection?.addIceCandidate(cand);  
    console.log('[WebRTC] Applied remote ICE candidate', cand);
  }
  /******************************************************************************
   * 
   *  Handle Offer
   * 
   ******************************************************************************/
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
            const iceMessage = {
              type: 'device',
              payload: {
                action: 'message',
                type: 'webrtc:ice-candidate',
                deviceId: this.deviceId,
                candidate: event.candidate ? event.candidate.toJSON() : null
              },
              scope: "subscription:device:" + this.deviceId
            };
            socketStore.send(iceMessage);
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
            
            // Check if the message is binary (ArrayBuffer)
            if (msgEvent.data instanceof ArrayBuffer) {
              // Convert ArrayBuffer to string
              const decoder = new TextDecoder('utf-8');
              const text = decoder.decode(msgEvent.data);
              console.log('[WebRTC] Converted binary data to text:', text.length, 'bytes');
              this.handleDataChannelMessage(text);
            } else {
              // Handle as normal text
              this.handleDataChannelMessage(msgEvent.data);
            }
          };

          this.dataChannel.onopen = this.handleDataChannelOpen;
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
        this.peerConnection.onconnectionstatechange = this.handleConnectionStateChange;

        // Add track event handler
        this.peerConnection.ontrack = (event) => {
          console.log('[WebRTC] Track received:', event.track.kind);
          
          // If we have a track handler, call it
          if (this.onTrackHandler) {
            this.onTrackHandler(event.track);
          }
        };

       
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
          return this.peerConnection?.createAnswer();
        })
        .then(answer => {
          console.log('[WebRTC] Setting local description for answer');
          return this.peerConnection?.setLocalDescription(answer);
        })
        .then(() => {
          console.log('[WebRTC] Sending answer to remote peer');
          const answerMessage = {
            type: 'device',
            payload: {
              action: 'message',
              type: 'webrtc:answer',
              deviceId: this.deviceId,
              sdp: this.peerConnection?.localDescription?.sdp
            },
            scope: "subscription:device:" + this.deviceId
          };
          socketStore.send(answerMessage);
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
}
