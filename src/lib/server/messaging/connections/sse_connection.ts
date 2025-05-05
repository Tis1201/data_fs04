import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { RoutingMessage } from '../interfaces/message';
import { logger } from '$lib/server/logger';

export class SSEConnection implements Connection {
  private static readonly PING_INTERVAL_MS = 30000; // 30 seconds
  private pingInterval: NodeJS.Timeout | null = null;
  private isAlive = true;

  constructor(
    public readonly meta: ConnectionMeta,
    private readonly controller: ReadableStreamDefaultController
  ) {
    this.setupPing();
  }

  private setupPing(): void {
    // Send first ping immediately
    this.sendPing().catch(error => {
      logger.error(`[SSEConnection] Initial ping failed:`, error);
    });

    // Set up regular pings
    this.pingInterval = setInterval(() => {
      if (!this.isAlive) {
        this.cleanup();
        return;
      }
      this.sendPing().catch(error => {
        logger.error(`[SSEConnection] Ping failed:`, error);
        this.cleanup();
      });
    }, SSEConnection.PING_INTERVAL_MS);
  }

  private async sendPing(): Promise<void> {
    const pingMessage: RoutingMessage = {
      id: `ping_${Date.now()}`,
      type: 'device',
      scope: `connection:${this.meta.id}`,
      payload: { action: 'ping', timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      // Add the missing required properties
      userInfo: this.meta.userInfo,
      protocol: this.meta.protocol,
      connectionId: this.meta.id!
    };
    await this.send(pingMessage);
  }

  async send(payload: unknown): Promise<void> {
    if (!this.isAlive) {
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
      logger.error(`[SSEConnection] Failed to send message:`, error);
      throw error;
    }
  }

  async handleMessage(raw: string | Buffer): Promise<void> {
    if (!this.isAlive) return;

    try {
      const message = typeof raw === 'string' ? raw : raw.toString();
      logger.debug(`[SSEConnection] Received message:`, message);

      // Reset alive flag on any message
      this.isAlive = true;
    } catch (error) {
      logger.error(`[SSEConnection] Error handling message:`, error);
    }
  }

  close(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (!this.isAlive) return;
    this.isAlive = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    try {
      this.controller.close();
    } catch (error) {
      logger.error(`[SSEConnection] Error closing controller:`, error);
    }

    ConnectionManager.unregisterConnection(this.meta.id);
    logger.debug(`[SSEConnection] Connection closed: ${this.meta.id}`);
  }
}