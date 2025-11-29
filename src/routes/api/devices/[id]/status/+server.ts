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
        const { logId, action, status, message, progress, profileId, metadata } = body;

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
            profileId
        });

        // Find the action log
        const actionLog = await prisma.deviceActionLog.findFirst({
            where: {
                id: logId,
                deviceId: device.id
            }
        });

        if (!actionLog) {
            return json({
                success: false,
                error: 'Action log not found',
                message: 'Action log not found'
            }, { status: 404 });
        }

        // Handle action log updates for all action types
        let updatedLog = null;
        let durationMs = null;

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
        // Don't publish if only device connection exists (device reporting its own status)
        const sseMessage = MessageFactory.createSystemMessage(
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

        await publisher.publish(sseMessage);

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

                // Publish enriched SSE message with fresh data (exclude device connection)
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

            // Send SSE notification to web UI to update the device list
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

                logger.info(`[Device Status Update] SSE notification sent for device ${deviceId} profile completion (device + profile + account channels)`);
            } catch (sseError) {
                logger.error(`[Device Status Update] Error sending SSE notification: ${String(sseError)}`);
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

                // Send SSE notification for failure (important for preclaim flow)
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

                    logger.info(`[Device Status Update] SSE failure notification sent for device ${deviceId}`);
                } catch (sseError) {
                    logger.error(`[Device Status Update] Error sending SSE failure notification: ${String(sseError)}`);
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
