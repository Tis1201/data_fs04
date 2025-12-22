import { logger } from '$lib/server/logger';
import type { PrismaClient, Device } from '@prisma/client';
import { decodeNotificationTicket, sendNotificationWithTicket, type NotificationTicketEnvelope } from '../core/publish';
import redis from '$lib/server/redis';
import { getMqttTransport } from '../core/transport';
import { getPreviewSession, isSessionExpired } from '../sessions/preview_sessions';

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
    handler: RpcHandler<PrismaClient>;
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
 * Device Status Notification Publisher (MQTT)
 ********************************************************************************************/
async function publishDeviceStatusNotification(params: {
    prisma: PrismaClient;
    device: Pick<Device, 'id' | 'name' | 'accountId' | 'createdBy'>;
    connected: boolean;
    timestamp: string;
    reason?: string;
}): Promise<void> {
    const { prisma, device, connected, timestamp, reason } = params;
    const transport = getMqttTransport();

    const notificationType = connected ? 'device:connection' : 'device:disconnection';
    const payload = {
        type: notificationType,
        deviceId: device.id,
        deviceName: device.name,
        connected,
        timestamp,
        reason,
        accountId: device.accountId,
        userId: device.createdBy
    };

    // Determine which users to notify based on device ownership
    const usersToNotify: string[] = [];

    // Notify device owner
    if (device.createdBy) {
        usersToNotify.push(device.createdBy);
    }

    // Notify account members if device belongs to an account
    if (device.accountId) {
        const accountMembers = await prisma.accountMembership.findMany({
            where: { accountId: device.accountId },
            select: { userId: true }
        });
        for (const member of accountMembers) {
            if (!usersToNotify.includes(member.userId)) {
                usersToNotify.push(member.userId);
            }
        }
    }

    // Publish notification once per user (not per connection)
    // The user's MQTT client will receive it on their subscribed topic
    // Use subscription-based routing that works with MQTT ACL
    for (const userId of usersToNotify) {
        try {
            const topic = `subscription:user:${userId}:${device.accountId}`;
            await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
            logger.debug(`[MQTT Device Status] Published ${notificationType} to ${topic}`);
        } catch (err) {
            logger.error(`[MQTT Device Status] Failed to publish to user ${userId}:`, err);
        }
    }

    logger.info(`[MQTT Device Status] Published ${notificationType} for device ${device.id} to ${usersToNotify.length} users`);
}

/********************************************************************************************
 * Central dispatcher for all MQTT messages consumed by the worker.
 ********************************************************************************************/
