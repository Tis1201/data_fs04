import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { checkDeviceAccess } from '../shared/access_checker';

interface ResetDeviceParams {
    deviceId?: string;
}

/********************************************************************************************
 * Web-side reset handler: authorizes devices and dispatches SSE pipeline events.
 ********************************************************************************************/
export async function handleResetDevice(
    params: ResetDeviceParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebReset] User ${sub} requesting reset for device ${deviceId}`);

    const flowId = crypto.randomUUID();

    await sendNotificationWithTicket({
        prisma,
        sub: sub!,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.Reset,
        flowId,
        params: {},
        expiresIn: '5m'
    });

    logger.info(`[WebReset] Dispatched reset action for device ${deviceId}`);

    return { flowId, result: { deviceId } };
}
