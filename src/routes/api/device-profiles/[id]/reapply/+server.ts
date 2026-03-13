import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { z } from 'zod';
import { queueNotification } from '$lib/server/mqtt/core/queue';
import { DeviceNotificationType } from '$lib/server/mqtt/core/publish';
import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';

// Validation schema for reapply request
const ReapplyRequestSchema = z.object({
    deviceIds: z.array(z.string()).min(1, 'At least one device ID is required')
});

export const POST: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, request, auth } = event;
        const profileId = params.id;
        
        if (!profileId) {
            return json({ 
                success: false, 
                error: { 
                    code: 'INVALID_REQUEST', 
                    message: 'Device Profile ID is required',
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 400 });
        }

        try {
            // Parse and validate request body
            const body = await request.json();
            const validatedData = ReapplyRequestSchema.parse(body);

            logger.info(`[Reapply Profile] Starting reapply for profile ${profileId}`, {
                profileId,
                deviceIds: validatedData.deviceIds,
                deviceCount: validatedData.deviceIds.length,
                userId: auth?.user?.id
            });

            // Verify device profile exists and load settings
            const deviceProfile = await prisma.deviceProfile.findUnique({
                where: { id: profileId },
                select: {
                    id: true,
                    name: true,
                    accountId: true,
                    isActive: true,
                    settings: {
                        select: {
                            id: true,
                            key: true,
                            value: true,
                            dataType: true,
                            category: true
                        }
                    }
                }
            });

            if (!deviceProfile) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'DEVICE_PROFILE_NOT_FOUND', 
                        message: 'Device profile not found',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 404 });
            }

            // Check if user has access to this device profile
            const hasAccess = await prisma.accountMembership.findFirst({
                where: {
                    accountId: deviceProfile.accountId,
                    userId: auth?.user?.id
                }
            });

            if (event.auth?.user?.systemRole !== SystemRole.ADMIN && !hasAccess) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'FORBIDDEN', 
                        message: 'Access denied to this device profile',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 403 });
            }

            if (!deviceProfile.isActive) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'INVALID_REQUEST', 
                        message: 'Cannot reapply: device profile is inactive. Activate the profile first.',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 400 });
            }

            // Verify devices exist and are assigned to this profile
            const devices = await prisma.device.findMany({
                where: {
                    id: { in: validatedData.deviceIds },
                    profileAssignment: {
                        profileId: profileId
                    }
                },
                select: { id: true, name: true, connected: true }
            });

            if (devices.length !== validatedData.deviceIds.length) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'INVALID_REQUEST', 
                        message: 'Some devices not found or not assigned to this profile',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 400 });
            }

            // Map settings to config payload
            const config = mapToConfigPayload(deviceProfile as any);

            // Update DeviceProfileAssignment records to APPLYING status
            await prisma.deviceProfileAssignment.updateMany({
                where: {
                    deviceId: { in: validatedData.deviceIds },
                    profileId: profileId
                },
                data: {
                    status: 'APPLYING',
                    lastSyncAt: new Date()
                }
            });

            // Send reapply messages to each device via MQTT
            const results = [];
            for (const deviceId of validatedData.deviceIds) {
                const requestId = crypto.randomUUID();

                // Create ActionLog entry for tracking - get the logId first
                let logId = requestId; // fallback to requestId if action log creation fails
                try {
                    const actionLog = await ActionLogger.createInitiated({
                        deviceId: deviceId,
                        actionType: 'config_update',
                        initiatedBy: auth?.user?.id || 'system',
                        requestId: requestId,
                        metadata: {
                            action: 'applyProfile',
                            profileId: profileId,
                            profileName: deviceProfile.name,
                            reapply: true
                        },
                        initialMessage: `Reapplying profile: ${deviceProfile.name}`
                    });

                    logId = actionLog.id; // Use the database-generated ID
                    
                    logger.info(`[Reapply Profile] ActionLog created for device ${deviceId}`, {
                        deviceId,
                        profileId,
                        logId: logId,
                        requestId: requestId
                    });
                } catch (logError) {
                    logger.error(`[Reapply Profile] Error creating ActionLog: ${String(logError)}`);
                    // Continue with reapply even if log creation fails
                }

                try {
                    const flowId = crypto.randomUUID();
                    
                    // Use the authenticated user's current accountId for the notification topic
                    // This ensures the UI receives the update on the correct account's topic
                    // IMPORTANT: Must match the same logic as /api/user/mqtt/mint
                    const userAccountId = auth?.currentAccount?.account.id || deviceProfile.accountId;
                    
                    // Queue MQTT notification for worker to send to device
                    await queueNotification({
                        sub: `user:${auth?.user?.id}:${userAccountId}`,
                        recipient: `device:${deviceId}`,
                        type: DeviceNotificationType.ActionRequest,
                        flowId,
                        params: {
                            action: 'applyProfile',
                            deviceId: deviceId,
                            operationId: logId,
                            requestId: logId,
                            profileId: profileId,
                            profileName: deviceProfile.name,
                            config,
                            message: 'Profile reapplication requested'
                        },
                        expiresIn: '5m'
                    });
                    
                    logger.info(`[Reapply Profile] MQTT message queued for device ${deviceId}`, {
                        deviceId,
                        profileId,
                        logId,
                        flowId
                    });

                    // Set timeout to mark as FAILED if no response in 3 minutes
                    setTimeout(async () => {
                        try {
                            const assignment = await prisma.deviceProfileAssignment.findFirst({
                                where: {
                                    deviceId: deviceId,
                                    profileId: profileId,
                                    status: 'APPLYING'
                                }
                            });

                            if (assignment) {
                                await prisma.deviceProfileAssignment.update({
                                    where: { id: assignment.id },
                                    data: { 
                                        status: 'FAILED',
                                        lastSyncAt: new Date()
                                    }
                                });
                                
                                logger.warn(`[Reapply Profile] Profile reapplication timed out for device ${deviceId}`, {
                                    deviceId,
                                    profileId,
                                    status: 'FAILED'
                                });

                                // Send real-time notification to UI about timeout via MQTT
                                try {
                                    const timeoutFlowId = crypto.randomUUID();
                                    const timeoutAccountId = auth?.currentAccount?.account.id || deviceProfile.accountId;
                                    
                                    await queueNotification({
                                        sub: `user:${auth?.user?.id}:${timeoutAccountId}`,
                                        recipient: `user:${auth?.user?.id}:${timeoutAccountId}`,
                                        type: DeviceNotificationType.StatusUpdate,
                                        flowId: timeoutFlowId,
                                        params: {
                                            action: 'applyProfile',
                                            deviceId: deviceId,
                                            status: 'failed',
                                            profileId: profileId,
                                            message: 'Profile reapplication timed out after 3 minutes'
                                        },
                                        expiresIn: '5m'
                                    });
                                    
                                    logger.info(`[Reapply Profile] Timeout notification queued for device ${deviceId}`);
                                } catch (mqttError) {
                                    logger.error(`[Reapply Profile] Error queuing timeout notification: ${String(mqttError)}`);
                                }
                            }
                        } catch (timeoutError) {
                            logger.error(`[Reapply Profile] Error updating timeout status: ${String(timeoutError)}`);
                        }
                    }, 3 * 60 * 1000); // 3 minutes timeout

                    results.push({ deviceId, success: true });
                } catch (error) {
                    logger.error(`[Reapply Profile] Failed to send message to device ${deviceId}: ${String(error)}`);
                    results.push({ deviceId, success: false, error: String(error) });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;

            logger.info(`[Reapply Profile] Reapply completed`, {
                profileId,
                totalDevices: validatedData.deviceIds.length,
                successCount,
                failureCount
            });

            return json({
                success: true,
                message: `Profile reapplied to ${successCount} device(s)`,
                data: {
                    profileId,
                    results: {
                        total: validatedData.deviceIds.length,
                        successful: successCount,
                        failed: failureCount,
                        details: results
                    },
                    timestamp: new Date().toISOString()
                }
            }, { status: 202 });

        } catch (error) {
            logger.error(`[Reapply Profile] Error processing reapply request: ${String(error)}`);
            
            if (error instanceof z.ZodError) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'VALIDATION_ERROR', 
                        message: 'Invalid request data',
                        details: error.errors,
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 400 });
            }
            
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to reapply device profile',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);

