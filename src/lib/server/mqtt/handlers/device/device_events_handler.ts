/**
 * Handles `device/{deviceId}/events` — lightweight device telemetry.
 *
 * Supported payload types:
 * - `radar:usb_status` — radar USB link status; fanned out to portal users.
 *
 * Note: the same USB fan-out is also triggered from controller `/data`
 * (type `radar.usb.status`) in `streams/controller_data_handler.ts`.
 */

import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { fanOutRadarUsbStatusToUsers } from './radar_usb_fanout';

export async function handleDeviceEventsMessage(
    topic: string,
    payload: Buffer,
    prisma: PrismaClient
): Promise<void> {
    const m = /^device\/([^/]+)\/events$/.exec(topic);
    if (!m) return;

    const topicDeviceId = m[1];

    let data: Record<string, unknown>;
    try {
        data = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
    } catch {
        return;
    }

    if (data.type !== 'radar:usb_status') {
        return;
    }

    const deviceId = typeof data.deviceId === 'string' ? data.deviceId : topicDeviceId;
    if (deviceId !== topicDeviceId) {
        logger.warn('[DeviceEvents] radar:usb_status deviceId does not match topic', {
            topicDeviceId,
            payloadDeviceId: deviceId
        });
        return;
    }

    await fanOutRadarUsbStatusToUsers(prisma, {
        deviceId,
        controllerId: typeof data.controllerId === 'string' ? data.controllerId : undefined,
        sensorId: typeof data.sensorId === 'string' ? data.sensorId : undefined,
        usbConnected: Boolean(data.usbConnected),
        timestamp:
            typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString()
    });
}
