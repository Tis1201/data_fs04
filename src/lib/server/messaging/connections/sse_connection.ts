import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { RoutingMessage } from '../interfaces/message';
import { logger } from '$lib/server/logger';
import {
  ResponseStatus,
  ResponseCategory,
  ResponseSeverity,
  createSuccessResponse,
  createSystemResponse,
  createErrorResponse,
  type BaseResponse
} from '$lib/shared/response_format';

export class SSEConnection implements Connection {
  private static readonly PING_INTERVAL_MS = 30000; // 30 seconds
  private pingInterval: NodeJS.Timeout | null = null;
  private isAlive = true;
  private controllerClosed = false;

  constructor(
    public readonly meta: ConnectionMeta,
    private readonly controller: ReadableStreamDefaultController
  ) {
    this.setupPing();
  }

  private setupPing(): void {
    // Send first ping immediately
    this.sendPing().catch(error => {
      logger.error(`[SSEConnection] Initial ping failed: ${error}`);
    });

    // Set up regular pings
    this.pingInterval = setInterval(() => {
      if (!this.isAlive || this.controllerClosed) {
        logger.debug(`[SSEConnection] Ping skipped - connection not alive (alive=${this.isAlive}, closed=${this.controllerClosed})`);
        this.cleanup();
        return;
      }
      this.sendPing().catch(error => {
        // Don't log controller closed errors as they're expected when connections end
        if (!(error instanceof Error && error.message.includes('Controller is already closed'))) {
          logger.error(`[SSEConnection] Ping failed for connection ${this.meta.id}: ${error}`);
        } else {
          logger.debug(`[SSEConnection] Ping failed due to closed controller for connection ${this.meta.id}`);
        }
        this.cleanup();
      });
    }, SSEConnection.PING_INTERVAL_MS);
  }

  private async sendPing(): Promise<void> {
    try {
      logger.debug(`[SSEConnection] Sending ping to connection ${this.meta.id} (alive=${this.isAlive}, closed=${this.controllerClosed})`);
      
      // Create a standardized system response for the ping
      const pingResponse = createSystemResponse({
        event: 'ping',
        message: 'Connection heartbeat',
        status: ResponseStatus.SUCCESS,
        severity: ResponseSeverity.INFO,
        meta: {
          connectionId: this.meta.id,
          deviceId: this.meta.deviceId
        }
      });
      
      await this.sendStandardized(pingResponse);
      // logger.debug(`[SSEConnection] Ping sent successfully to connection ${this.meta.id}`);
    } catch (error) {
      logger.error(`[SSEConnection] Ping send failed for connection ${this.meta.id}: ${error}`);
      throw error;
    }
  }

  /**
   * Send a message using the legacy format (for backward compatibility)
   */
  async send(payload: unknown): Promise<void> {
    if (!this.isAlive || this.controllerClosed) {
      throw new Error('Connection is closed');
    }

    try {
      const data = JSON.stringify({
        ...(payload as object),
        timestamp: new Date().toISOString()
      });

      const message = `data: ${data}\n\n`;
      this.controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      if (error instanceof Error && error.message.includes('Controller is already closed')) {
        // Mark controller as closed to prevent further attempts
        this.controllerClosed = true;
        throw new Error('Connection is closed');
      }
      logger.error(`[SSEConnection] Failed to send message: ${error}`);
      throw error;
    }
  }
  
  /**
   * Send a message using the standardized response format
   */
  async sendStandardized(response: BaseResponse): Promise<void> {
    // logger.debug(`[SSEConnection] sendStandardized called for connection ${this.meta.id} (alive=${this.isAlive}, closed=${this.controllerClosed})`);
    
    if (!this.isAlive || this.controllerClosed) {
      logger.warn(`[SSEConnection] Cannot send message to closed connection ${this.meta.id}`);
      throw new Error('Connection is closed');
    }

    try {
      const message = `data: ${JSON.stringify(response)}\n\n`;
      // logger.debug(`[SSEConnection] Enqueuing message for connection ${this.meta.id}: ${message.substring(0, 100)}...`);
      this.controller.enqueue(new TextEncoder().encode(message));
      // logger.debug(`[SSEConnection] Message enqueued successfully for connection ${this.meta.id}`);
    } catch (error) {
      logger.error(`[SSEConnection] Failed to send standardized message to connection ${this.meta.id}: ${error}`);
      if (error instanceof Error && error.message.includes('Controller is already closed')) {
        // Mark controller as closed to prevent further attempts
        this.controllerClosed = true;
        logger.warn(`[SSEConnection] Controller marked as closed for connection ${this.meta.id}`);
        return; // Silently fail on closed controller - it's an expected condition
      }
      throw error;
    }
  }

  async handleMessage(raw: string | Buffer): Promise<void> {
    if (!this.isAlive) return;

    try {
      const message = typeof raw === 'string' ? raw : raw.toString();
      logger.debug(`[SSEConnection] Received message: ${message}`);

      // Reset alive flag on any message
      this.isAlive = true;
    } catch (error) {
      logger.error(`[SSEConnection] Error handling message: ${error}`);
    }
  }

  close(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (!this.isAlive) {
      logger.debug(`[SSEConnection] Cleanup skipped - connection ${this.meta.id} already not alive`);
      return;
    }
    
    logger.info(`[SSEConnection] Cleaning up connection ${this.meta.id} (protocol: ${this.meta.protocol})`);
    this.isAlive = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (!this.controllerClosed) {
      try {
        this.controller.close();
        this.controllerClosed = true;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Controller is already closed')) {
          this.controllerClosed = true;
        } else {
          logger.error(`[SSEConnection] Error closing controller: ${error}`);
        }
      }
    }

    // FIX: Unregister connection silently to avoid race condition warnings
    if (this.meta.id) {
      try {
        const connection = ConnectionManager.getConnection(this.meta.id);
        if (connection) {
          ConnectionManager.unregisterConnection(this.meta.id);
          logger.info(`[SSEConnection] Connection unregistered: ${this.meta.id}`);
        } else {
          logger.debug(`[SSEConnection] Connection ${this.meta.id} not found in connection manager`);
        }
        // Silently ignore if already unregistered (race condition is benign)
      } catch (error) {
        logger.warn(`[SSEConnection] Error unregistering connection ${this.meta.id}: ${error}`);
        // Ignore - connection may have been cleaned up already
      }
    }

    //Todo: Need to clean up its own subscriptions
  }
}
