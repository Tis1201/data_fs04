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
    // this.socket.send(JSON.stringify(payload));
    logger.debug(`[SSEConnection] Sending message: ${JSON.stringify(payload)}`);
    // controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    this.controller.enqueue(JSON.stringify(payload));      
  }

  async handleMessage(raw: string | Buffer): Promise<void> {
    // SSE is one-way, so we just log incoming messages
    if (typeof raw === 'string') {
      console.log('[SSEConnection] Received message:', raw);
    }
  }
}
