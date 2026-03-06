import { logger } from '$lib/server/logger';
import { sendNotificationWithTicket } from '../../core/publish';
import { v4 as uuidv4 } from 'uuid';
import type { RpcHandlerArgs } from '../types';

export async function handleDataReady(
    params: Record<string, any>,
    args: RpcHandlerArgs
): Promise<{ status: string }> {
    const { prisma } = args;
    const deviceId = params.deviceId as string;

    if (!deviceId) {
        logger.warn('[device.dataReady] Missing deviceId in params');
        return { status: 'error' };
    }

    logger.info(`[device.dataReady] Device ${deviceId} reported data uploaded`);

    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { id: true, createdBy: true, accountId: true }
        });

        if (!device?.createdBy) {
            logger.warn(`[device.dataReady] Device ${deviceId} has no owner, skipping notification`);
            return { status: 'ok' };
        }

        const userSubject = device.accountId
            ? `user:${device.createdBy}:${device.accountId}`
            : `user:${device.createdBy}`;

        await sendNotificationWithTicket({
            prisma,
            sub: `device:${deviceId}`,
            recipient: userSubject,
            type: 'device:dataUpdate',
            flowId: uuidv4(),
            expiresIn: '5m',
            params: { deviceId }
        });

        logger.info(`[device.dataReady] Sent device:dataUpdate notification to ${userSubject} for device ${deviceId}`);
        return { status: 'ok' };
    } catch (error) {
        logger.error(`[device.dataReady] Error: ${error instanceof Error ? error.message : String(error)}`);
        return { status: 'error' };
    }
}
