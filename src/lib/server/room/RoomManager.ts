import { Room, RoomConfig, RoomResult, RoomParticipant, RoomError } from './Room';
import { eventRouter, EventType } from '../event/EventRouter';
import { v4 as uuidv4 } from 'uuid';


// Module-scoped state
const rooms = new Map<string, Room>();

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function createRoom(roomId?: string, secret: string, config: RoomConfig = {}): Room {
  const actualRoomId = roomId || uuidv4();
  let room = rooms.get(actualRoomId);
  if (!room) {
    room = new Room(actualRoomId, secret, config);
    rooms.set(actualRoomId, room);
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
    room = createRoom(roomId, secret, config);
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
  const { action, roomId, secret, config, isAdmin, metadata } = data;

  switch (action) {
    case 'join': {
      if (!roomId || !ws.socketId) return;
      const result = joinRoom(
        roomId,
        secret || '',
        ws.socketId,
        isAdmin || false,
        config as RoomConfig || {},
        metadata
      );
      const userId = (ws as any).userId || ws.socketId;
      eventRouter.sendPrivateMessage(
        userId,
        { type: 'room:join', ...result },
        EventType.MESSAGE
      );
      break;
    }
    case 'leave': {
      if (!roomId || !ws.socketId) return;
      const result = leaveRoom(roomId, ws.socketId);
      eventRouter.sendPrivateMessage(
  (ws as any).userId || ws.socketId,
  { type: 'room:leave', ...result },
  EventType.MESSAGE
);
      break;
    }
    case 'status': {
      if (!roomId) return;
      const room = getRoom(roomId);
      eventRouter.sendPrivateMessage(
  (ws as any).userId || ws.socketId,
  {
    type: 'room:status',
    status: room ? room.getStatus() : null
  },
  EventType.MESSAGE
);
      break;
    }
    case 'list': {
      const allRooms = listRooms().map(r => r.getStatus());
      eventRouter.sendPrivateMessage(
  (ws as any).userId || ws.socketId,
  { type: 'room:list', rooms: allRooms },
  EventType.MESSAGE
);
      break;
    }
    default:
      eventRouter.sendPrivateMessage(
  (ws as any).userId || ws.socketId,
  { type: 'room:error', error: 'Unknown room action', action },
  EventType.MESSAGE
);
  }
}
