import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { broadcastDeviceActionUpdate } from '../notifications/device_action_broadcaster';

/********************************************************************************************
 * Handle device:statusUpdate messages
 * Updates action log with status, progress, and broadcasts to UI
 ********************************************************************************************/
export async function handleStatusUpdate(
    prisma: PrismaClient,
    logId: string,
    action: string,
    status: string,
    message: string,
    resultObj: Record<string, unknown>
): Promise<void> {
    try {
        // Extract progress if present
        let progress = resultObj.progress as number | undefined;
        
        // FALLBACK: Parse progress from message text if progress field is missing
        // Device sends progress in message like "Downloading... 70%" but not as progress field
        if ((progress === undefined || progress === null) && message) {
            const progressMatch = message.match(/(\d+)%/);
            if (progressMatch && progressMatch[1]) {
                const parsedProgress = parseInt(progressMatch[1], 10);
                if (!isNaN(parsedProgress) && parsedProgress >= 0 && parsedProgress <= 100) {
                    progress = parsedProgress;
                    logger.info('[MQTT Reply] Extracted progress from message text', {
                        logId,
                        action,
                        message: message.substring(0, 100),
                        extractedProgress: progress
                    });
                }
            }
        }
        
        logger.debug('[MQTT Reply] Processing device:statusUpdate', {
            logId,
            action,
            status,
            message: message?.substring(0, 100),
            progress,
            progressSource: resultObj.progress !== undefined ? 'field' : (progress !== undefined ? 'parsed' : 'none'),
            resultObj
        });

        // Format message consistently for app actions
        const isAppAction = ['restart_app', 'uninstall_app', 'config_app'].includes(action);
        let formattedMessage = message;

        if (isAppAction) {
            const packageName = resultObj.packageName as string | undefined;
            const actionVerb = {
                restart_app: 'restart',
                uninstall_app: 'uninstall',
                config_app: 'config'
            }[action] || action;

            if (packageName) {
                if (status === 'success' || status === 'complete') {
                    formattedMessage = `${actionVerb} ${packageName} success`;
                } else if (status === 'failed' || status === 'fail') {
                    const errorReason = resultObj.error || message || 'unknown error';
                    formattedMessage = `${actionVerb} ${packageName} error: ${errorReason}`;
                } else if (status === 'in_progress') {
                    formattedMessage = `${actionVerb} ${packageName} in progress`;
                } else {
                    formattedMessage = `${actionVerb} ${packageName} ${status}`;
                }
                
                logger.info('[MQTT Reply] Formatted app action message', {
                    logId,
                    action,
                    status,
                    packageName,
                    originalMessage: message,
                    formattedMessage
                });
            }
        }

        const updateData: any = {
            message: formattedMessage || undefined
        };

        // Include progress if provided or parsed
        if (progress !== undefined && progress !== null) {
            updateData.progress = progress;
        }

        // Map status to action log status
        if (status === 'in_progress') {
            updateData.status = 'in_progress';
        } else if (status === 'success' || status === 'failed') {
            updateData.status = status === 'success' ? 'success' : 'failed';
            const completedAt = new Date();
            updateData.completedAt = completedAt;
            
            // Calculate durationMs from initiatedAt
            try {
                const existingLog = await (prisma as any).deviceActionLog.findUnique({
                    where: { id: logId },
                    select: { initiatedAt: true }
                });
                
                if (existingLog?.initiatedAt) {
                    const initiatedAtTime = existingLog.initiatedAt instanceof Date 
                        ? existingLog.initiatedAt.getTime() 
                        : new Date(existingLog.initiatedAt).getTime();
                    const durationMs = completedAt.getTime() - initiatedAtTime;
                    
                    if (durationMs >= 0) {
                        updateData.durationMs = durationMs;
                        logger.debug('[MQTT Reply] Calculated duration', {
                            logId,
                            action,
                            durationMs,
                            initiatedAt: existingLog.initiatedAt,
                            completedAt: completedAt.toISOString()
                        });
                    } else {
                        logger.warn('[MQTT Reply] Negative duration calculated', {
                            logId,
                            action,
                            durationMs,
                            initiatedAt: existingLog.initiatedAt,
                            completedAt: completedAt.toISOString()
                        });
                    }
                } else {
                    logger.warn('[MQTT Reply] Cannot calculate duration - initiatedAt missing', {
                        logId,
                        action
                    });
                }
            } catch (durationErr) {
                logger.warn('[MQTT Reply] Failed to calculate duration', {
                    logId,
                    action,
                    error: durationErr instanceof Error ? durationErr.message : String(durationErr)
                });
            }
            
            // Only set progress to 100% for actions that track progress
            // Simple actions (refresh, reboot, restart) should not have progress
            if (status === 'success') {
                const actionsWithProgress = [
                    'installApp', 'install', 'install_app',
                    'updateFirmware', 'firmware_update', 'update_firmware',
                    'pullFile', 'pull_file',
                    'pushFile', 'push_file',
                    'getLogs', 'logs', 'get_logs'
                ];
                const shouldHaveProgress = action && actionsWithProgress.some(ap => 
                    action.toLowerCase().includes(ap.toLowerCase()) || 
                    ap.toLowerCase().includes(action.toLowerCase())
                );
                
                if (shouldHaveProgress && (updateData.progress === undefined || updateData.progress === null)) {
                    updateData.progress = 100;
                    logger.debug('[MQTT Reply] Setting progress to 100% on success for progress-tracking action', {
                        logId,
                        action
                    });
                } else if (!shouldHaveProgress) {
                    // Explicitly set progress to null for simple actions
                    updateData.progress = null;
                    logger.debug('[MQTT Reply] Not setting progress for simple action', {
                        logId,
                        action
                    });
                }
            }
        }

        logger.debug('[MQTT Reply] Attempting to update action log', {
            logId,
            updateData
        });

        const updatedLog = await (prisma as any).deviceActionLog.update({
            where: { id: logId },
            data: updateData,
            include: { device: true }
        });

        logger.info('[MQTT Reply] Updated action log from device:statusUpdate', {
            logId,
            action,
            status: updateData.status,
            message,
            progress: updateData.progress,
            durationMs: updatedLog.durationMs,
            updatedLogId: updatedLog.id
        });

        // Broadcast status update to users monitoring this device
        logger.info(`[MQTT Reply] Broadcasting device:statusUpdate to UI`, {
            logId,
            action,
            status: updateData.status,
            message: message?.substring(0, 100),
            progress: updateData.progress,
            durationMs: updatedLog.durationMs,
            deviceId: updatedLog.deviceId,
            accountId: updatedLog.device?.accountId,
            hasProgress: updateData.progress !== undefined && updateData.progress !== null
        });

        const durationToBroadcast = updateData.durationMs !== undefined && updateData.durationMs !== null
            ? updateData.durationMs
            : updatedLog.durationMs;
        
        await broadcastDeviceActionUpdate({
            prisma,
            deviceId: updatedLog.deviceId,
            logId,
            action,
            status: updateData.status,
            message,
            progress: updateData.progress,
            durationMs: durationToBroadcast,
            accountId: updatedLog.device?.accountId
        });

        // If this is an applyProfile action, update the DeviceProfileAssignment status
        if (action === 'applyProfile' && status && (status === 'success' || status === 'failed')) {
            const profileId = resultObj.profileId as string | undefined;
            const deviceId = resultObj.deviceId as string | undefined;

            if (profileId && deviceId) {
                try {
                    const assignmentStatus = status === 'success' ? 'APPLIED' : 'FAILED';
                    await (prisma as any).deviceProfileAssignment.updateMany({
                        where: {
                            deviceId,
                            profileId
                        },
                        data: {
                            status: assignmentStatus,
                            lastSyncAt: new Date()
                        }
                    });

                    logger.info('[MQTT Reply] Updated DeviceProfileAssignment status', {
                        deviceId,
                        profileId,
                        status: assignmentStatus
                    });
                } catch (assignErr) {
                    logger.error('[MQTT Reply] Failed to update DeviceProfileAssignment', {
                        deviceId,
                        profileId,
                        status,
                        error: assignErr instanceof Error ? assignErr.message : String(assignErr)
                    });
                }
            } else {
                logger.warn('[MQTT Reply] applyProfile status update missing profileId or deviceId', {
                    profileId,
                    deviceId,
                    status
                });
            }
        }
    } catch (dbErr) {
        logger.error('[MQTT Reply] Failed to update action log', {
            logId,
            action,
            status,
            messageType: 'device:statusUpdate',
            resultObj,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            stack: dbErr instanceof Error ? dbErr.stack : undefined
        });
    }
}
