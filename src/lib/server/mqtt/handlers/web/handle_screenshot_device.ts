import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../core/publish';
import type { RpcHandlerArgs, RpcResponse } from '../index';
import { checkDeviceAccess } from './access_checker';

interface ScreenshotDeviceParams {
    deviceId?: string;
}

/********************************************************************************************
 * Web-side screenshot handler: authorizes devices and dispatches SSE pipeline events.
 ********************************************************************************************/
export async function handleScreenshotDevice(
    params: ScreenshotDeviceParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebScreenshot] User ${sub} requesting screenshot for device ${deviceId}`);

    
    const flowId = crypto.randomUUID();

    if(!sub){
        throw new Error('Missing subject for web client');
    }

    await sendNotificationWithTicket({
            prisma,
            sub,
            recipient: `device:${deviceId}`,
            type: DeviceNotificationType.Screenshot,
            flowId,
            params: {
            },
            expiresIn: '5m'
        })

    logger.info(
        `[WebScreenshot] Dispatched screenshot action for device ${deviceId}`
    );

    return { flowId, result: { deviceId } };
}
