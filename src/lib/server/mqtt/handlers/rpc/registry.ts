import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import type { RpcHandlerArgs, RpcHandler, RegisteredRpcHandler } from '../types';

/********************************************************************************************
 * Registry state for mapping topic prefixes to RPC handlers.
 ********************************************************************************************/
const rpcHandlers = new Map<string, RegisteredRpcHandler>();

/********************************************************************************************
 * Generic RPC operation registry wiring for reuse across client types.
 ********************************************************************************************/
const rpcOperations = new Map<string, (params: Record<string, any>, args: RpcHandlerArgs) => Promise<any>>();

/********************************************************************************************
 * Extract sub-topic from full topic path.
 ********************************************************************************************/
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
 * Register an RPC operation that can be called by any client type.
 ********************************************************************************************/
export function registerRpcOperation(op: string, fn: (params: Record<string, any>, args: RpcHandlerArgs) => Promise<any>): void {
    logger.debug(`[MQTT RPC] Registering operation ${op}`);
    rpcOperations.set(op, fn);
}

/********************************************************************************************
 * Execute a registered RPC operation.
 ********************************************************************************************/
export async function executeRpcOperation(op: string, params: Record<string, any>, args: RpcHandlerArgs): Promise<any> {
    const fn = rpcOperations.get(op);
    if (!fn) {
        logger.error(`[MQTT RPC] Unknown operation ${op} with params ${JSON.stringify(params)}`);
        throw new Error(`Unknown RPC operation: ${op}`);
    }
    logger.debug(`[MQTT RPC] Executing operation ${op} with params ${JSON.stringify(params)}`);
    return await fn(params, args);
}

/********************************************************************************************
 * Register an RPC handler for a specific topic prefix.
 ********************************************************************************************/
export function registerRpcHandler<P extends PrismaClient>(
    prefix: string,
    handler: RpcHandler<P>,
    prisma: P
): void {
    rpcHandlers.set(prefix, { handler, prisma });
}

/********************************************************************************************
 * Create a generic RPC handler wrapper per client category (user/device).
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
 * Get RPC handler for a topic prefix.
 ********************************************************************************************/
export function getRpcHandler(prefix: string): RegisteredRpcHandler | undefined {
    return rpcHandlers.get(prefix);
}

/********************************************************************************************
 * Get all registered RPC handler prefixes (for iteration).
 ********************************************************************************************/
export function getAllRpcHandlerPrefixes(): string[] {
    return Array.from(rpcHandlers.keys());
}

/********************************************************************************************
 * Extract sub-topic from full topic path (exported for use in main dispatcher).
 ********************************************************************************************/
export { extractTopicSub };
