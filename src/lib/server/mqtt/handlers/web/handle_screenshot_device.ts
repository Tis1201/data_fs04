import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { sendDeviceNotificationWithTicket } from '../../core/publish';
import type { RpcHandlerArgs } from '../index';

interface ScreenshotDeviceParams {
    deviceId?: string;
    requestId?: string;
}

/**
 * Web-side screenshot handler.
 *
 * Called via MQTT RPC with op: 'device.screenshot' on a topic like:
 *   user:{userId}:{accountId}/requests
 *
 * It validates the requesting user and device relationship, then forwards a
 * screenshot action into the existing device action pipeline using the
 * `device:actionRequest` SSE message type.
 */
export async function handleScreenshotDevice(
    params: ScreenshotDeviceParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<{ deviceId: string; requestId: string }> {
    const deviceId = params.deviceId?.trim();

    if (!deviceId) {
        throw new Error('deviceId is required');
    }

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    const [subjectType, userId, accountId] = sub.split(':');
    if (subjectType !== 'user' || !userId) {
        throw new Error('Invalid subject for web client');
    }

    logger.info(`[WebScreenshot] User ${sub} requesting screenshot for device ${deviceId}`);

    // Verify device exists and user has access (creator or account member).
    const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: {
            id: true,
            createdBy: true,
            accountId: true,
            account: {
                select: {
                    members: {
                        select: { userId: true }
                    }
                }
            }
        }
    });

    if (!device) {
        throw new Error('Device not found');
    }

    const isOwner = device.createdBy === userId;
    const isAccountMember = !!device.accountId && !!accountId &&
        device.account?.members?.some((m) => m.userId === userId);

    if (!isOwner && !isAccountMember) {
        throw new Error('Access denied to this device');
    }

    const requestId = params.requestId?.trim() ?? '';

    await sendDeviceNotificationWithTicket({
        prisma,
        deviceId,
        sub,
        type: 'device.screenshot',
        requestId,
        payload: {
            type: 'device.screenshot',
            deviceId,
            requestId
        }
    });

    logger.info(
        `[WebScreenshot] Dispatched screenshot action for device ${deviceId} with requestId ${requestId}`
    );

    return { deviceId, requestId };
}
