/**
 * Radar USB link status — shared fan-out utility.
 *
 * Publishes `radar:usb_status` notifications to every user in the device's account
 * so the portal can show real-time USB connection state.
 *
 * Ingress points that call this:
 * - `device/{id}/events`  (type `radar:usb_status`)  → device_events_handler.ts
 * - `device:…/controller/radar:…/data` (type `radar.usb.status`) → streams/controller_data_handler.ts
 */

import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { getMqttTransport } from '../../core/transport';

export type RadarUsbFanoutPayload = {
    deviceId: string;
    controllerId?: string;
    sensorId?: string;
    usbConnected: boolean;
    timestamp: string;
};

export async function fanOutRadarUsbStatusToUsers(
    prisma: PrismaClient,
    payload: RadarUsbFanoutPayload
): Promise<void> {
    const { deviceId, controllerId, sensorId, usbConnected, timestamp } = payload;

    const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { id: true, name: true, accountId: true, createdBy: true }
    });

    if (!device?.accountId) {
        logger.debug('[RadarUsb] Fan-out skipped — device missing or no accountId', { deviceId });
        return;
    }

    const usersToNotify = new Set<string>();
    if (device.createdBy) {
        usersToNotify.add(device.createdBy);
    }
    const members = await prisma.accountMembership.findMany({
        where: { accountId: device.accountId },
        select: { userId: true }
    });
    for (const row of members) {
        usersToNotify.add(row.userId);
    }

    const out = {
        type: 'radar:usb_status',
        deviceId,
        sensorId,
        controllerId,
        usbConnected,
        timestamp
    };

    const transport = getMqttTransport();
    for (const userId of usersToNotify) {
        const mqttUsername = `user:${userId}:${device.accountId}`;
        const t = `user/${mqttUsername}/notifications`;
        try {
            await transport.publish(t, JSON.stringify(out), { qos: 1 });
        } catch (err) {
            logger.error(`[RadarUsb] Failed publish to ${t}`, err);
        }
    }

    logger.debug('[RadarUsb] Fanned out radar:usb_status', {
        deviceId,
        users: usersToNotify.size,
        usbConnected
    });
}
