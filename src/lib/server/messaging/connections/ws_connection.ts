import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { InMessage } from '../interfaces/message';
import type { ExtendedWebSocket } from '../../websocket/WebSocketUtils';
import { logger } from '../../logger';

export class WSConnection implements Connection {
  meta: ConnectionMeta;
  private socket: ExtendedWebSocket;

  constructor(meta: ConnectionMeta, socket: ExtendedWebSocket) {
    this.meta = meta;
    this.socket = socket;
  }

  start(): void {
    logger.info(`[WSConnection] Connection started: ${this.meta.id}`);

    (this.socket as any).on('message', async (msg: Buffer) => {
      await this.handleMessage(msg);
    });

    (this.socket as any).on('error', (err: Error) => {
      logger.warn(`[WSConnection] Error on ${this.meta.id}:`, err);
    });

    (this.socket as any).on('close', () => {
      logger.info(`[WSConnection] Connection closed: ${this.meta.id}`);
      const connectionId = this.meta.id;
      if (connectionId) {
        ConnectionManager.unregisterConnection(connectionId);
      }
    });
  }


  async send(payload: any): Promise<void> {
    const ws = this.socket as any;
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
    }
  }

  async handleMessage(raw: string | Buffer): Promise<void> {
    let parsed: any;
    const rawString = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);

    try {
      parsed = JSON.parse(rawString);
    } catch (e) {
      logger.warn(`[WSConnection] Invalid JSON from ${this.meta.id}: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const connectionId = this.meta.id;
    if (!connectionId) {
      logger.error(`[WSConnection] Cannot create message: connection ID is missing`);
      return;
    }

    const message: InMessage = {
      type: parsed.type,
      scope: parsed.scope,
      payload: parsed.payload,
      userInfo: this.meta.userInfo,
      protocol: this.meta.protocol,
      connectionId: connectionId,
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
      logger.error(`[WSConnection] Error in dispatch:`, error instanceof Error ? error : new Error(String(error)));
    }
  }

  close(): void {
    const connectionId = this.meta.id;
    if (connectionId) {
      (this.socket as any).close();
    }
  }
}
