import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { checkDeviceAccess } from '../shared/access_checker';
import { generatePresignedUrl } from '$lib/server/storage';

interface ScreenshotDeviceParams {
    deviceId?: string;
    quality?: number;
}

/********************************************************************************************
 * Web-side screenshot handler: authorizes devices and generates presigned upload URL.
 ********************************************************************************************/
export async function handleScreenshotDevice(
    params: ScreenshotDeviceParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string; objectPath: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebScreenshot] User ${sub} requesting screenshot for device ${deviceId}`);

    const flowId = crypto.randomUUID();

    if(!sub){
        throw new Error('Missing subject for web client');
    }

    const timestamp = Date.now();
    const objectPath = `devices/${deviceId}/screenshots/${timestamp}/screenshot.jpg`;
    
    const result = await generatePresignedUrl(
        objectPath,
        'image/jpeg', // Content-Type for screenshot upload
        300 // 5 minutes expiry for upload URL
    );

    if (!result || !result.url) {
        throw new Error('Failed to generate presigned upload URL for screenshot');
    }

    const uploadUrl = result.url;

    logger.info(`[WebScreenshot] Generated upload URL for screenshot`, {
        deviceId,
        objectPath,
        uploadUrl: uploadUrl.substring(0, 100) + '...'
    });

    await sendNotificationWithTicket({
            prisma,
            sub,
            recipient: `device:${deviceId}`,
            type: DeviceNotificationType.Screenshot,
            flowId,
            params: {
                uploadUrl,
                objectPath,
                quality: params.quality || 75
            },
            expiresIn: '5m'
        })

    logger.info(
        `[WebScreenshot] Dispatched screenshot action for device ${deviceId}, objectPath=${objectPath}`
    );

    return { flowId, result: { deviceId, objectPath } };
}
