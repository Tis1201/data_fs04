import { RoomManager } from './RoomManager';
import type { WebSocket } from '../websocket/WebSocketManager';
import type { RoomConfig } from './Room';

/**
 * Handles room-related messages from WebSocketManager
 * @param data Incoming message data (expects { action: string, ... })
 * @param ws   The WebSocket client instance
 * @param wsManager The WebSocketManager instance
 */
export function handleRoomMessage(data: any, ws: WebSocket, wsManager: any) {
  const roomManager = RoomManager.getInstance();
  const { action, roomId, secret, config, isAdmin, metadata } = data;

  switch (action) {
    case 'join': {
      if (!roomId || !ws.socketId) return;
      const result = roomManager.joinRoom(
        roomId,
        secret || '',
        ws.socketId,
        isAdmin || false,
        config as RoomConfig || {},
        metadata
      );
      ws.send(JSON.stringify({ type: 'room:join', ...result }));
      break;
    }
    case 'leave': {
      if (!roomId || !ws.socketId) return;
      const result = roomManager.leaveRoom(roomId, ws.socketId);
      ws.send(JSON.stringify({ type: 'room:leave', ...result }));
      break;
    }
    case 'status': {
      if (!roomId) return;
      const room = roomManager.getRoom(roomId);
      ws.send(JSON.stringify({
        type: 'room:status',
        status: room ? room.getStatus() : null
      }));
      break;
    }
    case 'list': {
      const rooms = roomManager.listRooms().map(r => r.getStatus());
      ws.send(JSON.stringify({ type: 'room:list', rooms }));
      break;
    }
    default:
      ws.send(JSON.stringify({ type: 'room:error', error: 'Unknown room action', action }));
  }
}
