import { logger } from '$lib/server/logger';
import { WebSocketManager, type ExtendedWebSocket } from '../websocket/WebSocketManager';
import { EventEmitter } from 'events';

export enum EventType {
  WHATSAPP_MESSAGE = 'whatsapp:message',
  WHATSAPP_STATUS = 'whatsapp:status',
  WEBRTC_EVENT = 'webrtc:event',
  SYSTEM_EVENT = 'system:event',
  MESSAGE = "message",
}

export enum EventDestination {
  WEBSOCKET = 'websocket',
  SSE = 'sse',
  BOTH = 'both'
}

export enum EventScope {
  GLOBAL = 'global',
  USER = 'user'
}

export interface EventData {
  type: EventType;
  destination: EventDestination;
  scope: EventScope;
  payload: any;
  timestamp: number;
  source?: string;
  user_id?: string;
}

export class EventRouter extends EventEmitter {
  private static instance: EventRouter;
  private wsManager: WebSocketManager;

  private constructor() {
    super();
    this.wsManager = WebSocketManager.getInstance();
    logger.info('✅ EventRouter initialized');
  }

  public static getInstance(): EventRouter {
    if (!EventRouter.instance) {
      EventRouter.instance = new EventRouter();
    }
    return EventRouter.instance;
  }

  /**
   * Main routing entry point
   */
  public route(event: EventData): boolean {
    if (!event.type || !event.destination || !event.scope) {
      logger.error('[EventRouter] Invalid event:', event);
      return false;
    }

    
    switch (event.scope) {
      case EventScope.GLOBAL:
        return this.routeToAll(event);
      case EventScope.USER:
        return this.routeToUser(event);
      default:
        logger.warn('[EventRouter] Unknown scope:', event.scope);
        return false;
    }
  }

  /**
   * Broadcast event to all clients
   */
  private routeToAll(event: EventData): boolean {
    try {
      const clients = this.wsManager.getClients();
      this.sendToClients(clients, event);
      return true;
    } catch (err) {
      logger.error('[EventRouter] routeToAll error:', err);
      return false;
    }
  }

  /**
   * Route event to specific user
   */
  private routeToUser(event: EventData): boolean {

    logger.debug(`[EventRouter] ====1`);

    if (!event.user_id) {
      logger.warn('[EventRouter] Missing user_id for user-scoped event');
      return false;
    }

    this.wsManager.sendToUser({
        type: event.type,
        data: {message: event.payload}
    },event.user_id);

    return true;      
  }


  /**
   * Helper to emit an event easily
   */
  public emitEvent(type: EventType, payload: any, destination = EventDestination.WEBSOCKET, scope = EventScope.GLOBAL, user_id?: string, source?: string): void {
    
    
    
    const event: EventData = {
      type,
      payload,
      destination,
      scope,
      user_id,
      source,
      timestamp: Date.now()
    };

    this.route(event);
  }
}

export const eventRouter = EventRouter.getInstance();
