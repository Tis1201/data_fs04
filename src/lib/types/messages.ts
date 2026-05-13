import { z } from 'zod';

// Base message types

export interface BaseMessage {
    type: string;
    scope: string;
    payload: Record<string, unknown>;
    timestamp: string;
    requestId?: string; // Optional request ID for request-response tracking
    senderConnectionId?: string; // Connection ID of the sender for routing responses
    senderConnectionProtocol?: string; // Protocol used by the sender (sse, ws, etc.)
}

// Client message types (from client to server)
export interface ClientMessage extends BaseMessage {
}

export function createClientMessage(
    type: string,
    scope: string,
    payload: Record<string, unknown>,
    requestId?: string
): ClientMessage {
    return {
        type,
        scope,
        payload,
        timestamp: new Date().toISOString(),
        requestId
    };
}

