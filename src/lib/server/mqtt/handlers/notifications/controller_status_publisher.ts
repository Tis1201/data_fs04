import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { getMqttTransport } from '../../core/transport';

/**
 * Publishes `controller:connection` / `controller:disconnection` on each user's
 * `user/.../notifications` topic. Complements {@link publishDeviceStatusNotification}
 * (RDM agent vs controller bridge are separate sessions).
 */

export type ControllerStatusInput = {
    prisma: PrismaClient;
    deviceId: string;
    controllerId: string;
    /** Shown in the payload; callers often pass the DB `Controller.type` (e.g. `radar`). */
    controllerType: string;
    connected: boolean;
    timestamp: string;
    reason?: string;
};

export async function publishControllerStatusNotification(
    params: ControllerStatusInput
): Promise<void> {
    const { prisma, deviceId, controllerId, controllerType, connected, timestamp, reason } = params;
    const transport = getMqttTransport();

    const controller = await prisma.controller.findUnique({
        where: { id: controllerId },
        select: {
            id: true,
            name: true,
            type: true,
            accountId: true,
            createdBy: true,
            device: { select: { id: true, accountId: true, createdBy: true, name: true } }
        }
    });

    if (!controller) {
        logger.warn(
            `[MQTT Controller Status] Controller ${controllerId} not found; skipping notification`
        );
        return;
    }

    const accountId = controller.accountId ?? controller.device?.accountId ?? null;
    if (!accountId) {
        logger.warn(
            `[MQTT Controller Status] Controller ${controllerId} has no accountId, cannot route notifications`
        );
        return;
    }

    const notificationType = connected ? 'controller:connection' : 'controller:disconnection';
    const payload = {
        type: notificationType,
        deviceId,
        deviceName: controller.device?.name,
        controllerId,
        controllerName: controller.name,
        controllerType,
        connected,
        timestamp,
        reason,
        accountId
    };

    const usersToNotify = new Set<string>();
    if (controller.createdBy) usersToNotify.add(controller.createdBy);
    if (controller.device?.createdBy) usersToNotify.add(controller.device.createdBy);

    const accountMembers = await prisma.accountMembership.findMany({
        where: { accountId },
        select: { userId: true }
    });
    for (const member of accountMembers) {
        usersToNotify.add(member.userId);
    }

    for (const userId of usersToNotify) {
        try {
            const mqttUsername = `user:${userId}:${accountId}`;
            const topic = `user/${mqttUsername}/notifications`;
            await transport.publish(topic, JSON.stringify(payload), { qos: 1 });
            logger.debug(`[MQTT Controller Status] Published ${notificationType} to ${topic}`);
        } catch (err) {
            logger.error(
                `[MQTT Controller Status] Failed to publish to user ${userId}:`,
                err
            );
        }
    }

    logger.info(
        `[MQTT Controller Status] Published ${notificationType} for controller ${controllerId} (device=${deviceId}, type=${controllerType}) to ${usersToNotify.size} users`
    );
}
