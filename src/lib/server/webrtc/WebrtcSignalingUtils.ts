import type { ExtendedWebSocket } from '../websocket/WebSocketUtils';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { WebSocket } from 'ws';

// Message types
export type WebRTCMessageType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'data-channel-open'
  | 'data-channel-close'
  | 'data-channel-message';

export const WEBRTC_MESSAGE_TYPES: WebRTCMessageType[] = [
  'offer',
  'answer',
  'ice-candidate',
  'data-channel-open',
  'data-channel-close',
  'data-channel-message'
];

export const SIGNALING_MESSAGE_TYPES = ['offer', 'answer', 'ice-candidate'];

export interface WebRTCMessage {
  type: WebRTCMessageType;
  sdp?: string;
  candidate?: RTCIceCandidate;
  data?: any;
  label?: string;
  channelId?: string;
  timestamp?: string;
}

/** 
 * Validate, log, and broadcast a signaling message.
 */
export function handleWebRTCMessage(
  message: any,
  sender: ExtendedWebSocket,
  wsManager: WebSocketManager
): void {
  const senderId = sender.socketId;
  // Handle nested message structure
  const msg = message.type === 'webrtc' ? message.data : message;
  
  if (!msg || !msg.type || !WEBRTC_MESSAGE_TYPES.includes(msg.type)) {
    console.warn(`[WebRTC] Invalid message type from ${senderId}:`, message);
    return;
  }
  
  if (!msg.timestamp) {
    msg.timestamp = new Date().toISOString();
  }
  
  // Log the message type
  console.log(`[WebRTC] Received ${msg.type} from ${senderId}`);
  
  // Additional logging based on message type
  if (msg.type === 'offer') {
    console.log(`[WebRTC:Offer] Received offer from ${senderId}`);
    if (msg.sdp) {
      console.log(`[WebRTC:Offer] SDP length: ${msg.sdp.length} chars`);
    }
  } else if (msg.type === 'answer') {
    console.log(`[WebRTC:Answer] Received answer from ${senderId}`);
  } else if (msg.type === 'ice-candidate' || msg.type === 'candidate') {
    console.log(`[WebRTC:ICE] Received candidate from ${senderId}`);
  }

  // Forward the message to all other clients except the sender
  broadcastMessage(msg, wsManager, sender);
}

/** Log a client leaving a room. */
export function leaveRoom(socketId: string): void {
  console.log(`[WebRTC] Client ${socketId} left all rooms`);
}

/** Broadcast a message to all connected clients except the sender. */
function broadcastMessage(message: any, wsManager: WebSocketManager, sender: ExtendedWebSocket): void {
  const outgoingMessage = {
    type: 'webrtc',
    data: message,
    timestamp: new Date().toISOString()
  };
  console.log(`[WebRTC] Broadcasting message from ${sender.socketId}:`, outgoingMessage);
  
  // Broadcast to everyone except the sender
  const jsonMessage = JSON.stringify(outgoingMessage);
  const clients = wsManager.getClients();
  
  clients.forEach((client) => {
    // Skip the sender
    if (client.socketId === sender.socketId) {
      return;
    }
    
    // Send to all other clients
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonMessage);
    }
  });
}
