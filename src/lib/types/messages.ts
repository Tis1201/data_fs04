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

// SSE message types and schemas
export interface SSEMessage {
    id: string;
    event: string;
    content?: string;
    data: any;
    timestamp: string;
    sender?: {
        email?: string;
        name?: string | null;
    };
}

// Schema for validating SSE messages - based on BaseMessage
export const SSEMessageSchema = z.object({
    type: z.string(),
    scope: z.string(),
    payload: z.record(z.string(), z.unknown()),
    timestamp: z.string().optional().default(() => new Date().toISOString())
});

export type SSEMessageInput = z.infer<typeof SSEMessageSchema>;

// Helper function to create an SSE message from BaseMessage
export function createSSEMessage(
    baseMessage: BaseMessage
): SSEMessage {
    return {
        id: crypto.randomUUID(),
        event: baseMessage.type,
        data: baseMessage.payload,
        timestamp: baseMessage.timestamp,
        content: typeof baseMessage.payload.content === 'string' ? baseMessage.payload.content : undefined
    };
}
