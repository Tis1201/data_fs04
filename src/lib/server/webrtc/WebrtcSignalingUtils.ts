import type { ExtendedWebSocket, ExtendedWebSocketServer } from '../websocket/WebSocketUtils';

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
  wss: ExtendedWebSocketServer
): void {
  const senderId = sender.socketId;
  if (!message || !message.type || !WEBRTC_MESSAGE_TYPES.includes(message.type)) {
    console.warn(`[WebRTC] Invalid message type from ${senderId}:`, message);
    return;
  }
  if (!message.timestamp) {
    message.timestamp = new Date().toISOString();
  }
  if (SIGNALING_MESSAGE_TYPES.includes(message.type)) {
    console.log(`[WebRTC:Signaling] ${message.type} from ${senderId}`);
    if (message.type === 'offer') {
      console.log(`[WebRTC:Offer] SDP includes data channel: ${message.sdp?.includes('webrtc-datachannel') ? 'Yes' : 'No'}`);
    }
  } else {
    console.log(`[WebRTC:DataChannel] ${message.type} from ${senderId}`, message.label ? `channel: ${message.label}` : '');
  }
  broadcastMessage(message, wss);
}

/** Log a client leaving a room. */
export function leaveRoom(socketId: string): void {
  console.log(`[WebRTC] Client ${socketId} left all rooms`);
}

/** Broadcast a message to all connected clients. */
function broadcastMessage(message: any, wss: ExtendedWebSocketServer): void {
  const outgoingMessage = {
    type: 'webrtc',
    data: message,
    timestamp: new Date().toISOString()
  };
  const messageString = JSON.stringify(outgoingMessage);
  const activeClients = Array.from(wss.clients).filter(client => client.readyState === 1);
  activeClients.forEach(client => {
    const clientId = (client as ExtendedWebSocket).socketId;
    console.log(`[WebRTC] Broadcasting ${message.type} to client ${clientId}`);
    client.send(messageString);
  });
  console.log(`[WebRTC] Broadcast complete: ${message.type} sent to ${activeClients.length} clients`);
}
