import type { UserInfo } from "$lib/server/types/user";

export type ConnectionProtocol =
  | 'websocket'
  | 'sse'
  | 'pushpin-wsoh'
  | 'pushpin-sse'
  | 'webhook'
  | 'mqtt'
  | string; // allow future custom protocols

export interface ConnectionMeta {
  id?: string;              // Unique connection ID
  userInfo: UserInfo;          // Owner of the connection
  sessionId?: string;        // Session ID if available
  nodeId: string;          // Node or instance managing it
  protocol: ConnectionProtocol;
  connectedAt: number;     // Unix timestamp
  route?: string;          // Route/path that initiated this connection
  [key: string]: any;      // Additional extensible fields
}

export interface Connection {
  meta: ConnectionMeta;

  start?(): void;

  send(payload: any): Promise<void>;

  /**
   * Handle an incoming message from this connection.
   * Only applicable to bi-directional transports like WebSocket, Pushpin WSOH, MQTT.
   */
  handleMessage?(raw: string | Buffer): Promise<void>;

  /**
   * Cleanly close the connection (if possible)
   */
  close?(): void;
}
