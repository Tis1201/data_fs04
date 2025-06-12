/**
 * Server-Sent Events (SSE) implementation for real-time updates
 */
import type { RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

/**
 * SSE Manager to handle client connections and broadcasting events
 */
class SSEManager {
  private clients: Map<string, ReadableStreamDefaultController> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Start ping interval to keep connections alive
    this.pingInterval = setInterval(() => {
      this.broadcast('ping', { timestamp: Date.now() });
    }, 30000); // Send ping every 30 seconds
    
    logger.debug('SSE Manager initialized');
  }
  
  /**
   * Add a new SSE client
   * @param clientId Unique identifier for the client
   * @param controller Stream controller for sending events
   */
  addClient(clientId: string, controller: ReadableStreamDefaultController) {
    this.clients.set(clientId, controller);
    logger.debug(`SSE client added: ${clientId}. Total clients: ${this.clients.size}`);
  }
  
  /**
   * Remove an SSE client
   * @param clientId Unique identifier for the client
   */
  removeClient(clientId: string) {
    this.clients.delete(clientId);
    logger.debug(`SSE client removed: ${clientId}. Total clients: ${this.clients.size}`);
  }
  
  /**
   * Send an event to a specific client
   * @param clientId Unique identifier for the client
   * @param eventType Type of event to send
   * @param data Data to send with the event
   * @returns Boolean indicating if the event was sent successfully
   */
  sendToClient(clientId: string, eventType: string, data: any): boolean {
    const controller = this.clients.get(clientId);
    if (!controller) {
      logger.warn(`Attempted to send to non-existent SSE client: ${clientId}`);
      return false;
    }
    
    try {
      const serializedData = JSON.stringify(data);
      controller.enqueue(`event: ${eventType}\ndata: ${serializedData}\n\n`);
      return true;
    } catch (error) {
      logger.error(`Error sending SSE event to client ${clientId}:`, error);
      return false;
    }
  }
  
  /**
   * Broadcast an event to all connected clients
   * @param eventType Type of event to broadcast
   * @param data Data to send with the event
   * @returns Number of clients the event was sent to
   */
  broadcast(eventType: string, data: any): number {
    if (this.clients.size === 0) {
      return 0;
    }
    
    let sentCount = 0;
    const serializedData = JSON.stringify(data);
    const message = `event: ${eventType}\ndata: ${serializedData}\n\n`;
    
    for (const [clientId, controller] of this.clients.entries()) {
      try {
        controller.enqueue(message);
        sentCount++;
      } catch (error) {
        logger.error(`Error broadcasting to client ${clientId}:`, error);
        // Remove failed client
        this.clients.delete(clientId);
      }
    }
    
    logger.debug(`Broadcast event '${eventType}' to ${sentCount} clients`);
    return sentCount;
  }
  
  /**
   * Get the current number of connected clients
   */
  get clientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Clean up resources when shutting down
   */
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.clients.clear();
    logger.debug('SSE Manager cleaned up');
  }
}

// Create a singleton instance of the SSE manager
export const sseManager = new SSEManager();

/**
 * Creates an SSE connection handler (legacy method, prefer using sseManager directly)
 * @param event The SvelteKit request event
 * @param options SSE configuration options
 * @returns A response object with the SSE stream
 */
export function createSSEConnection(event: RequestEvent, options: SSEOptions = {}) {
  const {
    initialData,
    eventType = 'message',
    connectionTimeout = 60 * 60 * 1000 // 1 hour default
  } = options;

  // Set headers for SSE
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  let clientId: string = crypto.randomUUID();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      logger.debug(`SSE connection started: ${clientId}`);
      
      // Add client to manager
      sseManager.addClient(clientId, controller);

      // Send initial data if provided
      if (initialData) {
        const data = JSON.stringify(initialData);
        controller.enqueue(`event: ${eventType}\ndata: ${data}\n\n`);
      }

      // Set connection timeout
      setTimeout(() => {
        logger.debug(`SSE connection timeout: ${clientId}`);
        sseManager.removeClient(clientId);
        controller.close();
      }, connectionTimeout);
    },
    cancel() {
      logger.debug(`SSE connection closed: ${clientId}`);
      sseManager.removeClient(clientId);
    }
  });

  return new Response(stream, { headers });
}

// Types for SSE options
export interface SSEOptions {
  /** Initial data to send to the client */
  initialData?: any;
  /** Event type (defaults to 'message') */
  eventType?: string;
  /** Connection timeout in milliseconds (defaults to 1 hour) */
  connectionTimeout?: number;
}
