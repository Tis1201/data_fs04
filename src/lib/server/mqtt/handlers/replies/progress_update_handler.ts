import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { broadcastDeviceActionUpdate } from '../notifications/device_action_broadcaster';

/********************************************************************************************
 * Handle device:progressUpdate messages
 * Updates action log with progress percentage and broadcasts to UI
 ********************************************************************************************/
export async function handleProgressUpdate(
    prisma: PrismaClient,
    logId: string,
    action: string,
    resultObj: Record<string, unknown>
): Promise<void> {
    try {
        const progress = resultObj.progress as number | undefined;
        const message = resultObj.message as string | undefined;
        const updateData: any = {
            message: message || undefined
        };

        if (progress !== undefined) {
            updateData.progress = progress;
        }

        const updatedLog = await (prisma as any).deviceActionLog.update({
            where: { id: logId },
            data: updateData,
            include: { device: true }
        });

        logger.info('[MQTT Reply] Updated action log from device:progressUpdate', {
            logId,
            action,
            progress,
            message
        });

        // Broadcast progress update to users monitoring this device
        await broadcastDeviceActionUpdate({
            prisma,
            deviceId: updatedLog.deviceId,
            logId,
            action,
            status: updatedLog.status,
            message: message || updatedLog.message,
            progress,
            accountId: updatedLog.device?.accountId
        });
    } catch (dbErr) {
        logger.error('[MQTT Reply] Failed to update action log progress', {
            logId,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr)
        });
    }
}
