import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { getMqttTransport } from '../../core/transport';

/********************************************************************************************
 * Device Action Update Broadcaster (MQTT)
 * Broadcasts device action status updates to all users monitoring the device.
 ********************************************************************************************/
export async function broadcastDeviceActionUpdate(params: {
    prisma: PrismaClient;
    deviceId: string;
    logId: string;
    action: string;
    status: string;
    message: string;
    progress?: number;
    durationMs?: number | null;
    accountId?: string | null;
    objectPath?: string;
}): Promise<void> {
    const { prisma, deviceId, logId, action, status, message, progress, durationMs, accountId, objectPath } = params;
    const transport = getMqttTransport();

    const payload: any = {
        type: 'device:statusUpdate',
        deviceId,
        logId,
        action,
        status,
        message,
        timestamp: new Date().toISOString()
    };

    // Include progress if provided
    if (progress !== undefined && progress !== null) {
        payload.progress = progress;
    }

    // Include duration if provided
    if (durationMs !== undefined && durationMs !== null) {
        payload.durationMs = durationMs;
    }

    // Include objectPath for get_logs/pull_file so UI can trigger download without polling
    if (objectPath) {
        payload.objectPath = objectPath;
    }

    // Determine which users to notify based on device ownership
    const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { createdBy: true, accountId: true }
    });

    if (!device) {
        logger.warn(`[MQTT Action Update] Device ${deviceId} not found`);
        return;
    }

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

    if (!device.accountId && usersToNotify.length > 0) {
        logger.warn(`[MQTT Action Update] Device ${deviceId} has no accountId, cannot route notifications`);
        return;
    }

    logger.info(`[MQTT Action Update] Broadcasting action update`, {
        logId,
        action,
        status,
        progress,
        message: message?.substring(0, 100),
        deviceId,
        accountId: device.accountId,
        usersToNotify: usersToNotify.length,
        payloadKeys: Object.keys(payload)
    });

    for (const userId of usersToNotify) {
        try {
            const mqttUsername = `user:${userId}:${device.accountId}`;
            const topic = `user/${mqttUsername}/notifications`;
            await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
            logger.debug(`[MQTT Action Update] Published to ${topic}`, {
                logId,
                action,
                status,
                progress,
                userId,
                topic
            });
        } catch (err) {
            logger.error(`[MQTT Action Update] Failed to publish to user ${userId}:`, err);
        }
    }
}
