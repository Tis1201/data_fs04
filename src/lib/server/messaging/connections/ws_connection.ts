import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { InMessage } from '../interfaces/message';

export class WSConnection implements Connection {
  meta: ConnectionMeta;
  private socket: WebSocket;

  constructor(meta: ConnectionMeta, socket: WebSocket) {
    console.log(`[WSConnection] Constructor called with meta:`, meta);
    console.log(`[WSConnection] Socket readyState:`, socket.readyState);
    this.meta = meta;
    this.socket = socket;
    console.log(`[WSConnection] WSConnection instance created with ID: ${this.meta.id}`);
  }

  start(): void {
    console.log(`[WSConnection] Starting connection ${this.meta.id}`);
    
    this.socket.on('message', async (msg) => {
      console.log(`[WSConnection] Raw message received on ${this.meta.id}:`, msg.toString());
      await this.handleMessage(msg);
    });

    this.socket.on('error', (err) => {
      console.warn(`[WSConnection] error on ${this.meta.id}:`, err);
    });

    this.socket.on('close', () => {
      console.info(`[WSConnection] connection closed: ${this.meta.id}`);
      ConnectionManager.unregisterConnection(this.meta.id);
    });
    
    console.log(`[WSConnection] Event listeners attached for ${this.meta.id}`);
  }


  async send(payload: any): Promise<void> {
    console.log(`[WSConnection] ===== SENDING MESSAGE =====`);
    console.log(`[WSConnection] Connection ID: ${this.meta.id}`);
    console.log(`[WSConnection] Socket readyState: ${this.socket.readyState}`);
    console.log(`[WSConnection] Payload:`, JSON.stringify(payload, null, 2));
    
    if (this.socket.readyState === this.socket.OPEN) {
      console.log(`[WSConnection] Socket is open, sending message...`);
      this.socket.send(JSON.stringify(payload));
      console.log(`[WSConnection] Message sent successfully to ${this.meta.id}`);
    } else {
      console.warn(`[WSConnection] Tried to send to closed socket: ${this.meta.id}, readyState: ${this.socket.readyState}`);
    }
  }

  async handleMessage(raw: string): Promise<void> {
    console.log(`[WSConnection] handleMessage called for ${this.meta.id} with raw data:`, raw);
    
    // Here you can parse and dispatch the message
    let parsed: any;

    try {
      parsed = JSON.parse(raw.toString());
      console.log(`[WSConnection] Successfully parsed JSON for ${this.meta.id}:`, parsed);
    } catch (e) {
      console.warn(`[WSConnection] Invalid JSON from ${this.meta.id}:`, raw);
      console.warn(`[WSConnection] Parse error:`, e);
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

    console.log(`[WSConnection] Composed message for ${this.meta.id}:`, message);

    if(parsed.type === 'ping') {
      console.log(`[WSConnection] Handling ping message for ${this.meta.id}`);
      this.send({ type: 'pong' });
      return;
    }

    console.log(`[WSConnection] Dispatching message to MessageDispatcher for ${this.meta.id}`);
    try {
      const { MessageDispatcher } = await import("../core/dispatcher");
      console.log(`[WSConnection] MessageDispatcher imported successfully for ${this.meta.id}`);
      await MessageDispatcher.dispatch(message);
      console.log(`[WSConnection] Message dispatched successfully for ${this.meta.id}`);
    } catch (error) {
      console.error(`[WSConnection] Error dispatching message for ${this.meta.id}:`, error);
      console.error(`[WSConnection] Error stack:`, error.stack);
    }
  }

  close(): void {
    this.socket.close();
  }
}
