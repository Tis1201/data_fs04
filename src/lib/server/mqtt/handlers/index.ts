/**
 * MQTT Message Handler - Main Dispatcher
 * 
 * This module serves as the central entry point for all MQTT messages consumed by the worker.
 * It routes incoming messages to specialized handlers based on topic patterns and message types.
 * 
 * Architecture:
 * - Connection events → events/connection_handler.ts
 * - RPC requests → rpc/registry.ts (dynamically routed)
 * - Device replies → replies/reply_router.ts
 * - Data streams → streams/preview_data_handler.ts
 * 
 * @module mqtt/handlers
 */

import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { handleConnectionEvent } from './events/connection_handler';

// ===========================================================================================
// PUBLIC API - Re-exports for backward compatibility
// ===========================================================================================

/**
 * Re-export RPC-related types for backward compatibility
 * @see ./types.ts for type definitions
 */
export type { RpcHandlerArgs, RpcHandler, RpcResponse, RegisteredRpcHandler } from './types';

/**
 * Re-export RPC registry functions for backward compatibility
 * @see ./rpc/registry.ts for implementation details
 */
export {
    registerRpcOperation,
    executeRpcOperation,
    registerRpcHandler,
    createGenericRpcHandler,
    registerRpcClient,
    getRpcHandler,
    getAllRpcHandlerPrefixes,
    extractTopicSub
} from './rpc/registry';

// Import notification functions for use in this file
import { broadcastDeviceActionUpdate } from './notifications/device_action_broadcaster';
import { publishDeviceStatusNotification } from './notifications/device_status_publisher';

/**
 * Re-export notification broadcasting functions for backward compatibility
 * @see ./notifications/ for implementation details
 */
export { broadcastDeviceActionUpdate, publishDeviceStatusNotification };

// ===========================================================================================
// MAIN DISPATCHER
// ===========================================================================================

/**
 * Central dispatcher for all incoming MQTT messages
 * 
 * This function acts as the main router for all MQTT messages consumed by the worker.
 * It analyzes the topic pattern and message structure to route messages to appropriate handlers:
 * 
 * Routing Logic:
 * 1. Connection Events (`$events/client/*`) → Connection handler
 * 2. RPC Requests (messages with `requestId`, `op`, `params`) → RPC registry
 * 3. Device Replies (`device/<id>/replies`) → Reply router
 * 4. Data Streams (`*​/data`) → Preview data handler
 * 5. Unmatched → Logged and ignored
 * 
 * The dispatcher is designed to be defensive:
 * - Malformed messages are logged but don't crash the worker
 * - Each handler is responsible for its own error handling
 * - All routing is done via dynamic imports to enable lazy loading
 * 
 * @param topic - The MQTT topic on which the message was received
 * @param payload - The raw message payload as a Buffer
 * @param prisma - The Prisma client instance for database operations
 * 
 * @throws Never throws - all errors are caught and logged within handlers
 * 
 * @example
 * // Called by MQTT worker for each incoming message
 * await handleIncoming('device/abc123/replies', messageBuffer, prisma);
 */
