import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { checkDeviceAccess } from '../shared/access_checker';
import { generatePresignedUrl } from '$lib/server/storage';
import { ActionLogger } from '$lib/server/action-logger';
import { broadcastDeviceActionUpdate } from '../../index';

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
): Promise<RpcResponse<{ deviceId: string; objectPath: string; operationId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebScreenshot] User ${sub} requesting screenshot for device ${deviceId}`);

    if(!sub){
        throw new Error('Missing subject for web client');
    }

    // Extract user ID from subject (format: "user:userId:accountId")
    const userId = sub.split(':')[1];
    if (!userId) {
        throw new Error('Invalid subject format, cannot extract user ID');
    }

    // Create action log for audit trail
    const actionLog = await ActionLogger.createInitiated({
        deviceId,
        actionType: 'screenshot',
        initiatedBy: userId,
        protocol: 'mqtt',
        metadata: {
            quality: params.quality || 75,
            source: 'mqtt_rpc'
        },
        initialMessage: 'Screenshot requested'
    });

    const flowId = crypto.randomUUID();

    const timestamp = Date.now();
    const objectPath = `devices/${deviceId}/screenshots/${timestamp}/screenshot.jpg`;

    // objectPath stored at initiation (same as pull_file/get_logs) so proxy has it immediately
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
                operationId: actionLog.id,
                uploadUrl,
                objectPath,
                quality: params.quality || 75
            },
            expiresIn: '5m'
        })

    // Broadcast initial "initiated" status to UI
    try {
        await broadcastDeviceActionUpdate({
            prisma,
            deviceId,
            logId: actionLog.id,
            action: 'screenshot',
            status: 'initiated',
            message: 'Screenshot requested'
        });
        logger.debug(`[WebScreenshot] Broadcasted initial status for action log ${actionLog.id}`);
    } catch (broadcastErr) {
        // Non-fatal error - log but don't fail the action
        logger.warn(`[WebScreenshot] Failed to broadcast initial status:`, broadcastErr);
    }

    logger.info(
        `[WebScreenshot] Dispatched screenshot action for device ${deviceId}, operation=${actionLog.id}, objectPath=${objectPath}`
    );

    return { flowId, result: { deviceId, objectPath, operationId: actionLog.id } };
}
