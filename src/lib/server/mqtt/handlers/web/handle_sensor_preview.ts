import type { RpcHandlerArgs, RpcResponse } from '$lib/server/mqtt/handlers/index';
import { logger } from '$lib/server/logger';
import { checkDeviceAccess } from './access_checker';
import { createPreviewSession, getPreviewSession, removePreviewSession, getActiveSessionsForUser } from '../../sessions/preview_sessions';
import crypto from 'crypto';

type SensorPreviewStartParams = {
    deviceId: string;
    controllerId: string;
    sensorId: string;
    duration: number; // in seconds
};

type SensorPreviewStopParams = {
    sessionId: string;
};

type SensorPreviewStartResult = {
    sessionId: string;
    status: string;
    expiresAt: string;
};

type SensorPreviewStopResult = {
    sessionId: string;
    status: string;
};

/**
 * Handle sensor.preview.start RPC
 */
export async function handleSensorPreviewStart(
    params: SensorPreviewStartParams,
    { prisma, sub, requestId }: RpcHandlerArgs
): Promise<RpcResponse<SensorPreviewStartResult>> {
    if (!sub) {
        throw new Error('Missing subject');
    }

    // 1. Validate Access
    // Extract account from subject if present (user:<userId>:<accountId>) 
    // or rely on checkDeviceAccess to check ownership if no accountId
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    // Parse userId and accountId from sub
    const parts = sub.split(':');
    const userId = parts[1];
    const accountId = parts[2];

    if (!userId || !accountId) {
        throw new Error('Invalid user subject format');
    }

    // 2. Validate Parameters
    if (!params.controllerId || !params.sensorId) {
        throw new Error('Missing controllerId or sensorId');
    }

    const duration = Math.min(Math.max(params.duration || 60, 10), 300); // 10s to 5m cap

    // 3. Rate Limiting (optional)
    const activeCount = getActiveSessionsForUser(userId);
    if (activeCount >= 2) {
        throw new Error('Too many active preview sessions. Please stop an existing session first.');
    }

    // 4. Generate Session & Flow IDs
    // flowId correlates the entire async flow (RPC -> Notification -> Data -> Completion)
    // The worker generates this.
    const flowId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + duration * 1000);

    // 5. Create In-Memory Session
    // We construct the user notification topic from sub
    const userTopic = `user/${userId}:${accountId}/notifications`;

    createPreviewSession({
        sessionId,
        flowId,
        userId,
        accountId,
        deviceId,
        controllerId: params.controllerId,
        sensorId: params.sensorId,
        startedAt: new Date(),
        expiresAt,
        userTopic
    });

    logger.info(`[SensorPreview] Starting preview session ${sessionId} (flowId: ${flowId}) for user ${sub} on device ${deviceId}`);

    // 6. Send Notification to Controller
    // Topic: device:<id>/controller/<type>:<cid>/notifications
    // The controllerId from params is typically "radar:<code>" or just "radar" if simple type
    // But we need the FULL routing ID. 
    // The minting logic uses `controller/<type>:<id>`.

    // Construct recipient topic part
    // We expect controllerId to be the full ID e.g. "radar:cmjf55..." or however it's registered
    // But wait, the topic structure is `device:<did>/controller/<type>:<cid>/...`
    // The `sendNotificationWithTicket` helper takes `recipient` and constructs the topic.
    // However, `sendNotificationWithTicket` currently assumes `device:<id>` or `user:<id>`.
    // We need to bypass the standard helper or update it to handle controller recipients?
    // Actually, `sendNotificationWithTicket` takes a `recipient` string and usually does `device/${recipient}/notifications`
    // if it starts with device:.

    // Let's see how `sendNotificationWithTicket` works.
    // If it's too rigid, we might need to manually publish ticket.
    // But let's assume we can construct the topic manually if needed.

    // For now, let's try to pass the full controller subject as recipient?
    // The controller subscribes to `device:<did>/controller/<type>:<cid>/notifications`.
    // The controller subscribes to: device:<did>/controller/<type>:<cid>/notifications
    // We need to match this exactly. The sendNotificationWithTicket helper produces wrong format,
    // so we publish directly with the correct topic.

    const { createTicket } = await import('../../core/publish');
    const { getMqttTransport } = await import('../../core/transport');

    // Build the correct topic: device:<did>/controller/radar:<cid>/notifications
    // Note: No extra "device/" prefix at start, and controllerId needs "radar:" prefix
    const notificationTopic = `device:${deviceId}/controller/radar:${params.controllerId}/notifications`;
    const recipient = `device:${deviceId}/controller/radar:${params.controllerId}`;

    const ticket = await createTicket(
        prisma,
        sub,
        recipient,
        'preview.start',
        flowId,
        { sensorId: params.sensorId, duration, sessionId },
        '5m'
    );

    logger.info(`[SensorPreview] Publishing to ${notificationTopic}`);
    const transport = getMqttTransport();
    await transport.publish(notificationTopic, JSON.stringify({ ticket }), { qos: 1 });

    // 7. Return Result to User
    return {
        flowId,
        result: {
            sessionId,
            status: 'started',
            expiresAt: expiresAt.toISOString()
        }
    };
}

/**
 * Handle sensor.preview.stop RPC
 */
export async function handleSensorPreviewStop(
    params: SensorPreviewStopParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<SensorPreviewStopResult>> {
    const session = getPreviewSession(params.sessionId);

    if (!session) {
        return { result: { sessionId: params.sessionId, status: 'not_found' } };
    }

    // Validate ownership
    // sub is user:<userId>:<accountId>
    const userId = sub?.split(':')[1];
    if (session.userId !== userId) {
        throw new Error('Unauthorized');
    }

    removePreviewSession(params.sessionId);

    // Notify controller to stop
    // We can fire-and-forget this
    const { createTicket } = await import('../../core/publish');
    const { getMqttTransport } = await import('../../core/transport');

    const ticket = await createTicket(
        prisma,
        sub!,
        `device:${session.deviceId}/controller/${session.controllerId}`,
        'preview.stop',
        session.flowId,
        { sessionId: params.sessionId },
        '1m'
    );

    const notificationTopic = `device:${session.deviceId}/controller/${session.controllerId}/notifications`;
    const transport = getMqttTransport();
    await transport.publish(notificationTopic, JSON.stringify({ ticket }), { qos: 1 });

    logger.info(`[SensorPreview] Stopped session ${params.sessionId}`);

    return {
        // We return the original flowId if available
        flowId: session.flowId,
        result: {
            sessionId: params.sessionId,
            status: 'stopped'
        }
    };
}
