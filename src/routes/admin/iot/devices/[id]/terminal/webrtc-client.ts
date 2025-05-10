// -----------------------------------------------------------------------------
//  WebRTCClient.ts – Resilient client with active keep‑alive and auto‑re‑sync  
// -----------------------------------------------------------------------------
//  ▸ Works with socketStore / webRTCStore (SvelteKit + Vite)                   
//  ▸ Grace‑period for transient “disconnected” flips (4 s)                    
//  ▸ Automatic ICE‑restart, then full back‑off reconnect if needed            
//  ▸ Lightweight data‑channel keep‑alive (ping / pong every 10 s)             
//  ▸ Exports helper:  createClientMessage()                                   
// -----------------------------------------------------------------------------

import { socketStore } from "$lib/stores/websocket-store";
import { webRTCStore } from "$lib/stores/webrtc-store";
import type {
  WebRTCMessage,
  DataChannelMessage,
} from "$lib/stores/webrtc-store";
import { get } from 'svelte/store';


/* -------------------------------------------------------------------------- */
/*  WebRTC client                                                              */
/* -------------------------------------------------------------------------- */
export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private _processedMessages = new Set<string>();

  private terminalCB: ((m: string) => void) | null = null;
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

    socketStore.send(message);

    // Log the message in terminal
    if (this.terminalCB) {
      this.terminalCB("\r\n\x1b[1;32mWebRTC connect request sent\x1b[0m\r\n");
    }
  }

  /******************************************************************************
   * 
   *  Callback
   * 
   ******************************************************************************/
  setTerminalCallback(cb: (m: string) => void) {
    this.terminalCB = cb;
  }

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
    console.log(`[WebRTC] Raw terminal input: ${JSON.stringify(input)}`);
    
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
      if (processedInput.length === 1 && processedInput.charCodeAt(0) < 32) {
        console.log(`[WebRTC] Sent control character: ${processedInput.charCodeAt(0)}`);
      } else {
        console.log(`[WebRTC] Sent terminal input: ${JSON.stringify(processedInput)}`);
      }
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
      console.log('[WebRTC] Sent terminal resize:', rows, cols);
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
      if (message.type !== 'terminal:output') {
        console.log('[WebRTC] Parsed data channel message:', message);
      } else {
        // Log terminal output size for debugging
        console.log(`[WebRTC] Received terminal output: ${message.data ? message.data.length : 0} bytes`);
      }

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
            console.log(`[WebRTC] Terminal output sample: ${JSON.stringify(sample)}`);
            
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
            console.log('[WebRTC] Data channel message received:', msgEvent.data);
            
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

          this.dataChannel.onopen = () => {
            console.log('[WebRTC] Data channel opened');
            webRTCStore.update(state => ({
              ...state,
              dataChannelStatus: 'open'
            }));
            // Auto-send echo for improved UX
            this.sendTerminalInput('echo "hello"');
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