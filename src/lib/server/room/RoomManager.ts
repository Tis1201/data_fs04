import { Room, RoomConfig, RoomResult, RoomParticipant, RoomError } from './Room';
// import { eventRouter, EventType } from '../event/EventRouter';
import { v4 as uuidv4 } from 'uuid';


// Module-scoped state
const rooms = new Map<string, Room>();

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function createRoom(roomId?: string, secret: string, config: RoomConfig = {}, createdBy?: string, socketId?: string): Room {
  // Always generate a password if not provided
  if (!config.password) {
    config.password = uuidv4();
  }
  const actualRoomId = roomId || uuidv4();
  let room = rooms.get(actualRoomId);
  if (!room) {
    room = new Room(actualRoomId, secret, config, createdBy);
    rooms.set(actualRoomId, room);
    // Add creator as first participant and admin if createdBy is present
    if (createdBy) {
      room.addParticipant(createdBy, socketId, true);

    }
  }
  return room;
}

export function removeRoom(roomId: string): boolean {
  const room = rooms.get(roomId);
  if (room) {
    room.cleanup();
    rooms.delete(roomId);
    return true;
  }
  return false;
}

export function joinRoom(roomId: string, secret: string, socketId: string, isAdmin = false, config: RoomConfig = {}, metadata?: Record<string, any>): RoomResult<RoomParticipant> {
  let room = rooms.get(roomId);
  if (!room) {
    room = createRoom(roomId, secret, config); // joinRoom does not set createdBy
  }
  return room.addParticipant(socketId, isAdmin, metadata);
}

export function leaveRoom(roomId: string, socketId: string): RoomResult<void> {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: RoomError.ROOM_NOT_FOUND, message: 'Room not found' };
  }
  const result = room.removeParticipant(socketId);
  // Clean up empty rooms
  if (room.getParticipantCount() === 0) {
    removeRoom(roomId);
  }
  return result;
}

export function listRooms(): Room[] {
  return Array.from(rooms.values());
}

/**
 * Handles room-related messages from WebSocketManager
 * @param data Incoming message data (expects { action: string, ... })
 * @param ws   The WebSocket client instance
 * @param wsManager The WebSocketManager instance
 */
// ws: expects an object with send(msg: string) and optional socketId
export function handleRoomMessage(
  data: any,
  ws: { send: (msg: string) => void; socketId?: string },
  wsManager: any
) {
  const { action, roomId, secret, config, isAdmin, metadata, role } = data;

  switch (action) {
    case 'create': {
      // Per-user room creation cap
      const MAX_ROOMS_PER_USER = 5;
      const userRoomCount = Array.from(rooms.values()).filter(r => r.createdBy === ws.userId).length;
      if (userRoomCount >= MAX_ROOMS_PER_USER) {
        ws.send(JSON.stringify({ type: 'room', error: `You have reached the maximum of ${MAX_ROOMS_PER_USER} rooms.`, action: 'error' }));
        break;
      }
      // Create a new room, let RoomManager generate the ID
      const room = createRoom(undefined, secret, config as RoomConfig || {}, ws.userId, ws.socketId);
      ws.send(JSON.stringify({
        type: 'room',
        action: 'created',
        ...room.toJSON()
      }));
      break;
    }
    case 'join': {
      if (!roomId || !ws.socketId) {
        ws.send(JSON.stringify({ type: 'room:error', error: 'Missing roomId or socketId', action }));
        return;
      }
      const result = joinRoom(
        roomId,
        secret || '',
        ws.socketId,
        isAdmin || false,
        config as RoomConfig || {},
        { ...metadata, role }
      );
      ws.send(JSON.stringify({ type: 'room:join', ...result }));
      break;
    }
    case 'leave': {
      if (!roomId || !ws.socketId) {
        ws.send(JSON.stringify({ type: 'room:error', error: 'Missing roomId or socketId', action }));
        return;
      }
      const result = leaveRoom(roomId, ws.socketId);
      ws.send(JSON.stringify({ type: 'room:leave', ...result }));
      break;
    }
    case 'status': {
      if (!roomId) {
        ws.send(JSON.stringify({ type: 'room', action: 'error', error: 'Missing roomId' }));
        return;
      }
      const room = getRoom(roomId);
      ws.send(JSON.stringify({
        type: 'room:status',
        status: room ? room.getStatus() : null
      }));
      break;
    }
    case 'list': {
      const allRooms = listRooms().map(r => r.getStatus());
      ws.send(JSON.stringify({ type: 'room:list', rooms: allRooms }));
      break;
    }
    default:
      ws.send(JSON.stringify({ type: 'room', action: 'error', error: 'Unknown room action' }));
  }
}
