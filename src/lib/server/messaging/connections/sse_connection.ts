import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { InMessage } from '../interfaces/message';
import { logger } from '$lib/server/logger';

export class SSEConnection implements Connection {
  meta: ConnectionMeta;

  private controller: ReadableStreamDefaultController;

  constructor(meta: ConnectionMeta, controller: ReadableStreamDefaultController) {
    this.meta = meta;
    this.controller = controller;
  }

  // start(): void {
  //   this.socket.onmessage = async (msg) => {
  //     await this.handleMessage(msg);
  //   };

  //   this.socket.onerror = (err) => {
  //     console.warn(`[SSEConnection] error on ${this.meta.id}:`, err);
  //   };

  //   this.socket.onclose = () => {
  //     console.info(`[SSEConnection] connection closed: ${this.meta.id}`);
  //     ConnectionManager.unregisterConnection(this.meta.id);
  //   };
  // }

  async send(payload: any): Promise<void> {
    logger.debug(`[SSEConnection] Sending message: ${JSON.stringify(payload)}`);
    
    const encoder = new TextEncoder();
    const event = payload.type || 'message';
    const data = JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString()
    });
    
    // Format the SSE message according to the spec
    const message = [
      `event: ${event}`,
      `data: ${data}`,
      '\n' // Double newline to indicate end of message
    ].join('\n');
    
    try {
      this.controller.enqueue(encoder.encode(message));
    } catch (error) {
      logger.error(`[SSEConnection] Failed to send message: ${error}`);
      throw error;
    }
  }

  async handleMessage(raw: string | Buffer): Promise<void> {
    // SSE is one-way, so we just log incoming messages
    if (typeof raw === 'string') {
      console.log('[SSEConnection] Received message:', raw);
    }
  }
}