export async function handleIncoming(topic: string, payload: Buffer, prisma: PrismaClient): Promise<void> {
    // Only log non-data topics to reduce spam
    if (!topic.endsWith('/data')) {
        logger.debug(`[MQTT Messaging] Received message on ${topic}`);
    }

    if (
        topic === '$events/client/connected' ||
        topic === '$events/client/connected/' ||
        topic === '$events/client/disconnected' ||
        topic === '$events/client/disconnected/' ||
        topic === '$events/client_connected' ||
        topic === '$events/client_disconnected'
    ) {
        const rawEvent = payload.toString('utf8');
        let eventData: any = null;

        // EMQX may emit event payloads as Erlang-style maps, e.g.:
        // {
        // clientid: "device:..._suffix",
        // username: "device:...",
        // reason: "remote",
        // disconnected_at: "<epoch-ms>"
        // }
        // which is not valid JSON. Try JSON.parse first, then fall back to regex extraction.
        try {
            // eslint-disable-next-line no-console
            console.log('rawEvent', rawEvent);
            eventData = JSON.parse(rawEvent);
        } catch {
            // Swallow JSON errors; we'll try to extract fields from the raw string below.
        }

        let clientId = typeof eventData?.clientid === 'string' ? eventData.clientid : '';
        let username = typeof eventData?.username === 'string' ? eventData.username : '';
        let reason = typeof eventData?.reason === 'string' ? eventData.reason : '';
        let connectedAtMs: number | null = null;
        let disconnectedAtMs: number | null = null;
        let node: string | null =
            typeof eventData?.node === 'string' ? (eventData.node as string) : null;

        if (!clientId) {
            const clientIdMatch = rawEvent.match(/clientid:\s*"([^\"]+)"/);
            if (clientIdMatch) {
                clientId = clientIdMatch[1];
            }
        }

        if (!username) {
            const usernameMatch = rawEvent.match(/username:\s*"([^\"]+)"/);
            if (usernameMatch) {
                username = usernameMatch[1];
            }
        }

        if (!reason) {
            const reasonMatch = rawEvent.match(/reason:\s*"([^\"]+)"/);
            if (reasonMatch) {
                reason = reasonMatch[1];
            }
        }

        if (!node) {
            const nodeMatch = rawEvent.match(/node:\s*"([^\"]+)"/);
            if (nodeMatch) {
                node = nodeMatch[1];
            }
        }

        if (eventData?.connected_at != null) {
            connectedAtMs = Number(eventData.connected_at);
        } else {
            const connectedMatch = rawEvent.match(/connected_at:\s*"?(\d+)"?/);
            if (connectedMatch) {
                connectedAtMs = Number(connectedMatch[1]);
            }
        }

        if (eventData?.disconnected_at != null) {
            disconnectedAtMs = Number(eventData.disconnected_at);
        } else {
            const disconnectedMatch = rawEvent.match(/disconnected_at:\s*"?(\d+)"?/);
            if (disconnectedMatch) {
                disconnectedAtMs = Number(disconnectedMatch[1]);
            }
        }

        // Derive username from clientId if necessary: clientId is typically `${username}_${suffix}`.
        if (!username && clientId.startsWith('device:')) {
            username = clientId.split('_')[0];
        }
        if (!username && clientId.startsWith('user:')) {
            username = clientId.split('_')[0];
        }

        const kind = username.startsWith('device:')
            ? 'device'
            : username.startsWith('user:')
              ? 'user'
              : username.startsWith('factory:')
                ? 'factory'
              : 'other';
        // Only extract deviceId for claimed devices (not factory devices)
        const deviceId = kind === 'device' ? username.slice('device:'.length) : null;

        const now = new Date();
        const isConnectEvent =
            topic === '$events/client/connected' ||
            topic === '$events/client/connected/' ||
            topic === '$events/client_connected';
        const eventTimestampMs = isConnectEvent ? connectedAtMs ?? disconnectedAtMs : disconnectedAtMs ?? connectedAtMs;
        const eventDate =
            typeof eventTimestampMs === 'number' && !Number.isNaN(eventTimestampMs)
                ? new Date(eventTimestampMs)
                : now;

        // Update device presence in Redis for claimed devices (not factory devices)
        // Uses both individual keys (for fast lookups) and a Set (for fast listing)
        if (deviceId && redis) {
            const presenceKey = `presence:device:${deviceId}`;
            const presenceSetKey = 'presence:devices:online';
            const presenceTTL = parseInt(process.env.PRESENCE_TTL || '600', 10); // 10 minutes default (increased for stability)

            try {
                if (isConnectEvent) {
                    // Set device online with TTL and add to Set
                    // Use pipeline for atomic operations
                    const pipeline = redis.pipeline();
                    pipeline.setex(presenceKey, presenceTTL, '1');
                    pipeline.sadd(presenceSetKey, deviceId);
                    await pipeline.exec();
                    logger.debug(`[MQTT Presence] Device ${deviceId} marked online (TTL: ${presenceTTL}s)`);
                } else {
                    // Remove device presence on disconnect
                    const pipeline = redis.pipeline();
                    pipeline.del(presenceKey);
                    pipeline.srem(presenceSetKey, deviceId);
                    await pipeline.exec();
                    logger.debug(`[MQTT Presence] Device ${deviceId} marked offline`);
                }
            } catch (redisError) {
                logger.error(`[MQTT Presence] Failed to update presence for device ${deviceId}:`, {
                    error: redisError instanceof Error ? redisError.message : String(redisError)
                });
            }
        }

        // Single-row-per-clientId session style: track latest state per clientId
        if (isConnectEvent) {
            await prisma.mqttConnection.upsert({
                where: { clientId },
                create: {
                    clientId,
                    username,
                    kind,
                    status: 'CONNECTED',
                    connectedAt: eventDate,
                    disconnectedAt: null,
                    lastEventAt: eventDate,
                    node: node ?? undefined,
                    reason: null
                },
                update: {
                    username,
                    kind,
                    status: 'CONNECTED',
                    connectedAt: eventDate,
                    disconnectedAt: null,
                    lastEventAt: eventDate,
                    node: node ?? undefined,
                    reason: null
                }
            });
        } else {
            await prisma.mqttConnection.upsert({
                where: { clientId },
                create: {
                    clientId,
                    username,
                    kind,
                    status: 'DISCONNECTED',
                    connectedAt: eventDate,
                    disconnectedAt: eventDate,
                    lastEventAt: eventDate,
                    node: node ?? undefined,
                    reason: reason || null
                },
                update: {
                    username,
                    kind,
                    status: 'DISCONNECTED',
                    disconnectedAt: eventDate,
                    lastEventAt: eventDate,
                    node: node ?? undefined,
                    reason: reason || null
                }
            });
        }

        // Maintain high-level Device.connected flags for device clients only
        if (kind === 'device' && deviceId) {
            if (isConnectEvent) {
                await prisma.device.updateMany({
                    where: { id: deviceId },
                    data: { connected: true, connectedAt: eventDate }
                });
                logger.info('[MQTT Events] Device connected', { deviceId, username, clientId });

                // Publish MQTT notification for real-time UI updates
                const deviceRecord = await prisma.device.findUnique({
                    where: { id: deviceId },
                    select: { id: true, name: true, accountId: true, createdBy: true }
                });
                if (deviceRecord) {
                    await publishDeviceStatusNotification({
                        prisma,
                        device: deviceRecord,
                        connected: true,
                        timestamp: eventDate.toISOString()
                    });
                }

                // Auto-sync: Push pending configs for this device's sensors
                try {
                    // Use raw query to avoid type issues with syncStatus field
                    const pendingSensors = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
                        SELECT s.id, s.name 
                        FROM "Sensor" s
                        JOIN "Controller" c ON s."controllerId" = c.id
                        WHERE c."deviceId" = ${deviceId}
                        AND s."syncStatus" = 'PENDING'
                    `;

                    if (pendingSensors.length > 0) {
                        logger.info(`[MQTT Events] Auto-syncing ${pendingSensors.length} pending configs for device ${deviceId}`);

                        const { handleSensorConfigPush } = await import('./web/handle_sensor_config');

                        for (const sensor of pendingSensors) {
                            try {
                                // Create minimal RpcHandlerArgs for the handler
                                const args = {
                                    prisma,
                                    sub: `device:${deviceId}`,
                                    topic: '$system/auto-sync',
                                    requestId: `auto-sync-${sensor.id}`,
                                    op: 'sensor.config.push',
                                    params: { sensorId: sensor.id }
                                };
                                await handleSensorConfigPush({ sensorId: sensor.id }, args);
                                logger.info(`[MQTT Events] Auto-synced config for sensor ${sensor.name}`);
                            } catch (err) {
                                logger.warn(`[MQTT Events] Auto-sync failed for sensor ${sensor.name}:`, err);
                            }
                        }
                    }
                } catch (err) {
                    logger.warn('[MQTT Events] Failed to check for pending configs:', err);
                }
            } else {
                await prisma.device.updateMany({
                    where: { id: deviceId },
                    data: { connected: false, disconnectedAt: eventDate }
                });
                logger.info('[MQTT Events] Device disconnected', { deviceId, username, clientId, reason });

                // Publish MQTT notification for real-time UI updates
                const deviceRecord = await prisma.device.findUnique({
                    where: { id: deviceId },
                    select: { id: true, name: true, accountId: true, createdBy: true }
                });
                if (deviceRecord) {
                    await publishDeviceStatusNotification({
                        prisma,
                        device: deviceRecord,
                        connected: false,
                        timestamp: eventDate.toISOString(),
                        reason
                    });
                }
            }
        }

        return;
    }

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

            // Update action log if this is a device status or progress update
            const resultObj = result as Record<string, unknown>;
            const messageType = resultObj.type as string;
            const logId = resultObj.logId as string;
            const status = resultObj.status as string;
            const message = resultObj.message as string;
            const action = resultObj.action as string;

            logger.debug('[MQTT Reply] Processing reply result', {
                messageType,
                logId,
                status,
                action,
                hasResult: !!result,
                resultKeys: resultObj ? Object.keys(resultObj) : []
            });

            // Handle device:statusUpdate (matches old SSE flow)
            if (logId && messageType === 'device:statusUpdate') {
                try {
                    logger.debug('[MQTT Reply] Processing device:statusUpdate', {
                        logId,
                        action,
                        status,
                        message,
                        resultObj
                    });

                    const updateData: any = {
                        message: message || undefined
                    };

                    // Map status to action log status
                    if (status === 'in_progress') {
                        updateData.status = 'in_progress';
                    } else if (status === 'success') {
                        updateData.status = 'success';
                        updateData.completedAt = new Date();
                    } else if (status === 'failed') {
                        updateData.status = 'failed';
                        updateData.completedAt = new Date();
                    }

                    logger.debug('[MQTT Reply] Attempting to update action log', {
                        logId,
                        updateData
                    });

                    const updatedLog = await (prisma as any).deviceActionLog.update({
                        where: { id: logId },
                        data: updateData
                    });

                    logger.info('[MQTT Reply] Updated action log from device:statusUpdate', {
                        logId,
                        action,
                        status: updateData.status,
                        message,
                        updatedLogId: updatedLog.id
                    });

                    // If this is an applyProfile action, update the DeviceProfileAssignment status
                    if (action === 'applyProfile' && status && (status === 'success' || status === 'failed')) {
                        const profileId = resultObj.profileId as string | undefined;
                        const deviceId = resultObj.deviceId as string | undefined;

                        if (profileId && deviceId) {
                            try {
                                const assignmentStatus = status === 'success' ? 'APPLIED' : 'FAILED';
                                await (prisma as any).deviceProfileAssignment.updateMany({
                                    where: {
                                        deviceId,
                                        profileId
                                    },
                                    data: {
                                        status: assignmentStatus,
                                        lastSyncAt: new Date()
                                    }
                                });

                                logger.info('[MQTT Reply] Updated DeviceProfileAssignment status', {
                                    deviceId,
                                    profileId,
                                    status: assignmentStatus
                                });
                            } catch (assignErr) {
                                logger.error('[MQTT Reply] Failed to update DeviceProfileAssignment', {
                                    deviceId,
                                    profileId,
                                    status,
                                    error: assignErr instanceof Error ? assignErr.message : String(assignErr)
                                });
                            }
                        } else {
                            logger.warn('[MQTT Reply] applyProfile status update missing profileId or deviceId', {
                                profileId,
                                deviceId,
                                status
                            });
                        }
                    }
                } catch (dbErr) {
                    logger.error('[MQTT Reply] Failed to update action log', {
                        logId,
                        action,
                        status,
                        messageType,
                        resultObj,
                        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
                        stack: dbErr instanceof Error ? dbErr.stack : undefined
                    });
                }
            }

            // Handle device:progressUpdate (for progress percentage updates)
            if (logId && messageType === 'device:progressUpdate') {
                try {
                    const progress = resultObj.progress as number | undefined;
                    const updateData: any = {
                        message: message || undefined
                    };

                    if (progress !== undefined) {
                        updateData.progress = progress;
                    }

                    await (prisma as any).deviceActionLog.update({
                        where: { id: logId },
                        data: updateData
                    });

                    logger.info('[MQTT Reply] Updated action log from device:progressUpdate', {
                        logId,
                        action,
                        progress,
                        message
                    });
                } catch (dbErr) {
                    logger.error('[MQTT Reply] Failed to update action log progress', {
                        logId,
                        error: dbErr instanceof Error ? dbErr.message : String(dbErr)
                    });
                }
            }

            // Handle terminal output - forward immediately to user
            // Terminal messages: terminal:output, terminal:connected, terminal:error, terminal:disconnected
            if (ctx.type === 'device:terminal' ||
                (result && typeof result === 'object' && !Array.isArray(result))) {
                const resultObj = result as Record<string, unknown>;
                const payload = resultObj.payload as Record<string, unknown> | undefined;
                const payloadType = payload?.type as string | undefined;

                if (payloadType && (
                    payloadType === 'terminal:output' ||
                    payloadType === 'terminal:connected' ||
                    payloadType === 'terminal:error' ||
                    payloadType === 'terminal:disconnected'
                )) {
                    logger.debug('[MQTT Reply] Detected terminal output, forwarding to user', {
                        type: payloadType,
                        hasOutput: !!payload?.output
                    });

                    // Remove conflicting 'type' field from params to ensure client uses JWT 'type'
                    const cleanParams = { ...(result as Record<string, unknown>) };
                    if (typeof cleanParams.type === 'string' && cleanParams.type !== 'device:terminal') {
                        logger.debug('[MQTT Reply] Removed conflicting type field from terminal params', {
                            originalTypeInParams: cleanParams.type,
                            jwtType: 'device:terminal'
                        });
                        delete cleanParams.type;
                    }

                    // Forward terminal output immediately to user
                    await sendNotificationWithTicket({
                        prisma,
                        sub: ctx.recipient, // original user
                        recipient: ctx.sub,  // device
                        type: 'device:terminal',
                        flowId: ctx.flowId,
                        params: cleanParams,
                        expiresIn: '5m'
                    });

                    // Terminal output forwarded, no need to process further
                    return;
                }

                // Handle RDP messages from device (rdp:status, rdp:error, etc.)
                if (payloadType && (
                    payloadType === 'rdp:status' ||
                    payloadType === 'rdp:started' ||
                    payloadType === 'rdp:stopped' ||
                    payloadType === 'rdp:error'
                )) {
                    logger.debug('[MQTT Reply] Detected RDP message, forwarding to user', {
                        type: payloadType
                    });

                    // Remove conflicting 'type' field from params to ensure client uses JWT 'type'
                    const cleanParams = { ...(result as Record<string, unknown>) };
                    if (typeof cleanParams.type === 'string' && cleanParams.type !== 'device:rdp') {
                        logger.debug('[MQTT Reply] Removed conflicting type field from RDP params', {
                            originalTypeInParams: cleanParams.type,
                            jwtType: 'device:rdp'
                        });
                        delete cleanParams.type;
                    }

                    // Forward RDP message immediately to user
                    await sendNotificationWithTicket({
                        prisma,
                        sub: ctx.recipient, // original user
                        recipient: ctx.sub,  // device
                        type: 'device:rdp',
                        flowId: ctx.flowId,
                        params: cleanParams,
                        expiresIn: '5m'
                    });

                    // RDP message forwarded, no need to process further
                    return;
                }

                // Handle WebRTC messages from device (webrtc:offer, webrtc:ice-candidate, etc.)
                if (payloadType && (
                    payloadType === 'webrtc:offer' ||
                    payloadType === 'webrtc:answer' ||
                    payloadType === 'webrtc:ice-candidate' ||
                    payloadType === 'webrtc:connected' ||
                    payloadType === 'webrtc:error'
                )) {
                    logger.debug('[MQTT Reply] Detected WebRTC message, forwarding to user', {
                        type: payloadType
                    });

                    // Remove conflicting 'type' field from params to ensure client uses JWT 'type'
                    const cleanParams = { ...(result as Record<string, unknown>) };
                    if (typeof cleanParams.type === 'string' && cleanParams.type !== 'device:webrtc') {
                        logger.debug('[MQTT Reply] Removed conflicting type field from WebRTC params', {
                            originalTypeInParams: cleanParams.type,
                            jwtType: 'device:webrtc'
                        });
                        delete cleanParams.type;
                    }

                    // Forward WebRTC message immediately to user
                    await sendNotificationWithTicket({
                        prisma,
                        sub: ctx.recipient, // original user
                        recipient: ctx.sub,  // device
                        type: 'device:webrtc',
                        flowId: ctx.flowId,
                        params: cleanParams,
                        expiresIn: '5m'
                    });

                    // WebRTC message forwarded, no need to process further
                    return;
                }
            }

            // Extract payload fields for screenshot responses (device sends objectPath in payload)
            // Device sends: { type: "device", payload: { objectPath: "...", format: "..." } }
            // Generate download URL server-side so UI can use it directly
            let notificationParams = result as Record<string, unknown>;

            // Detect screenshot responses by checking payload.type === 'screenshot:response' or presence of objectPath in screenshots path
            let isScreenshotResponse = false;
            if (result && typeof result === 'object' && !Array.isArray(result)) {
                const resultObj = result as Record<string, unknown>;
                const payload = resultObj.payload as Record<string, unknown> | undefined;

                // Check if this is a screenshot response
                isScreenshotResponse = ctx.type === 'device.screenshot' ||
                    (!!payload && (
                        payload.type === 'screenshot:response' ||
                        (typeof payload.objectPath === 'string' && payload.objectPath.includes('/screenshots/'))
                    ));

                if (isScreenshotResponse) {
                    logger.debug('[MQTT Reply] Detected screenshot response', {
                        ctxType: ctx.type,
                        payloadType: payload?.type,
                        hasObjectPath: !!payload?.objectPath,
                        objectPath: payload?.objectPath
                    });

                    if (payload && payload.objectPath) {
                        // Generate download URL server-side so UI can use it directly as <img src={downloadUrl} />
                        // This is simpler than having UI request download URL separately
                        const { generateDownloadUrl } = await import('$lib/server/storage');
                        const path = await import('path');

                        try {
                            const fileName = path.basename(payload.objectPath as string);
                            const downloadUrlResult = await generateDownloadUrl(
                                payload.objectPath as string,
                                3600, // 1 hour expiry
                                fileName
                            );

                            notificationParams = {
                                ...resultObj,
                                objectPath: payload.objectPath,
                                downloadUrl: downloadUrlResult.url, // Add download URL for direct use
                                format: payload.format,
                                // Keep the full payload for backward compatibility
                                payload
                            };

                            logger.info('[MQTT Reply] Generated download URL for screenshot', {
                                objectPath: payload.objectPath,
                                format: payload.format,
                                hasDownloadUrl: true
                            });
                        } catch (err) {
                            logger.error('[MQTT Reply] Failed to generate download URL for screenshot', {
                                error: err instanceof Error ? err.message : String(err),
                                objectPath: payload.objectPath
                            });

                            // Fallback: just include objectPath
                            notificationParams = {
                                ...resultObj,
                                objectPath: payload.objectPath,
                                format: payload.format,
                                payload
                            };
                        }
                    } else {
                        logger.warn('[MQTT Reply] Screenshot response missing objectPath in payload', {
                            resultKeys: Object.keys(resultObj),
                            payloadKeys: payload ? Object.keys(payload) : []
                        });
                    }
                }
            }

            // Ensure type is preserved correctly (device.screenshot for screenshot responses)
            // For status/progress updates, use the actual message type instead of original request type
            // The device reply might have type: 'device' in its structure, but the ticket type should match the message type
            // Also check notificationParams for objectPath as a fallback (in case extraction already happened)
            let notificationType = ctx.type;
            const hasScreenshotObjectPath = (notificationParams && typeof notificationParams === 'object' &&
                typeof (notificationParams as Record<string, unknown>).objectPath === 'string' &&
                ((notificationParams as Record<string, unknown>).objectPath as string).includes('/screenshots/'));

            // For progress and status updates, change notification type to match the actual message
            // so the UI can listen for the correct notification type
            if (messageType === 'device:statusUpdate') {
                notificationType = 'device:statusUpdate';
                logger.debug('[MQTT Reply] Forwarding as device:statusUpdate', {
                    originalType: ctx.type,
                    action,
                    status
                });
            } else if (messageType === 'device:progressUpdate') {
                notificationType = 'device:progressUpdate';
                logger.debug('[MQTT Reply] Forwarding as device:progressUpdate', {
                    originalType: ctx.type,
                    action,
                    progress: resultObj.progress
                });
            } else if (isScreenshotResponse || hasScreenshotObjectPath) {
                // Force type to 'device.screenshot' for screenshot responses
                notificationType = 'device.screenshot';
                logger.info('[MQTT Reply] Setting screenshot notification type to device.screenshot', {
                    originalType: ctx.type,
                    finalType: notificationType,
                    flowId: ctx.flowId,
                    isScreenshotResponse,
                    hasScreenshotObjectPath,
                    objectPath: hasScreenshotObjectPath ? (notificationParams as Record<string, unknown>).objectPath : undefined
                });
            } else {
                logger.debug('[MQTT Reply] Using original notification type', {
                    ctxType: ctx.type,
                    messageType,
                    isScreenshotResponse,
                    hasScreenshotObjectPath,
                    resultType: result && typeof result === 'object' ? (result as Record<string, unknown>).type : undefined
                });
            }

            // Remove conflicting 'type' field from params to prevent client from reading wrong type
            // The client reads payload.params.type first, which would override the JWT's type claim
            const cleanParams = { ...notificationParams };
            const hadConflictingType = 'type' in cleanParams;
            delete cleanParams.type;

            if (hadConflictingType) {
                logger.debug('[MQTT Reply] Removed conflicting type field from params', {
                    removedType: notificationParams.type,
                    jwtType: notificationType
                });
            }

            logger.info('[MQTT Reply] Forwarding notification to user', {
                notificationType,
                recipient: ctx.sub,
                sub: ctx.recipient,
                flowId: ctx.flowId,
                hasParams: !!cleanParams,
                paramKeys: cleanParams ? Object.keys(cleanParams) : []
            });

            await sendNotificationWithTicket({
                prisma,
                sub: ctx.recipient,
                recipient: ctx.sub,
                type: notificationType,
                flowId: ctx.flowId,
                params: cleanParams,
                expiresIn: '5m'
            });

            logger.debug('[MQTT Reply] Notification forwarded successfully', {
                notificationType,
                recipient: ctx.sub
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

    // Handle controller data streams (sensor preview) - STATELESS TICKET-BASED ROUTING
    if (topic.endsWith('/data')) {
        const raw = payload.toString('utf8');
        try {
            const data = JSON.parse(raw);

            // NEW: Ticket-based stateless routing (preferred)
            // Controller echoes the ticket from preview.start with each data frame
            if (data.type === 'preview.frame' && data.ticket) {
                try {
                    // Verify ticket and extract routing claims
                    const claims = await decodeNotificationTicket(prisma, data.ticket);

                    // Forward to USER (not device) - the sub contains the user subject
                    // Topic format: user/{sub}/notifications
                    const userNotificationTopic = `user/${claims.sub}/notifications`;
                    const { getMqttTransport } = await import('../core/transport');
                    const transport = getMqttTransport();

                    const notification = {
                        type: 'preview.data',
                        flowId: claims.flowId,
                        params: {
                            sessionId: claims.params?.sessionId,
                            sensorId: claims.params?.sensorId,
                            timestamp: data.timestamp || Date.now(),
                            data: data.data || data
                        }
                    };

                    await transport.publish(userNotificationTopic, JSON.stringify(notification), { qos: 0 });
                    // Note: Removed per-frame logging to reduce console spam
                } catch (ticketErr) {
                    // Ticket verification failed (expired, invalid signature, etc.)
                    logger.debug('[Preview] Ticket verification failed, ignoring data frame', {
                        error: ticketErr instanceof Error ? ticketErr.message : String(ticketErr)
                    });
                }
                return;
            }

            // LEGACY: In-memory session-based routing (backwards compatibility)
            // TODO: Deprecate once all controllers use ticket-based routing
            if (data.type === 'preview.frame' && data.sessionId) {
                const session = getPreviewSession(data.sessionId);

                if (session && !isSessionExpired(data.sessionId)) {
                    await sendNotificationWithTicket({
                        prisma,
                        sub: `device:${session.deviceId}`,
                        recipient: `user:${session.userId}:${session.accountId}`,
                        type: 'preview.data',
                        flowId: session.flowId,
                        params: {
                            sessionId: session.sessionId,
                            sensorId: session.sensorId,
                            timestamp: data.timestamp || Date.now(),
                            data: data.data || data
                        },
                        expiresIn: '1m'
                    });
                }
            }
        } catch (err) {
            // Ignore malformed data messages to prevent log spam
        }
        return;
    }

    logger.debug('[MQTT Messaging] No RPC handler matched and no reply handler applicable', { topic });
}
