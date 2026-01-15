import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import type { NotificationTicketEnvelope } from '../../core/publish';
import { broadcastDeviceActionUpdate } from '../notifications/device_action_broadcaster';

/**
 * Handles screenshot responses and errors from devices.
 * Updates action logs and forwards notifications to UI.
 */
export interface ScreenshotHandlerResult {
    isScreenshotResponse: boolean;
    isScreenshotError: boolean;
    notificationParams: Record<string, unknown>;
    notificationType: string;
}

export async function handleScreenshotMessage(
    prisma: PrismaClient,
    ctx: NotificationTicketEnvelope,
    result: Record<string, unknown>
): Promise<ScreenshotHandlerResult> {
    const resultObj = result;
    const payload = resultObj.payload as Record<string, unknown> | undefined;
    
    const objectPath = (payload?.objectPath ?? resultObj.objectPath) as string | undefined;
    const format = (payload?.format ?? resultObj.format) as string | undefined;
    const payloadType = payload?.type as string | undefined;

    const isScreenshotError = payloadType === 'screenshot:error' || 
        resultObj.type === 'device.screenshot.error';

    const isScreenshotResponse = ctx.type === 'device.screenshot' ||
        resultObj.type === 'device.screenshot.response' ||
        (!!payload && (
            payload.type === 'screenshot:response' ||
            (typeof payload.objectPath === 'string' && payload.objectPath.includes('/screenshots/'))
        )) ||
        (typeof objectPath === 'string' && objectPath.includes('/screenshots/'));

    let notificationParams: Record<string, unknown> = resultObj;
    let notificationType = ctx.type;

    if (isScreenshotResponse) {
        const operationId = (ctx.params as any)?.operationId || (resultObj as any)?.operationId;
        let durationMs: number | null = null;
        let deviceId: string | undefined;
        
        if (operationId) {
            try {
                const { ActionLogger } = await import('$lib/server/action-logger');
                if (objectPath) {
                    const updated = await ActionLogger.finalize(operationId, 'success', 'Screenshot captured successfully');
                    durationMs = updated.durationMs;
                    deviceId = updated.deviceId;
                    logger.info('[ScreenshotHandler] Action log updated to success', { 
                        operationId, 
                        objectPath,
                        durationMs,
                        deviceId
                    });
                } else {
                    const updated = await ActionLogger.finalize(operationId, 'failed', 'Screenshot response missing objectPath');
                    durationMs = updated.durationMs;
                    deviceId = updated.deviceId;
                    logger.warn('[ScreenshotHandler] Action log updated to failed (missing objectPath)', { 
                        operationId,
                        durationMs,
                        deviceId
                    });
                }
            } catch (err) {
                logger.error('[ScreenshotHandler] Failed to update action log', {
                    error: err instanceof Error ? err.message : String(err),
                    operationId
                });
            }
        }

        if (objectPath) {
            const { generateDownloadUrl } = await import('$lib/server/storage');
            const path = await import('path');

            try {
                const fileName = path.basename(objectPath);
                const downloadUrlResult = await generateDownloadUrl(
                    objectPath,
                    3600,
                    fileName
                );

                notificationParams = {
                    ...resultObj,
                    objectPath,
                    downloadUrl: downloadUrlResult.url,
                    format,
                    message: 'Screenshot captured successfully',
                    durationMs: durationMs ?? undefined,
                    payload
                };

                logger.debug('[ScreenshotHandler] Download URL generated', {
                    objectPath,
                    format,
                    durationMs
                });
            } catch (err) {
                logger.error('[ScreenshotHandler] Failed to generate download URL', {
                    error: err instanceof Error ? err.message : String(err),
                    objectPath
                });

                notificationParams = {
                    ...resultObj,
                    objectPath,
                    format,
                    message: 'Screenshot captured successfully',
                    durationMs: durationMs ?? undefined,
                    payload
                };
            }
        } else {
            logger.warn('[ScreenshotHandler] Screenshot response missing objectPath', {
                operationId: (ctx.params as any)?.operationId || (resultObj as any)?.operationId
            });
        }
    }

    if (isScreenshotError) {
        const operationId = (ctx.params as any)?.operationId || (resultObj as any)?.operationId;
        const errorMessage = (payload?.error ?? resultObj.error) as string | undefined || 'Screenshot failed';
        
        let durationMs: number | null = null;
        let deviceId: string | undefined;
        
        if (operationId) {
            try {
                const { ActionLogger } = await import('$lib/server/action-logger');
                const updated = await ActionLogger.finalize(operationId, 'failed', errorMessage);
                durationMs = updated.durationMs;
                deviceId = updated.deviceId;
                
                logger.info('[ScreenshotHandler] Action log updated to failed', { 
                    operationId, 
                    errorMessage,
                    durationMs,
                    deviceId
                });

                if (deviceId) {
                    try {
                        await broadcastDeviceActionUpdate({
                            prisma,
                            deviceId,
                            logId: operationId,
                            action: 'screenshot',
                            status: 'failed',
                            message: errorMessage,
                            durationMs
                        });
                        
                        logger.debug('[ScreenshotHandler] Error status broadcasted', {
                            operationId,
                            deviceId
                        });
                    } catch (broadcastErr) {
                        logger.warn('[ScreenshotHandler] Failed to broadcast error status', {
                            error: broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr),
                            operationId
                        });
                    }
                }
            } catch (err) {
                logger.error('[ScreenshotHandler] Failed to update action log on error', {
                    error: err instanceof Error ? err.message : String(err),
                    operationId
                });
            }
        }

        notificationParams = {
            ...resultObj,
            error: errorMessage,
            type: 'screenshot:error',
            durationMs: durationMs ?? undefined
        };
    }

    const hasScreenshotObjectPath = (notificationParams && typeof notificationParams === 'object' &&
        typeof (notificationParams as Record<string, unknown>).objectPath === 'string' &&
        ((notificationParams as Record<string, unknown>).objectPath as string).includes('/screenshots/'));

    if (isScreenshotResponse || hasScreenshotObjectPath || isScreenshotError) {
        notificationType = 'device.screenshot';
    }

    return {
        isScreenshotResponse,
        isScreenshotError,
        notificationParams,
        notificationType
    };
}
