import { WebSocket } from 'ws';
import { logger } from '../logger';
import { handleWebRTCMessage } from '../webrtc/WebrtcSignalingUtils';
import { handleRoomMessage } from '../room/RoomManager';

/**
 * Extended WebSocket type with extra metadata.
 */
export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  socketId: string;
  userId: string;
  userRole: string;
}




/**
 * WebSocketManager is a singleton that:
 *  - Tracks all connected clients
 *  - Provides broadcast/unicast functionality
 *  - Periodically logs the total number of clients
 */
export class WebSocketManager {
  private static instance: WebSocketManager;
  private clients = new Set<ExtendedWebSocket>();

  private constructor() {
    logger.info('WebSocket Manager initialized');

    // Every 5 seconds, log the total number of connected clients
    // setInterval(() => {
    //   const count = this.getClientCount();
    //   logger.info(`[wss:manager] Total connected clients: ${count}`);
    // }, 5000);
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Add a new client to the registry.
   */
  addClient = (ws: ExtendedWebSocket): void => {
    this.clients.add(ws);
    logger.info(`[wss:manager] Added client ${ws.socketId} (user: ${ws.userId}). Now ${this.getClientCount()} total.`);
  };

  /**
   * Remove a client from the registry.
   */
  removeClient = (ws: ExtendedWebSocket): void => {
    if (this.clients.delete(ws)) {
      logger.info(`[wss:manager] Removed client ${ws.socketId} (user: ${ws.userId}). Now ${this.getClientCount()} total.`);
    } else {
      logger.warn(`[wss:manager] Tried to remove client ${ws.socketId}, but it was not found.`);
    }
  };

  /**
   * Return how many clients are currently connected.
   */
  getClientCount = (): number => {
    return this.clients.size;
  };

  /**
   * Return an array of all connected clients.
   */
  getClients = (): ExtendedWebSocket[] => {
    return Array.from(this.clients);
  };

  /**
   * Find a client by its socketId.
   */
  getClientBySocketId = (socketId: string): ExtendedWebSocket | undefined => {
    return Array.from(this.clients).find((ws) => ws.socketId === socketId);
  };

  /**
   * Get all clients belonging to a particular userId.
   */
  getClientsByUserId = (userId: string): ExtendedWebSocket[] => {
    const matches = Array.from(this.clients).filter((ws) => ws.userId === userId);
    logger.debug(`[wss:manager] Found ${matches.length} clients for user ${userId}.`);
    return matches;
  };

  /**
   * Broadcast a message (object or string) to all connected clients.
   */
  broadcast = (message: any): void => {
    const json = JSON.stringify(message);
    logger.info(`[wss:manager] Broadcasting to ${this.getClientCount()} clients.`);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(json);
      }
    }
  };

  /**
   * Send a message to a single client by its socketId.
   * Returns true if successful, false otherwise.
   */
  unicast = (message: any, socketId: string): boolean => {
    const client = this.getClientBySocketId(socketId);
    if (!client) {
      logger.warn(`[wss:manager] No client with socketId ${socketId}.`);
      return false;
    }
    if (client.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      client.send(JSON.stringify(message));
      return true;
    } catch (err) {
      logger.error(`[wss:manager] Error sending to ${socketId}:`, err);
      return false;
    }
  };

  /**
   * Send a message to all sockets of a given userId.
   * Returns the number of clients to which the message was actually sent.
   */
  sendToUser = (message: any, userId: string): number => {
    const clients = this.getClientsByUserId(userId);
    if (clients.length === 0) {
      logger.warn(`[wss:manager] No clients found for user: ${userId}`);
      return 0;
    }

    const json = JSON.stringify(message);
    let sentCount = 0;
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(json);
          sentCount++;
        } catch (err) {
          logger.error(`[wss:manager] Error sending to ${client.socketId}:`, err);
        }
      }
    }
    return sentCount;
  };

  /**
   * Central entry point for handling an incoming message from a client.
   * Dispatches to the appropriate handler based on `data.type`.
   */
  handleMessage = (message: string, ws: ExtendedWebSocket): void => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      logger.warn(`[wss:manager] Invalid JSON from ${ws.socketId}: ${message}`);
      return;
    }

    logger.info(
      `[wss:manager] Received [${data.type}] from ${ws.socketId} (user: ${ws.userId}).`
    );

    switch (data.type) {
      case 'ping':
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        break;

      case 'register':
        logger.info(`[wss:manager] Client registered: ${ws.socketId} for user ${ws.userId}`);
        break;

      case 'webrtc':
        handleWebRTCMessage(data, ws, this);
        break;

      case 'room':
        handleRoomMessage(data, ws, this);
        break;

      default:
        logger.warn(`[wss:manager] Unknown message type: ${data.type}`);
    }
  };

  /**
   * Called when a client connection throws an error.
   * We log it and remove the client so it won't linger.
   */
  handleClientError = (ws: ExtendedWebSocket, error: Error): void => {
    logger.error(`[wss:manager] Error on client ${ws.socketId}:`, error);
    this.removeClient(ws);
  };

  /**
   * Called when a client disconnects cleanly. Remove it from the registry.
   */
  handleClientDisconnect = (ws: ExtendedWebSocket): void => {
    logger.info(`[wss:manager] Client disconnected: ${ws.socketId} for user ${ws.userId}`);
    this.removeClient(ws);
  };
}

// Export the single shared instance
export const wsManager = WebSocketManager.getInstance();
