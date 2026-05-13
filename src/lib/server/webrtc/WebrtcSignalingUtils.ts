import type { ExtendedWebSocket } from '../websocket/WebSocketUtils';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { WebSocket } from 'ws';
import { findRoom } from '../room/RoomManager';
import { logger } from '../logger';

/**
 * Broadcast a message to all participants in a room except the sender.
 * @param wsManager WebSocketManager instance
 * @param roomId Room ID
 * @param senderId Sender's socket/user ID
 * @param msg Message to send
 */
export function broadcastToRoomExceptSender(
  wsManager: WebSocketManager,
  roomId: string,
  senderId: string,
  msg: any
) {
  const room = findRoom(roomId);
  logger.debug(`[WebRTC] Broadcasting to room ${roomId} except sender ${senderId}`);
  if (!room) return;

  const outgoingMessage = {
    type: 'webrtc',
    data: msg,
    timestamp: new Date().toISOString()
  };
  const jsonMessage = JSON.stringify(outgoingMessage);

  // Gather all sockets for all participants except sender
  const participants = room.getParticipants();
  const allSockets: ExtendedWebSocket[] = [];
  for (const participant of participants) {
    if (participant.socketId && participant.socketId !== senderId) {
      const sockets = wsManager.getClientsByUserId(participant.userId);
      allSockets.push(...sockets.filter(ws => ws.socketId !== senderId));
    }
  }

  allSockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonMessage);
      logger.debug(`[WebRTC] Broadcasted to ${client.socketId}`);
    }
  });
}

/**
 * Send a message to a single participant in a room.
 * @param wsManager WebSocketManager instance
 * @param socketId Target participant's socket ID
 * @param msg Message to send
 */
export function sendToParticipant(
  wsManager: WebSocketManager,
  socketId: string,
  msg: any
) {
  const ws = wsManager.getClientBySocketId(socketId);
  if (ws) {
    ws.send(JSON.stringify(msg));
  }
}


// Message types
export type WebRTCMessageType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'data-channel-open'
  | 'data-channel-close'
  | 'data-channel-message'
  | 'webrtc:offer'
  | 'webrtc:answer'
  | 'webrtc:ice-candidate'
  | 'webrtc:connect';

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

  const roomId = msg.roomId;

  // Secure: Only allow participants to send/receive messages for this room
  if (roomId) {
    const room = findRoom(roomId);
    if (!room) {
      console.warn(`[WebRTC] Room ${roomId} not found for signaling message from ${senderId}`);
      return;
    }
    // Check by userId and socketId for best practice
    const isParticipant = (sender.userId && room.hasParticipant(sender.userId)) || room.hasParticipant(sender.socketId);
    if (!isParticipant) {
      console.warn(`[WebRTC] Sender ${senderId} (userId: ${sender.userId}) is not a participant of room ${roomId}. Message rejected.`);
      return;
    }
  }

  // Log the message type
  console.log(`[WebRTC] Received ${msg.type} from ${senderId} for room ${roomId}`);
  
  // Additional logging based on message type
  if (msg.type === 'offer') {
    
    console.log(`[WebRTC:Offer] Received offer from ${senderId} for room ${roomId}`);

    if (msg.sdp) {
      console.log(`[WebRTC:Offer] SDP length: ${msg.sdp.length} chars`);
    }

  } else if (msg.type === 'answer') {
    console.log(`[WebRTC:Answer] Received answer from ${senderId}`);
  } else if (msg.type === 'ice-candidate' || msg.type === 'candidate') {
    console.log(`[WebRTC:ICE] Received candidate from ${senderId}`);
  }

  if(roomId) {
    broadcastToRoomExceptSender(wsManager, roomId, senderId, msg);
  }

  
  // fallback: broadcast to all if no roomId or room not found
  // broadcastMessage(msg, wsManager, sender);
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
  // console.log(`[WebRTC] Broadcasting message from ${sender.socketId}:`, outgoingMessage);
  
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
