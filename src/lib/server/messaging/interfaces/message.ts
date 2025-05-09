import type { UserInfo } from "$lib/server/types/user";
import type { ConnectionProtocol } from "./connection";
import { v4 as uuidv4 } from 'uuid';

/**
 * Base message interface shared by both incoming and outgoing messages
 */
export interface BaseMessage {
  type: string;
  scope: string;  // Consider renaming to 'target' or 'recipient'
  payload: Record<string, unknown>;  // More type-safe than 'any'
}

/**
 * Message received from the client
 */
export interface InMessage extends BaseMessage {
  userInfo: UserInfo;
  protocol: ConnectionProtocol;
  connectionId: string;  // Make this required if it's always needed
  [key: string]: unknown;  // More type-safe than 'any'
}

export interface RoutingMessage extends InMessage {
  id: string;
  systemGenerated?: boolean;
  echoToSender?: boolean;
  senderId?: string;
  senderConnectionId?: string;
  senderConnectionProtocol?: ConnectionProtocol;
}
  
/**
 * Message sent to the client
 */
export interface OutMessage extends BaseMessage {
  // No additional fields needed
  id: string;
  senderId?: string;
  senderConnectionId?: string;
  senderConnectionProtocol?: ConnectionProtocol;
}

/**
 * Common message types
 */
export interface MessageTypes {
  MESSAGE: 'message';
  EVENT: 'event';
  // Add other message types as needed
}

export const MessageFactory = {
  toRoutingMessage(
    inMessage: InMessage,
    overrides?: Partial<RoutingMessage>
  ): RoutingMessage {
    return {
      ...inMessage,
      id: uuidv4(),
      systemGenerated: false,
      ...overrides
    };
  },
  toOutMessage(
    routingMessage: RoutingMessage,
    overrides?: Partial<OutMessage>
  ): OutMessage {
    return {
      id: routingMessage.id,
      type: routingMessage.type,
      scope: routingMessage.scope,
      payload: routingMessage.payload,
      // Use explicit sender properties if available, otherwise fall back to default values
      senderId: routingMessage.senderId || routingMessage.userInfo?.id,
      senderConnectionId: routingMessage.senderConnectionId || routingMessage.connectionId,
      senderConnectionProtocol: routingMessage.senderConnectionProtocol || routingMessage.protocol,
      ...overrides
    };
  },
  
  // Create a system-generated routing message with common defaults
  createSystemMessage(
    type: string,
    scope: string,
    payload: Record<string, unknown>,
    userInfo: UserInfo,
    options?: {
      targetConnectionId?: string;
      targetProtocol?: ConnectionProtocol;
      senderConnectionId?: string;
      senderConnectionProtocol?: ConnectionProtocol;
      echoToSender?: boolean;
    }
  ): RoutingMessage {
    return {
      id: uuidv4(),
      type,
      scope,
      protocol: options?.targetProtocol || 'sse',
      connectionId: options?.targetConnectionId || '',
      userInfo,
      payload,
      systemGenerated: true,
      echoToSender: options?.echoToSender ?? false,
      senderId: userInfo.id,
      senderConnectionId: options?.senderConnectionId || '',
      senderConnectionProtocol: options?.senderConnectionProtocol || 'websocket'
    };
  },
  
  // Specialized helper for device-related messages
  createDeviceMessage(
    action: string,
    deviceId: string,
    targetConnectionId: string,
    userInfo: UserInfo,
    senderConnectionId: string,
    senderConnectionProtocol: ConnectionProtocol,
    additionalPayload?: Record<string, unknown>
  ): RoutingMessage {
    return this.createSystemMessage(
      'device',
      `connection:${targetConnectionId}`,
      {
        id: deviceId,
        action,
        userId: userInfo.id,
        claimedAt: new Date().toISOString(),
        ...additionalPayload
      },
      userInfo,
      {
        targetConnectionId,
        targetProtocol: 'sse',
        senderConnectionId,
        senderConnectionProtocol,
        echoToSender: false
      }
    );
  }
};
