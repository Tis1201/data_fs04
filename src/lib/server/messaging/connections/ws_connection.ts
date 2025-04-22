import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { Message } from '../interfaces/message';

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
      console.warn(`[WSConnection] Tried to send to closed socket: ${this.meta.id}`);
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
    const message: Message = {
      payload: parsed,
      userInfo: this.meta.userInfo,
      protocol: this.meta.protocol,
      connectionId: this.meta.id,
      scope: `user:${this.meta.userInfo.id}`
    };

    const { MessageDispatcher } = await import("../core/dispatcher");
    await MessageDispatcher.dispatch(message);

  }

  close(): void {
    this.socket.close();
  }
}
