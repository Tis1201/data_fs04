import { logger } from '$lib/server/logger';
import type { PrismaClient, Device } from '@prisma/client';
import { getMqttTransport } from '../../core/transport';

/********************************************************************************************
 * Device Status Notification Publisher (MQTT)
 * Publishes device connection/disconnection notifications to users.
 ********************************************************************************************/
export async function publishDeviceStatusNotification(params: {
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
    if (!device.accountId && usersToNotify.length > 0) {
        logger.warn(`[MQTT Device Status] Device ${device.id} has no accountId, cannot route notifications to users`);
        return;
    }
    
    for (const userId of usersToNotify) {
        try {
            // Construct MQTT username format: user:${userId}:${accountId}
            const mqttUsername = `user:${userId}:${device.accountId}`;
            const topic = `user/${mqttUsername}/notifications`;
            await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
            logger.debug(`[MQTT Device Status] Published ${notificationType} to ${topic}`);
        } catch (err) {
            logger.error(`[MQTT Device Status] Failed to publish to user ${userId}:`, err);
        }
    }

    logger.info(`[MQTT Device Status] Published ${notificationType} for device ${device.id} to ${usersToNotify.length} users`);
}
