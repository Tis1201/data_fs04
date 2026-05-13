import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict_device } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { z } from 'zod';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { SystemUser } from '$lib/server/messaging/interfaces/message';
import { getLatestDeviceInformation } from '$lib/server/clickhouse/client';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';

// Validation schema for device status updates
const DeviceStatusUpdateSchema = z.object({
    logId: z.string().optional(),
    action: z.string(),
    status: z.enum(['initiated', 'in_progress', 'success', 'complete', 'failed', 'cancelled', 'timeout']),
    message: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
    profileId: z.string().optional(),
    metadata: z.record(z.any()).optional()
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
    const result = await restrict_device({ locals, request });
    
    if ('error' in result) {
        return json({
            success: false,
            error: result.error,
            message: result.error
        }, { status: result.response.status });
    }
    
    const { device } = result;
    
    if (device.status !== 'ACTIVE') {
        return json({
            success: false,
            error: 'Device not active',
            message: 'Device not active'
        }, { status: 404 });
    }

    try {
        const body = await request.json();
        const { logId, action, status, message, progress, profileId, metadata, objectPath, deviceId } = body;

        if (!logId || !action || !status) {
            return json({
                success: false,
                error: 'Missing required fields: logId, action, status',
                message: 'Missing required fields'
            }, { status: 400 });
        }

        logger.info(`[Device Status Update] Received status update for device ${device.id}`, {
            deviceId: device.id,
            action,
            status,
            logId,
            profileId,
            hasObjectPath: !!objectPath,
            progress
        });

        // Find the action log
        const actionLog = await prisma.deviceActionLog.findFirst({
            where: {
                id: logId,
                deviceId: device.id
            }
        });

        if (!actionLog) {
            logger.warn(`[Device Status Update] Action log not found`, { logId, deviceId: device.id, action, status });
            return json({
                success: false,
                error: 'Action log not found',
                message: 'Action log not found'
            }, { status: 404 });
        }

        // Handle action log updates for all action types
        let updatedLog = null;
        let durationMs = null;

        // Normalize device action name for branch logic (device may send get_logs, server uses getLogs for event type)
        const actionForBranch = action === 'get_logs' ? 'getLogs' : action;

        // For pullFile/getLogs actions, update metadata with objectPath if provided (from request body or metadata)
        const objectPathToSave = objectPath || (metadata as any)?.objectPath;
        if ((actionForBranch === 'pullFile' || actionForBranch === 'getLogs') && objectPathToSave) {
            const currentMetadata = (actionLog.metadata as any) || {};
            await prisma.deviceActionLog.update({
                where: { id: actionLog.id },
                data: {
                    metadata: {
                        ...currentMetadata,
                        objectPath: objectPathToSave,
                        bucket: (metadata as any)?.bucket || currentMetadata.bucket || undefined
                    }
                }
            });
            logger.info(`[Device Status Update] Updated action log metadata with objectPath`, {
                logId: actionLog.id,
                actionForBranch,
                objectPath: objectPathToSave.substring(0, 80) + (objectPathToSave.length > 80 ? '...' : '')
            });
        }

        if (status === 'complete' || status === 'success') {
            updatedLog = await ActionLogger.finalize(actionLog.id, 'success', message || `${action} completed successfully`);
            durationMs = updatedLog.durationMs;
        } else if (status === 'failed' || status === 'error') {
            updatedLog = await ActionLogger.finalize(actionLog.id, 'failed', message || `${action} failed`);
            durationMs = updatedLog.durationMs;
        } else if (status === 'in_progress') {
            await ActionLogger.updateProgress({
                logId: actionLog.id,
                status: 'in_progress',
                progress: progress || 0,
                message: message || `${action} in progress`
            });
        }

        // Handle profile-specific logic if this is a profile action
        if (action === 'applyProfile' && profileId) {
            await handleProfileApplication(device.id, { status, profileId, message });
        }

        // Publish SSE update for real-time UI updates only
        logger.info(`[Device Status Update] Applying status to action log`, {
            logId,
            action,
            actionForBranch,
            status,
            willFinalize: status === 'complete' || status === 'success',
            willPublishGetLogsOrPullFile: actionForBranch === 'pullFile' || actionForBranch === 'getLogs'
        });

        // For pullFile and getLogs actions, publish as specific status events with objectPath
        if (actionForBranch === 'pullFile' || actionForBranch === 'getLogs') {
            // Get the latest metadata (may have been updated above)
            const latestLog = await prisma.deviceActionLog.findUnique({
                where: { id: actionLog.id },
                select: { metadata: true }
            });
            const latestMetadata = (latestLog?.metadata as any) || {};
            
            // Use objectPath from request, then from updated metadata, then from original metadata
            const effectiveObjectPath = objectPath || latestMetadata?.objectPath || metadata?.objectPath;
            
            if (!effectiveObjectPath && (status === 'success' || status === 'complete')) {
                logger.warn(`[Device Status Update] ${actionForBranch} succeeded but no objectPath found`, {
                    logId,
                    deviceId: device.id,
                    metadata: latestMetadata
                });
            }

            logger.info(`[Device Status Update] Publishing file-action status event`, {
                logId,
                actionForBranch,
                eventType: actionForBranch === 'pullFile' ? 'device:pullFileStatus' : 'device:getLogsStatus',
                hasEffectiveObjectPath: !!effectiveObjectPath
            });
            
            const eventType = actionForBranch === 'pullFile' ? 'device:pullFileStatus' : 'device:getLogsStatus';
            const statusMessage = MessageFactory.createSystemMessage(
                eventType,
                `subscription:device:${device.id}`,
                {
                    logId,
                    action: actionForBranch,
                    status,
                    deviceId: device.id,
                    message: message || `${actionForBranch} ${status}`,
                    progress,
                    objectPath: effectiveObjectPath, // Include objectPath for download
                    timestamp: new Date().toISOString()
                },
                SystemUser,
                { 
                    echoToSender: false,
                    excludeDevices: true  // Don't send status updates back to the device
                }
            );
            await publisher.publish(statusMessage);
        } else {
            // For other actions, use the standard device:statusUpdate
            const notificationMessage = MessageFactory.createSystemMessage(
                'device:statusUpdate',
                `subscription:device:${device.id}`,
                {
                    logId,
                    action,
                    status,
                    message: message || `${action} ${status}`,
                    durationMs, // Include server-calculated duration
                    progress,
                    timestamp: new Date().toISOString()
                },
                SystemUser,
                { 
                    echoToSender: false,
                    excludeDevices: true  // Don't send status updates back to the device
                }
            );
            await publisher.publish(notificationMessage);
        }

        // If action succeeds, fetch and push fresh data via SSE
        const refreshActions = [
            'installApp',
            'uninstall',
            'restartApp',
            'refresh',
            'reboot',
            'updateFirmware',
            'applyProfile',
            'config'
        ];

        if ((status === 'complete' || status === 'success') && refreshActions.includes(action)) {
            logger.info(`[Device Status Update] Action ${action} completed successfully, fetching fresh data for device ${device.id}`);
            
            try {
                // Query fresh data from ClickHouse in parallel
                const [deviceInfo, appsData] = await Promise.all([
                    getLatestDeviceInformation(device.macAddress).catch(err => {
                        logger.error(`[Device Status Update] Failed to fetch device info: ${err}`);
                        return null;
                    }),
                    deviceAppService.getDeviceApps(device.id, 1, 10).catch(err => {
                        logger.error(`[Device Status Update] Failed to fetch apps: ${err}`);
                        return { apps: [], page: 1, limit: 10, total: 0 };
                    })
                ]);

                logger.info(`[Device Status Update] Fetched device info and ${appsData.apps.length} apps for device ${device.id}`);

                // Publish enriched notification message with fresh data (exclude device connection)
                const dataUpdateMessage = MessageFactory.createSystemMessage(
                    'device:dataUpdate',
                    `subscription:device:${device.id}`,
                    {
                        action,
                        status: 'complete',
                        message: message || `${action} completed successfully`,
                        logId,
                        updatedData: {
                            deviceInfo,

                            apps: appsData.apps,
                            appsPagination: {
                                page: appsData.page,
                                limit: appsData.limit,
                                total: appsData.total,
                                totalPages: Math.ceil(appsData.total / appsData.limit)
                            },

                            // Metadata
                            timestamp: Date.now(),
                            shouldReloadFullList: appsData.total > 10 // Flag if more data exists
                        }
                    },
                    SystemUser,
                    { 
                        echoToSender: false,
                        excludeDevices: true  // Don't send data updates back to the device
                    }
                );

                await publisher.publish(dataUpdateMessage);

                logger.info(`[Device Status Update] Published device:dataUpdate with fresh data for device ${device.id}`);
            } catch (error) {
                logger.error(`[Device Status Update] Error fetching/publishing fresh data: ${String(error)}`);
                // Don't fail the whole request if data refresh fails
            }
        }

        logger.info(`[Device Status Update] Device ${device.id} reported ${action} ${status} for log ${logId}`);

        return json({
            success: true,
            data: {
                logId,
                action,
                status,
                message: message || `${action} ${status}`,
                durationMs,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error(`[Device Status Update] Error handling device status update: ${String(error)}`);
        
        if (error instanceof z.ZodError) {
            return json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
        }
        
        return json({
            success: false,
            error: 'Failed to process status update',
            message: 'Failed to process status update'
        }, { status: 500 });
    }
};

async function handleProfileApplication(deviceId: string, data: any) {
    try {
        if ((data.status === 'success' || data.status === 'complete') && data.profileId) {
            // Find the assignment - it should match the profileId (GLOBAL profile)
            // We use updateMany with deviceId only, then verify profileId matches
            const assignment = await prisma.deviceProfileAssignment.findUnique({
                where: { deviceId: deviceId },
                select: { id: true, profileId: true, status: true }
            });

            if (!assignment) {
                logger.warn(`[Device Status Update] No assignment found for device ${deviceId} when updating profile status`);
                return;
            }

            // Verify the profileId matches (device should send the GLOBAL profile ID)
            if (assignment.profileId !== data.profileId) {
                logger.warn(`[Device Status Update] Profile ID mismatch for device ${deviceId}. Expected ${assignment.profileId}, got ${data.profileId}`);
                // Still update if status is APPLYING or PENDING (device might have old profileId cached)
                if (assignment.status !== 'APPLYING' && assignment.status !== 'PENDING') {
                    return;
                }
            }

            // Update the DeviceProfileAssignment record to SUCCESS
            await prisma.deviceProfileAssignment.update({
                where: { deviceId: deviceId },
                data: {
                    status: 'SUCCESS',
                    appliedAt: new Date(),
                    lastSyncAt: new Date()
                }
            });

            logger.info(`[Device Status Update] Profile assignment completed successfully for device ${deviceId}`, {
                deviceId,
                profileId: assignment.profileId,
                status: 'SUCCESS'
            });

            // Send notification to web UI to update the device list
            // Publish to multiple channels for better coverage (especially important for preclaim flow)
            try {
                // Get device account for account-level channel
                const device = await prisma.device.findUnique({
                    where: { id: deviceId },
                    select: { accountId: true }
                });

                // 1. Publish to device channel (for device-specific subscribers)
                const deviceMessage = MessageFactory.createSystemMessage(
                    'device:profileUpdate',
                    `subscription:device:${deviceId}`,
                    {
                        action: 'applyProfile',
                        deviceId: deviceId,
                        status: 'complete',
                        profileId: assignment.profileId, // Use the assignment's profileId (GLOBAL)
                        message: 'Profile assignment completed successfully',
                        sentAt: new Date().toISOString()
                    },
                    SystemUser,
                    { echoToSender: false }
                );

                await publisher.publish(deviceMessage);

                // 2. Publish to profile channel (for profile page subscribers)
                // This is critical for the profile's devices tab to receive updates
                const profileMessage = MessageFactory.createSystemMessage(
                    'device:profileUpdate',
                    `subscription:device-profile:${assignment.profileId}`,
                    {
                        action: 'applyProfile',
                        deviceId: deviceId,
                        status: 'complete',
                        profileId: assignment.profileId,
                        message: 'Profile assignment completed successfully',
                        sentAt: new Date().toISOString()
                    },
                    SystemUser,
                    { echoToSender: false }
                );

                await publisher.publish(profileMessage);

                // 3. Also publish to account devices channel (fallback for preclaim flow)
                // This ensures updates are received even if profile channel isn't subscribed yet
                if (device?.accountId) {
                    const accountMessage = MessageFactory.createSystemMessage(
                        'device:profileUpdate',
                        `subscription:account:${device.accountId}:devices`,
                        {
                            action: 'applyProfile',
                            deviceId: deviceId,
                            status: 'complete',
                            profileId: assignment.profileId,
                            message: 'Profile assignment completed successfully',
                            sentAt: new Date().toISOString()
                        },
                        SystemUser,
                        { echoToSender: false }
                    );

                    await publisher.publish(accountMessage);
                }

                logger.info(`[Device Status Update] Notification sent for device ${deviceId} profile completion (device + profile + account channels)`);
            } catch (notificationError) {
                logger.error(`[Device Status Update] Error sending notification: ${String(notificationError)}`);
            }
        } else if (data.status === 'failed') {
            // Find the assignment first
            const assignment = await prisma.deviceProfileAssignment.findUnique({
                where: { deviceId: deviceId },
                select: { id: true, profileId: true }
            });

            if (assignment) {
                // Mark assignment as failed
                await prisma.deviceProfileAssignment.update({
                    where: { deviceId: deviceId },
                    data: {
                        status: 'FAILED',
                        lastSyncAt: new Date()
                    }
                });

                logger.warn(`[Device Status Update] Profile assignment failed for device ${deviceId}`, {
                    deviceId,
                    profileId: assignment.profileId,
                    message: data.message
                });

                // Send notification for failure (important for preclaim flow)
                try {
                    const device = await prisma.device.findUnique({
                        where: { id: deviceId },
                        select: { accountId: true }
                    });

                    // Publish to profile channel
                    const profileFailureMessage = MessageFactory.createSystemMessage(
                        'device:profileUpdate',
                        `subscription:device-profile:${assignment.profileId}`,
                        {
                            action: 'applyProfile',
                            deviceId: deviceId,
                            status: 'failed',
                            profileId: assignment.profileId,
                            message: data.message || 'Profile assignment failed',
                            sentAt: new Date().toISOString()
                        },
                        SystemUser,
                        { echoToSender: false }
                    );
                    await publisher.publish(profileFailureMessage);

                    // Also publish to account channel (fallback for preclaim flow)
                    if (device?.accountId) {
                        const accountFailureMessage = MessageFactory.createSystemMessage(
                            'device:profileUpdate',
                            `subscription:account:${device.accountId}:devices`,
                            {
                                action: 'applyProfile',
                                deviceId: deviceId,
                                status: 'failed',
                                profileId: assignment.profileId,
                                message: data.message || 'Profile assignment failed',
                                sentAt: new Date().toISOString()
                            },
                            SystemUser,
                            { echoToSender: false }
                        );
                        await publisher.publish(accountFailureMessage);
                    }

                    logger.info(`[Device Status Update] Failure notification sent for device ${deviceId}`);
                } catch (notificationError) {
                    logger.error(`[Device Status Update] Error sending failure notification: ${String(notificationError)}`);
                }
            } else {
                logger.warn(`[Device Status Update] No assignment found for device ${deviceId} when marking as failed`);
            }
        }
    } catch (error) {
        logger.error(`[Device Status Update] Error updating profile assignment: ${String(error)}`);
        throw error;
    }
}

// Simplified - removed complex action log creation for now
