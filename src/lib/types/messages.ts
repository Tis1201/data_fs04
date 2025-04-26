import { z } from 'zod';

// Base message types

export interface BaseMessage {
    type: string;
    scope: string;
    payload: Record<string, unknown>;
    timestamp: string;
}

// Client message types (from client to server)
export interface ClientMessage extends BaseMessage {
}

export function createClientMessage(
    type: string,
    scope: string,
    payload: Record<string, unknown>
): ClientMessage {
    return {
        type,
        scope,
        payload,
        timestamp: new Date().toISOString()
    };
}