export async function handleIncoming(topic: string, payload: Buffer, prisma: PrismaClient): Promise<void> {
    // Only log non-data, non-heartbeat topics to reduce spam (high-frequency)
    if (!topic.endsWith('/data') && !topic.endsWith('/heartbeat')) {
        logger.debug(`[MQTT Messaging] Received message on ${topic}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 1: Connection/Disconnection Events
    // ─────────────────────────────────────────────────────────────────────────────────────
    // System-level topics that notify when devices connect/disconnect from MQTT broker
    if (
        topic === '$events/client/connected' ||
        topic === '$events/client/connected/' ||
        topic === '$events/client/disconnected' ||
        topic === '$events/client/disconnected/' ||
        topic === '$events/client_connected' ||
        topic === '$events/client_disconnected'
    ) {
        await handleConnectionEvent(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 2: RPC (Remote Procedure Call) Requests
    // ─────────────────────────────────────────────────────────────────────────────────────
    // Messages with { requestId, op, params } structure are treated as RPC calls
    const raw = payload.toString('utf8');
    let rpcData: any;
    try {
        rpcData = JSON.parse(raw);
    } catch {
        // Not JSON, continue to other routing checks
    }

    if (rpcData?.requestId && rpcData?.op && typeof rpcData?.params === 'object') {
        logger.debug(
            `[MQTT Messaging] Detected raw RPC payload ${JSON.stringify({ topic, rpcData })}`
        );
        
        // Import RPC registry functions
        const { getRpcHandler, extractTopicSub, getAllRpcHandlerPrefixes } = await import('./rpc/registry');
        
        // Find matching RPC handler by iterating through all registered prefixes
        const prefixes = getAllRpcHandlerPrefixes();
        for (const prefix of prefixes) {
            if (topic.startsWith(prefix)) {
                const entry = getRpcHandler(prefix);
                if (entry) {
                logger.debug(`[MQTT Messaging] Handling raw RPC with prefix ${prefix}`);
                try {
                    const startTime = Date.now();
                    logger.info(`[MQTT Messaging] Starting RPC operation: op=${rpcData.op}, requestId=${rpcData.requestId}, timestamp=${new Date().toISOString()}`);
                    const sub = extractTopicSub(prefix, topic);
                    const result = await entry.handler({
                        topic,
                        requestId: rpcData.requestId,
                        op: rpcData.op,
                        params: rpcData.params,
                        prisma,
                        sub
                    });
                    const operationDuration = Date.now() - startTime;
                    logger.info(`[MQTT Messaging] RPC operation completed: op=${rpcData.op}, requestId=${rpcData.requestId}, duration=${operationDuration}ms`);
                    // Publish response if result is returned
                    if (result !== undefined) {
                        const publishStartTime = Date.now();
                        const { getMqttTransport } = await import('../core/transport');
                        const transport = getMqttTransport();
                        const responseTopic = topic.replace('/requests', '/response');
                        const response = {
                            requestId: rpcData.requestId,
                            op: rpcData.op,
                            result,
                            error: null
                        };
                        const responsePayload = JSON.stringify(response);
                        logger.debug(`[MQTT Messaging] Publishing RPC response to ${responseTopic}: requestId=${rpcData.requestId}, op=${rpcData.op}, payloadLength=${responsePayload.length}, timestamp=${new Date().toISOString()}`);
                        await transport.publish(responseTopic, responsePayload, { qos: 1 });
                        const publishDuration = Date.now() - publishStartTime;
                        logger.info(`[MQTT Messaging] Published RPC response to ${responseTopic} (requestId=${rpcData.requestId}, op=${rpcData.op}, publishDuration=${publishDuration}ms, totalDuration=${Date.now() - startTime}ms)`);
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
        }
        logger.warn(
            `[MQTT Messaging] No RPC handler matched for topic ${topic} and op ${rpcData.op}`
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 3: Device Reply Messages
    // ─────────────────────────────────────────────────────────────────────────────────────
    // Topics ending in `/replies` contain device responses to commands
    // Format: { ticket, result } where ticket is used for routing back to the requester
    if (topic.endsWith('/replies')) {
        const { handleReplyMessage } = await import('./replies/reply_router');
        await handleReplyMessage(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 4: Data Streams (Sensor Preview)
    // ─────────────────────────────────────────────────────────────────────────────────────
    // High-frequency data streams from devices (e.g., camera preview frames)
    // These use ticket-based stateless routing or legacy session-based routing
    if (topic.endsWith('/data')) {
        const { handlePreviewDataMessage } = await import('./streams/preview_data_handler');
        await handlePreviewDataMessage(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 5: Device Heartbeats (Last ping / presence)
    // ─────────────────────────────────────────────────────────────────────────────────────
    // device/{deviceId}/heartbeat - batched for Redis + ClickHouse
    if (topic.endsWith('/heartbeat') && topic.startsWith('device/')) {
        const { handleHeartbeatMessage } = await import('./device/heartbeat_handler');
        await handleHeartbeatMessage(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // FALLBACK: Unmatched Topics
    // ─────────────────────────────────────────────────────────────────────────────────────
    // If we reach here, the topic didn't match any known pattern
    logger.debug('[MQTT Messaging] No handler matched for topic', { topic });
}
