import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
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
            // Verify device profile exists and load settings
            const deviceProfile = await prisma.deviceProfile.findUnique({
                where: { id: profileId },
                select: { 
                    id: true,
                    name: true,
                    accountId: true,
                    assignments: true,
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

            // Map settings to config payload
            const config = mapToConfigPayload(deviceProfile as any);

            await Promise.all(deviceProfile.assignments.map(async assignment => {
                const deviceId = assignment.deviceId;
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
                            broadcast: true
                        },
                        initialMessage: `Broadcasting profile: ${deviceProfile.name}`
                    });

                    logId = actionLog.id; // Use the database-generated ID
                    
                    logger.info(`ActionLog created for device ${deviceId} (broadcast)`, {
                        deviceId,
                        profileId,
                        logId: logId,
                        requestId: requestId
                    });
                } catch (logError) {
                    logger.error(`Error creating ActionLog: ${String(logError)}`);
                    // Continue with broadcast even if log creation fails
                }

                // Update DeviceProfileAssignment to APPLYING status
                try {
                    await prisma.deviceProfileAssignment.updateMany({
                        where: {
                            deviceId: deviceId,
                            profileId: profileId
                        },
                        data: {
                            status: 'APPLYING',
                            assignedAt: new Date()
                        }
                    });
                } catch (dbError) {
                    logger.error(`Error updating DeviceProfileAssignment: ${String(dbError)}`);
                }

                // Send command to device via SSE using consistent format
                const routingMessage = MessageFactory.createSystemMessage(
                    'device:actionRequest',
                    `subscription:device:${deviceId}`,
                    {
                        action: 'applyProfile',
                        deviceId,
                        logId: logId, // Use the ActionLog ID
                        requestId: logId, // Keep requestId same as logId for consistency
                        profileId,
                        'sentAt': new Date().toISOString(),
                        config,
                    },
                    SystemUser,
                    { echoToSender: false }
                );
                
                await publisher.publish(routingMessage);
                logger.info(`Broadcast message published for device ${deviceId}`, {
                    deviceId,
                    profileId,
                    logId
                });
            }))

            return json({
                success: true,
                data: {
                    profileId,
                    message: `Broadcasting device profile settings to ${deviceProfile.assignments.length} device(s)`,
                    timestamp: new Date().toISOString(),
                },
            }, {status: 202});

        } catch (error) {
            logger.error(`[UnifiedActionAPI] Error handling action request: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to initiate action',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
