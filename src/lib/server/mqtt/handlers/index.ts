import { parseEnvelope } from '../core/envelope';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

export type HandlerArgs<P extends PrismaClient = PrismaClient> = {
    topic: string;
    envelope: ReturnType<typeof parseEnvelope>;
    prisma: P;
};

export type MessageHandler<P extends PrismaClient = PrismaClient> = (args: HandlerArgs<P>) => Promise<void>;

type RegisteredHandler = {
    handler: MessageHandler;
    prisma: PrismaClient;
};

const handlers = new Map<string, RegisteredHandler>();

export function registerHandler<P extends PrismaClient>(
    prefix: string,
    handler: MessageHandler<P>,
    prisma: P
): void {
    handlers.set(prefix, { handler, prisma });
}

export async function handleIncoming(topic: string, payload: Buffer, prisma: PrismaClient): Promise<void> {
    let envelope;

    logger.debug(`[MQTT Messaging] Received message on ${topic}`);

    // Find matching handler
    let matchedEntry: RegisteredHandler | undefined;
    for (const [prefix, entry] of handlers) {
        logger.debug(`[MQTT Messaging] Checking handler for prefix ${prefix}`);
        if (topic.startsWith(prefix)) {
            matchedEntry = entry;
            break;
        }
    }

    if (!matchedEntry) {
        logger.warn('[MQTT Messaging] No handler registered for topic', { topic });
        return;
    }

    try {
        envelope = parseEnvelope(JSON.parse(payload.toString('utf8')));
    } catch (error) {
        logger.error('[MQTT Messaging] Failed to parse envelope', {
            topic,
            error: error instanceof Error ? error.message : String(error)
        });
        return;
    }

    await matchedEntry.handler({
        topic,
        envelope,
        prisma: matchedEntry.prisma
    });
}
