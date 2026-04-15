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
 * - Controller `/data` → streams/controller_data_handler.ts (USB telemetry + preview frames)
 * - Device events → device/device_events_handler.ts
 * - Device heartbeats → device/heartbeat_handler.ts
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
 * Routing Logic:
 * 1. Connection Events (`$events/client/*`) → Connection handler
 * 2. RPC Requests (messages with `requestId`, `op`, `params`) → RPC registry
 * 3. Device Replies (`…/replies`) → Reply router
 * 4. Controller Data (`…/data`) → Controller data handler (USB telemetry + preview frames)
 * 5. Device Events (`device/{id}/events`) → Device events handler
 * 6. Device Heartbeats (`device/{id}/heartbeat`) → Heartbeat handler
 * 7. Unmatched → Logged and ignored
 */
export async function handleIncoming(topic: string, payload: Buffer, prisma: PrismaClient): Promise<void> {
    // Only log non-data, non-heartbeat topics to reduce spam (high-frequency)
    if (!topic.endsWith('/data') && !topic.endsWith('/heartbeat')) {
        logger.debug(`[MQTT Messaging] Received message on ${topic}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 1: Connection/Disconnection Events
    // ─────────────────────────────────────────────────────────────────────────────────────
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
        
        const { getRpcHandler, extractTopicSub, getAllRpcHandlerPrefixes } = await import('./rpc/registry');
        
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
    if (topic.endsWith('/replies')) {
        const { handleReplyMessage } = await import('./replies/reply_router');
        await handleReplyMessage(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 4: Controller `/data` streams (radar USB telemetry + preview frames)
    // ─────────────────────────────────────────────────────────────────────────────────────
    if (topic.endsWith('/data')) {
        const { handleControllerDataMessage } = await import('./streams/controller_data_handler');
        await handleControllerDataMessage(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 5: Device events (telemetry, e.g. radar USB status)
    // ─────────────────────────────────────────────────────────────────────────────────────
    if (/^device\/[^/]+\/events$/.test(topic)) {
        const { handleDeviceEventsMessage } = await import('./device/device_events_handler');
        await handleDeviceEventsMessage(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // ROUTE 6: Device Heartbeats (Last ping / presence)
    // ─────────────────────────────────────────────────────────────────────────────────────
    if (topic.endsWith('/heartbeat') && topic.startsWith('device/')) {
        const { handleHeartbeatMessage } = await import('./device/heartbeat_handler');
        await handleHeartbeatMessage(topic, payload, prisma);
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // FALLBACK: Unmatched Topics
    // ─────────────────────────────────────────────────────────────────────────────────────
    logger.debug('[MQTT Messaging] No handler matched for topic', { topic });
}
