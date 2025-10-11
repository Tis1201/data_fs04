import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { z } from 'zod';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import { SystemUser } from '$lib/server/messaging/interfaces/message';
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

            // Send reapply messages to each device
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
                    
                    logger.info(`ActionLog created for device ${deviceId} (reapply)`, {
                        deviceId,
                        profileId,
                        logId: logId,
                        requestId: requestId
                    });
                } catch (logError) {
                    logger.error(`Error creating ActionLog: ${String(logError)}`);
                    // Continue with reapply even if log creation fails
                }

                try {
                    // Create routing message for device
                    const routingMessage = MessageFactory.createSystemMessage(
                        'device:actionRequest',
                        `subscription:device:${deviceId}`,
                        {
                            action: 'applyProfile',
                            deviceId: deviceId,
                            logId: logId, // Use the ActionLog ID
                            requestId: logId, // Keep requestId same as logId for consistency
                            profileId: profileId,
                            config,
                            message: 'Profile reapplication requested',
                            sentAt: new Date().toISOString()
                        },
                        SystemUser,
                        { echoToSender: false }
                    );

                    const publishResult = await publisher.publish(routingMessage);
                    
                    logger.info(`[Reapply Profile] Message published to device ${deviceId}`);

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
                                
                                logger.warn(`Profile reapplication timed out for device ${deviceId}`, {
                                    deviceId,
                                    profileId,
                                    status: 'FAILED'
                                });

                                // Send real-time notification to UI about timeout
                                try {
                                    const timeoutMessage = MessageFactory.createSystemMessage(
                                        'device:profileUpdate',
                                        `subscription:device:${deviceId}`,
                                        {
                                            action: 'applyProfile',
                                            deviceId: deviceId,
                                            status: 'failed',
                                            profileId: profileId,
                                            message: 'Profile reapplication timed out after 3 minutes',
                                            sentAt: new Date().toISOString()
                                        },
                                        SystemUser,
                                        { echoToSender: false }
                                    );

                                    await publisher.publish(timeoutMessage);
                                    logger.info(`Timeout notification sent for device ${deviceId}`);
                                } catch (sseError) {
                                    logger.error(`Error sending timeout notification: ${String(sseError)}`);
                                }
                            }
                        } catch (timeoutError) {
                            logger.error(`Error updating timeout status: ${String(timeoutError)}`);
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

