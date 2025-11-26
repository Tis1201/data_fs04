import type { NotificationTicketEnvelope } from '../core/envelope';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { decodeNotificationTicket, sendNotificationWithTicket } from '../core/publish';

/********************************************************************************************
 * Raw RPC handler types shared across device/web clients.
 ********************************************************************************************/
export type RpcHandlerArgs<P extends PrismaClient = PrismaClient> = {
    topic: string;
    requestId: string;
    op: string;
    params: Record<string, any>;
    prisma: P;
    sub: string | null;
};

export type RpcHandler<P extends PrismaClient = PrismaClient> = (args: RpcHandlerArgs<P>) => Promise<any>;

export type RpcResponse<T> = {
    status?: string;
    error?: string;
    flowId?: string;
    result: T;
};

/********************************************************************************************
 * Registry state for mapping topic prefixes to RPC handlers.
 ********************************************************************************************/
type RegisteredRpcHandler = {
    handler: RpcHandler;
    prisma: PrismaClient;
};

const rpcHandlers = new Map<string, RegisteredRpcHandler>();

function extractTopicSub(prefix: string, topic: string): string | null {
    if (!topic.startsWith(prefix)) {
        return null;
    }

    let remainder = topic.slice(prefix.length);
    if (remainder.startsWith('/')) {
        remainder = remainder.slice(1);
    }

    const [sub] = remainder.split('/');
    return sub || null;
}

/********************************************************************************************
 * Generic RPC operation registry wiring for reuse across client types.
 ********************************************************************************************/
const rpcOperations = new Map<string, (params: Record<string, any>, args: RpcHandlerArgs) => Promise<any>>();

export function registerRpcOperation(op: string, fn: (params: Record<string, any>, args: RpcHandlerArgs) => Promise<any>): void {
    logger.debug(`[MQTT RPC] Registering operation ${op}`);
    rpcOperations.set(op, fn);
}

export async function executeRpcOperation(op: string, params: Record<string, any>, args: RpcHandlerArgs): Promise<any> {
    const fn = rpcOperations.get(op);
    if (!fn) {
        logger.error(`[MQTT RPC] Unknown operation ${op} with params ${JSON.stringify(params)}`);
        throw new Error(`Unknown RPC operation: ${op}`);
    }
    logger.debug(`[MQTT RPC] Executing operation ${op} with params ${JSON.stringify(params)}`);
    return await fn(params, args);
}

export function registerRpcHandler<P extends PrismaClient>(
    prefix: string,
    handler: RpcHandler<P>,
    prisma: P
): void {
    rpcHandlers.set(prefix, { handler, prisma });
}

/********************************************************************************************
 * Generic RPC handler wrapper per client category (user/device).
 ********************************************************************************************/
export function createGenericRpcHandler(clientType: string): RpcHandler {
    return async ({ topic, requestId, op, params, prisma, sub }) => {
        logger.info(`[MQTT ${clientType} RPC] Received RPC request ${JSON.stringify({ topic, requestId, op })}`);
        return await executeRpcOperation(op, params, { topic, requestId, op, params, prisma, sub });
    };
}

/********************************************************************************************
 * Batch-register operations + handlers for a given MQTT client namespace.
 ********************************************************************************************/
export function registerRpcClient<P extends PrismaClient>(
    clientType: string,
    topicPrefix: string,
    operations: Record<string, (params: Record<string, any>, args: RpcHandlerArgs) => Promise<any>>,
    prisma: P
): void {
    // Register operations
    for (const [op, fn] of Object.entries(operations)) {
        registerRpcOperation(op, fn);
    }

    // Register generic handler for this client type
    registerRpcHandler(topicPrefix, createGenericRpcHandler(clientType), prisma);
}

/********************************************************************************************
 * Central dispatcher for all MQTT messages consumed by the worker.
 ********************************************************************************************/
