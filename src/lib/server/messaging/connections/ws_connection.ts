import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { InMessage } from '../interfaces/message';

export class WSConnection implements Connection {
  meta: ConnectionMeta;
  private socket: WebSocket;

  constructor(meta: ConnectionMeta, socket: WebSocket) {
    this.meta = meta;
    this.socket = socket;
  }

  start(): void {

    this.socket.on('message', async (msg) => {
      await this.handleMessage(msg);
    });

    this.socket.on('error', (err) => {
      console.warn(`[WSConnection] error on ${this.meta.id}:`, err);
    });

    this.socket.on('close', () => {
      console.info(`[WSConnection] connection closed: ${this.meta.id}`);
      ConnectionManager.unregisterConnection(this.meta.id);
    });
    
  }


  async send(payload: any): Promise<void> {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
    }
  }

  async handleMessage(raw: string): Promise<void> {
    // Here you can parse and dispatch the message
    let parsed: any;

    try {
      parsed = JSON.parse(raw.toString());
    } catch (e) {
      console.warn(`[WSConnection] Invalid JSON from ${this.meta.id}:`, raw);
      return;
    }

    // Compose the full Message object
    const message: InMessage = {
      type: parsed.type,
      scope: parsed.scope,
      payload: parsed.payload,
      userInfo: this.meta.userInfo,
      protocol: this.meta.protocol,
      connectionId: this.meta.id,
      // Extract requestId if it exists in the parsed message
      requestId: parsed.requestId,
    };


    if(parsed.type === 'ping') {
      this.send({ type: 'pong' });
      return;
    }

    try {
      const { MessageDispatcher } = await import("../core/dispatcher");
      await MessageDispatcher.dispatch(message);
    } catch (error) {
      console.error(`[WSConnection] Error stack:`, error.stack);
    }
  }

  close(): void {
    this.socket.close();
  }
}
