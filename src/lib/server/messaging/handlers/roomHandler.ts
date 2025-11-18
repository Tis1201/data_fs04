import type { InMessage, RoutingMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { MessageFactory, SystemUser } from '../interfaces/message';
import { publisher } from '../core/publisher';
import { logger } from '$lib/server/logger';
import { 
  createRoom, 
  getRoom, 
  joinRoom, 
  leaveRoom, 
  listRooms,
  type RoomConfig 
} from '../../room/RoomManager';
import { ConnectionManager } from '../core/connectionManager';

export const roomHandler: Handler = {
  supports(type: string): boolean {
    return type === 'room';
  },

  async handle(message: InMessage): Promise<void> {
    const { payload, userInfo, connectionId } = message;
    const { action, data } = payload as any;
    const { roomId, password, config, isAdmin, metadata, role } = data || {};

    logger.debug('[RoomHandler] Handling room message', { action, roomId, connectionId });

    try {
      // Get connection to send responses back
      const connection = await ConnectionManager.getConnection(connectionId);
      if (!connection) {
        logger.warn('[RoomHandler] Connection not found', { connectionId });
        await sendErrorResponse(connectionId, 'Connection not found');
        return;
      }

      switch (action) {
        case 'create': {
          await handleCreateRoom(message, connectionId, userInfo, config);
          break;
        }
        case 'join': {
          await handleJoinRoom(message, connectionId, roomId, password, isAdmin, metadata, role);
          break;
        }
        case 'leave': {
          await handleLeaveRoom(message, connectionId, roomId);
          break;
        }
        case 'list': {
          await handleListRooms(message, connectionId);
          break;
        }
        default: {
          logger.warn('[RoomHandler] Unknown room action', { action });
          await sendErrorResponse(connectionId, 'Unknown room action');
        }
      }
    } catch (error) {
      logger.error('[RoomHandler] Error handling room message', { error, action, roomId });
      await sendErrorResponse(connectionId, error instanceof Error ? error.message : 'Unknown error');
    }
  }
};

async function handleCreateRoom(
  message: InMessage,
  connectionId: string,
  userInfo: any,
  config?: RoomConfig
): Promise<void> {
  // Per-user room creation cap
  const MAX_ROOMS_PER_USER = 100;
  const allRooms = listRooms();
  const userRoomCount = allRooms.filter(r => r.createdBy === userInfo.id).length;
  
  if (userRoomCount >= MAX_ROOMS_PER_USER) {
    await sendErrorResponse(
      connectionId,
      `You have reached the maximum of ${MAX_ROOMS_PER_USER} rooms.`,
      message.requestId
    );
    return;
  }

  // Create a new room (secret is required but not used, so we pass empty string)
  const room = createRoom(undefined, '', config || {}, userInfo.id, connectionId);
  
  // Get room data and convert Date objects to ISO strings
  const roomData = room.toJSON();
  const roomResponse = {
    ...roomData,
    lastActivity: roomData.lastActivity instanceof Date ? roomData.lastActivity.toISOString() : roomData.lastActivity,
    createdAt: roomData.createdAt instanceof Date ? roomData.createdAt.toISOString() : roomData.createdAt,
    participants: room.getParticipants().map(p => ({
      ...p,
      joinedAt: p.joinedAt instanceof Date ? p.joinedAt.toISOString() : p.joinedAt,
      lastActive: p.lastActive instanceof Date ? p.lastActive.toISOString() : p.lastActive
    }))
  };
  
  // Send success response
  const response: RoutingMessage = MessageFactory.toRoutingMessage({
    ...message,
    type: 'room',
    payload: {
      action: 'created',
      ...roomResponse
    }
  } as InMessage, {
    systemGenerated: true,
    echoToSender: true,
    scope: `connection:${connectionId}`
  });

  await publisher.publish(response);
  logger.info('[RoomHandler] Room created', { roomId: room.id, userId: userInfo.id });
}

async function handleJoinRoom(
  message: InMessage,
  connectionId: string,
  roomId: string,
  password?: string,
  isAdmin?: boolean,
  metadata?: Record<string, any>,
  role?: string
): Promise<void> {
  if (!roomId || !connectionId) {
    await sendErrorResponse(connectionId, 'Missing roomId or connectionId', message.requestId);
    return;
  }

  const room = getRoom(roomId);
  if (!room) {
    await sendErrorResponse(connectionId, 'Room not found', message.requestId);
    return;
  }

  // Validate access
  const access = room.validateAccess(password || '');
  if (!access.success) {
    await sendErrorResponse(connectionId, access.message || 'Invalid password', message.requestId);
    return;
  }

  // Add user as participant (Room.addParticipant takes userId, socketId, isAdmin, metadata)
  // Note: Room uses userId as the key, not socketId
  const result = room.addParticipant(message.userInfo.id, connectionId, isAdmin || false, { ...metadata, role });
  if (!result.success) {
    await sendErrorResponse(connectionId, result.message || 'Failed to join room', message.requestId);
    return;
  }

  // Send success response
  const response: RoutingMessage = MessageFactory.toRoutingMessage({
    ...message,
    type: 'room',
    payload: {
      action: 'joined',
      data: {}
    }
  } as InMessage, {
    systemGenerated: true,
    echoToSender: true,
    scope: `connection:${connectionId}`
  });

  await publisher.publish(response);
  logger.info('[RoomHandler] User joined room', { roomId, userId: message.userInfo.id });
}

async function handleLeaveRoom(
  message: InMessage,
  connectionId: string,
  roomId: string
): Promise<void> {
  if (!roomId || !connectionId) {
    await sendErrorResponse(connectionId, 'Missing roomId or connectionId', message.requestId);
    return;
  }

  // Note: Room.addParticipant uses userId as the key in the Map
  // Room.removeParticipant expects socketId, but since we stored with userId as key,
  // we need to use userId. However, there's a bug in Room class where removeParticipant
  // tries to get by socketId. We'll work around this by using the RoomManager's leaveRoom
  // which handles the Room class directly, or we can try using userId directly.
  // Actually, since participants Map uses userId as key, we should be able to access it directly
  const room = getRoom(roomId);
  if (!room) {
    await sendErrorResponse(connectionId, 'Room not found', message.requestId);
    return;
  }
  
  // Try to remove by userId first (since that's the key), fallback to connectionId
  // Note: This works around a bug in Room class where addParticipant uses userId as key
  // but removeParticipant expects socketId
  let result = room.removeParticipant(message.userInfo.id);
  if (!result.success) {
    // Fallback: try with connectionId
    result = room.removeParticipant(connectionId);
  }
  
  // Send response
  const response: RoutingMessage = MessageFactory.toRoutingMessage({
    ...message,
    type: 'room',
    payload: {
      action: 'left',
      ...result
    }
  } as InMessage, {
    systemGenerated: true,
    echoToSender: true,
    scope: `connection:${connectionId}`
  });

  await publisher.publish(response);
  logger.info('[RoomHandler] User left room', { roomId, userId: message.userInfo.id });
}

async function handleListRooms(
  message: InMessage,
  connectionId: string
): Promise<void> {
  const allRooms = listRooms().map(r => {
    const status = r.getStatus();
    // Convert Date objects to ISO strings for JSON serialization
    return {
      ...status,
      lastActivity: status.lastActivity instanceof Date ? status.lastActivity.toISOString() : status.lastActivity,
      createdAt: status.createdAt instanceof Date ? status.createdAt.toISOString() : status.createdAt,
      participants: r.getParticipants().map(p => ({
        ...p,
        joinedAt: p.joinedAt instanceof Date ? p.joinedAt.toISOString() : p.joinedAt,
        lastActive: p.lastActive instanceof Date ? p.lastActive.toISOString() : p.lastActive
      }))
    };
  });
  
  // Send response
  const response: RoutingMessage = MessageFactory.toRoutingMessage({
    ...message,
    type: 'room',
    payload: {
      action: 'list',
      rooms: allRooms
    }
  } as InMessage, {
    systemGenerated: true,
    echoToSender: true,
    scope: `connection:${connectionId}`
  });

  await publisher.publish(response);
  logger.debug('[RoomHandler] Room list sent', { count: allRooms.length });
}

async function sendErrorResponse(
  connectionId: string,
  error: string,
  requestId?: string
): Promise<void> {
  const errorMessage: RoutingMessage = MessageFactory.createSystemMessage(
    'room',
    `connection:${connectionId}`,
    {
      action: 'error',
      error
    },
    SystemUser,
    {
      echoToSender: true,
      requestId
    }
  );

  await publisher.publish(errorMessage);
}

