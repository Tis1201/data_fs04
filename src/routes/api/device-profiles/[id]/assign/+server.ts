import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { SystemUser } from '$lib/server/messaging/interfaces/message';
import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';

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
            const body = await request.json();

            const { deviceIds } = body;

            if (!deviceIds) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'INVALID_REQUEST', 
                        message: `Missing deviceIds`,
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 400 });
            }

            // Verify device profile exists
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

            const config = mapToConfigPayload(deviceProfile as any);

            await Promise.all(deviceIds.map(async (deviceId: string) => {
                const requestId = crypto.randomUUID();

                // DEBUG: Log the message being sent
                logger.info(`[DEBUG] Creating device profile assignment message`, {
                    deviceId,
                    profileId,
                    requestId,
                    scope: `subscription:device:${deviceId}`,
                    messageType: 'device:actionRequest'
                });

                // Create or update DeviceProfileAssignment record with APPLYING status
                try {
                    await prisma.deviceProfileAssignment.upsert({
                        where: {
                            deviceId: deviceId
                        },
                        update: {
                            profileId: profileId,
                            assignedBy: auth?.user?.id || 'system',
                            status: 'APPLYING',
                            assignedAt: new Date()
                        },
                        create: {
                            profileId: profileId,
                            deviceId: deviceId,
                            assignedBy: auth?.user?.id || 'system',
                            status: 'APPLYING'
                        }
                    });

                    logger.info(`[DEBUG] DeviceProfileAssignment record created/updated for device ${deviceId}`, {
                        deviceId,
                        profileId,
                        status: 'APPLYING'
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
                                
                                logger.warn(`Profile assignment timed out for device ${deviceId}`, {
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
                                            message: 'Profile assignment timed out after 3 minutes',
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

                } catch (dbError) {
                    logger.error(`Error creating/updating DeviceProfileAssignment record: ${String(dbError)}`);
                    // Continue with message sending even if DB update fails
                }

                // Send command to device via SSE using standardized format
                const routingMessage = MessageFactory.createSystemMessage(
                    'device:actionRequest',
                    `subscription:device:${deviceId}`,
                    {
                        action: 'applyProfile',
                        deviceId,
                        logId: requestId,
                        requestId,
                        profileId,
                        'sentAt': new Date().toISOString(),
                        config,
                    },
                    SystemUser,
                    { echoToSender: false }
                );
                

                await publisher.publish(routingMessage);
                
                logger.info(`Message published for device ${deviceId}`);

            }))

            return json({
                success: true,
                data: {
                    profileId,
                    message: `Broadcasting device profile settings to ${deviceIds.length} device(s)`,
                    timestamp: new Date().toISOString(),
                },
            }, {status: 202});

        } catch (error) {
            logger.error(`[UnifiedActionAPI] Error handling action request: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to broadcast device profile settings',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