export async function handleIncoming(topic: string, payload: Buffer, prisma: PrismaClient): Promise<void> {
    logger.debug(`[MQTT Messaging] Received message on ${topic}`);

    // First, try RPC handlers for raw JSON RPC requests
    const raw = payload.toString('utf8');
    let rpcData: any;
    try {
        rpcData = JSON.parse(raw);
    } catch {
        // Not JSON, continue to envelope handlers
    }

    if (rpcData?.requestId && rpcData?.op && typeof rpcData?.params === 'object') {
        logger.debug(
            `[MQTT Messaging] Detected raw RPC payload ${JSON.stringify({ topic, rpcData })}`
        );
        for (const [prefix, entry] of rpcHandlers) {
            if (topic.startsWith(prefix)) {
                logger.debug(`[MQTT Messaging] Handling raw RPC with prefix ${prefix}`);
                try {
                    const sub = extractTopicSub(prefix, topic);
                    const result = await entry.handler({
                        topic,
                        requestId: rpcData.requestId,
                        op: rpcData.op,
                        params: rpcData.params,
                        prisma,
                        sub
                    });
                    // Publish response if result is returned
                    if (result !== undefined) {
                        const { getMqttTransport } = await import('../core/transport');
                        const transport = getMqttTransport();
                        const responseTopic = topic.replace('/requests', '/response');
                        const response = {
                            requestId: rpcData.requestId,
                            op: rpcData.op,
                            result,
                            error: null
                        };
                        await transport.publish(responseTopic, JSON.stringify(response), { qos: 1 });
                        logger.info(`[MQTT Messaging] Published RPC response to ${responseTopic}`);
                    }
                } catch (err) {
                    const errorDetails = err instanceof Error ? err.stack ?? err.message : String(err);
                    logger.error(`[MQTT Messaging] RPC handler error: ${errorDetails}`);
                    // Publish error response
                    const { getMqttTransport } = await import('../core/transport');
                    const transport = getMqttTransport();
                    const responseTopic = topic.replace('/requests', '/response');
                    const response = {
                        requestId: rpcData.requestId,
                        op: rpcData.op,
                        result: null,
                        error: err instanceof Error ? err.message : String(err)
                    };
                    await transport.publish(responseTopic, JSON.stringify(response), { qos: 1 });
                }
                return;
            }
        }
        logger.warn(
            `[MQTT Messaging] No RPC handler matched for topic ${topic} and op ${rpcData.op}`
        );
    }

    // After raw RPC handling, process reply-style topics like device/<id>/replies
    // which carry a simple { ticket, result } envelope. This must be defensive:
    // malformed messages should be logged and ignored so the worker never crashes.
    if (topic.endsWith('/replies')) {
        const rawReply = payload.toString('utf8');

        try {
            const reply = JSON.parse(rawReply) as { ticket?: string; result?: unknown };
            const { ticket, result } = reply;

            if (!ticket) {
                logger.error('[MQTT Reply] Missing ticket in reply payload', { topic, rawReply });
                return;
            }

            const ctx: NotificationTicketEnvelope = await decodeNotificationTicket(prisma, ticket);

            if (!ctx.sub) {
                logger.error('[MQTT Reply] Missing sub in notification ticket', { topic });
                return;
            }

            if (!ctx.recipient) {
                logger.error('[MQTT Reply] Missing recipient in notification ticket', { topic });
                return;
            }

            if (!ctx.flowId) {
                logger.error('[MQTT Reply] Missing flowId in notification ticket', { topic });
                return;
            }

            if (!result || typeof result !== 'object' || Array.isArray(result)) {
                logger.error('[MQTT Reply] Reply result must be an object', { topic, rawReply });
                return;
            }

            await sendNotificationWithTicket({
                prisma,
                sub: ctx.recipient,
                recipient: ctx.sub,
                type: ctx.type,
                flowId: ctx.flowId,
                params: result as Record<string, unknown>,
                expiresIn: '5m'
            });
        } catch (err) {
            logger.error(
                `[MQTT Reply] Failed to process reply message: ${
                    err instanceof Error ? err.message : String(err)
                }`,
                { topic, rawReply }
            );
        }

        return;
    }

    logger.debug('[MQTT Messaging] No RPC handler matched and no reply handler applicable', { topic });
}
