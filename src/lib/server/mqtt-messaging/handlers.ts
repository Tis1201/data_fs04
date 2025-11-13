import { parseEnvelope } from './envelope';
import { logger } from '$lib/server/logger';

export type MessageHandler = (topic: string, envelope: ReturnType<typeof parseEnvelope>) => Promise<void>;

const handlers = new Map<string, MessageHandler>();

export function registerHandler(prefix: string, handler: MessageHandler): void {
    handlers.set(prefix, handler);
}

export async function handleIncoming(topic: string, payload: Buffer): Promise<void> {
    let envelope;
    try {
        envelope = parseEnvelope(JSON.parse(payload.toString('utf8')));
    } catch (error) {
        logger.error('[MQTT Messaging] Failed to parse envelope', {
            topic,
            error: error instanceof Error ? error.message : String(error)
        });
        return;
    }

    for (const [prefix, handler] of handlers) {
        if (topic.startsWith(prefix)) {
            await handler(topic, envelope);
            return;
        }
    }

    logger.warn('[MQTT Messaging] No handler registered for topic', { topic });
}
