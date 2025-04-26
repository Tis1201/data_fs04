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
  id: string;              // Unique connection ID
  userInfo: UserInfo;          // Owner of the connection
  nodeId: string;          // Node or instance managing it
  protocol: ConnectionProtocol;
  scope?: string;          // Optional: primary scope (room/user/device)
  connectedAt: number;     // Unix timestamp
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
