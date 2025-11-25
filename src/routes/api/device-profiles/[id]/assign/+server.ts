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
import { getMessageRelay } from '$lib/server/pushpin/middleware';
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
                    description: true,
                    accountId: true,
                    settings: {
                        select: {
                            id: true,
                            key: true,
                            value: true,
                            dataType: true,
                            category: true,
                            label: true,
                            order: true
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
                            profileName: deviceProfile.name
                        },
                        initialMessage: `Applying profile: ${deviceProfile.name}`
                    });

                    logId = actionLog.id; // Use the database-generated ID
                    
                    logger.info(`ActionLog created for device ${deviceId}`, {
                        deviceId,
                        profileId,
                        logId: logId,
                        requestId: requestId
                    });
                } catch (logError) {
                    logger.error(`Error creating ActionLog: ${String(logError)}`);
                    // Continue with assignment even if log creation fails
                }

                // Create device-level copy of the profile
                let deviceProfileId = profileId; // Default to global profile
                try {
                    // Check if device-level copy already exists
                    // Note: deviceId field will be available after Prisma schema generation
                    const existingDeviceProfile = await prisma.deviceProfile.findFirst({
                        where: {
                            // @ts-ignore - deviceId will be available after schema migration
                            deviceId: deviceId,
                            level: 'DEVICE',
                            accountId: deviceProfile.accountId
                        }
                    });

                    if (existingDeviceProfile) {
                        // Update existing device-level copy
                        await prisma.$transaction(async (tx) => {
                            // Update profile
                            await tx.deviceProfile.update({
                                where: { id: existingDeviceProfile.id },
                                data: {
                                    name: deviceProfile.name,
                                    description: deviceProfile.description,
                                    updatedBy: auth?.user?.id || 'system',
                                    updatedAt: new Date()
                                }
                            });

                            // Delete existing settings
                            await tx.deviceProfileSetting.deleteMany({
                                where: { profileId: existingDeviceProfile.id }
                            });

                            // Create new settings from global profile
                            if (deviceProfile.settings && deviceProfile.settings.length > 0) {
                                await tx.deviceProfileSetting.createMany({
                                    data: deviceProfile.settings.map((setting: any, index: number) => ({
                                        profileId: existingDeviceProfile.id,
                                        key: setting.key,
                                        value: setting.value,
                                        dataType: setting.dataType,
                                        label: setting.label || setting.key,
                                        category: setting.category || null,
                                        order: setting.order || index
                                    }))
                                });
                            }
                        });

                        deviceProfileId = existingDeviceProfile.id;
                        logger.info(`Updated existing device-level profile for device ${deviceId}`, {
                            deviceId,
                            deviceProfileId: existingDeviceProfile.id
                        });
                    } else {
                        // Create new device-level copy
                        const deviceProfileCopy = await prisma.$transaction(async (tx) => {
                            // Create device-level profile
                            const newProfile = await tx.deviceProfile.create({
                                data: {
                                    name: deviceProfile.name,
                                    description: deviceProfile.description || null,
                                    accountId: deviceProfile.accountId,
                                    // @ts-ignore - deviceId will be available after schema migration
                                    deviceId: deviceId,
                                    level: 'DEVICE',
                                    createdBy: auth?.user?.id || 'system',
                                    updatedBy: auth?.user?.id || 'system',
                                    isActive: true
                                }
                            });

                            // Copy settings from global profile
                            if (deviceProfile.settings && deviceProfile.settings.length > 0) {
                                await tx.deviceProfileSetting.createMany({
                                    data: deviceProfile.settings.map((setting: any, index: number) => ({
                                        profileId: newProfile.id,
                                        key: setting.key,
                                        value: setting.value,
                                        dataType: setting.dataType,
                                        label: setting.label || setting.key,
                                        category: setting.category || null,
                                        order: setting.order || index
                                    }))
                                });
                            }

                            return newProfile;
                        });

                        deviceProfileId = deviceProfileCopy.id;
                        logger.info(`Created device-level profile copy for device ${deviceId}`, {
                            deviceId,
                            deviceProfileId: deviceProfileCopy.id,
                            globalProfileId: profileId
                        });
                    }
                } catch (copyError) {
                    logger.error(`Error creating device-level profile copy: ${String(copyError)}`);
                    // Continue with global profile if copy fails
                }

                // DEBUG: Log the message being sent
                logger.info(`[DEBUG] Creating device profile assignment message`, {
                    deviceId,
                    profileId,
                    deviceProfileId,
                    logId,
                    requestId,
                    scope: `subscription:device:${deviceId}`,
                    messageType: 'device:actionRequest'
                });

                // Create or update DeviceProfileAssignment record with APPLYING status
                // Reference the device-level profile if it exists, otherwise global profile
                try {
                    await prisma.deviceProfileAssignment.upsert({
                        where: {
                            deviceId: deviceId
                        },
                        update: {
                            profileId: deviceProfileId, // Use device-level profile if created
                            assignedBy: auth?.user?.id || 'system',
                            status: 'APPLYING',
                            assignedAt: new Date()
                        },
                        create: {
                            profileId: deviceProfileId, // Use device-level profile if created
                            deviceId: deviceId,
                            assignedBy: auth?.user?.id || 'system',
                            status: 'APPLYING'
                        }
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

                // Send command to device via Redis Pub/Sub (sidecars relay to Pushpin)
                // ARCHITECTURE: Backend → Redis Pub/Sub → Sidecars → Pushpin → Device
                const messageRelay = getMessageRelay();
                
                if (!messageRelay) {
                    logger.error(`[DeviceProfile] MessageRelay not initialized - falling back to publisher system for device ${deviceId}`);
                    // Fallback to old publisher system for backward compatibility
                    const routingMessage = MessageFactory.createSystemMessage(
                        'device:actionRequest',
                        `subscription:device:${deviceId}`,
                        {
                            action: 'applyProfile',
                            deviceId,
                            logId: logId,
                            requestId: logId,
                            profileId,
                            'sentAt': new Date().toISOString(),
                            config,
                        },
                        SystemUser,
                        { echoToSender: false }
                    );
                    await publisher.publish(routingMessage);
                } else {
                    // Use Redis Pub/Sub for scalable device messaging
                    const message = {
                        type: 'device:actionRequest',
                        payload: {
                            action: 'applyProfile',
                            deviceId,
                            logId: logId,
                            requestId: logId,
                            profileId,
                            'sentAt': new Date().toISOString(),
                            config,
                        },
                        timestamp: new Date().toISOString()
                    };
                    
                    await messageRelay.publishToDevice(deviceId, message);
                }
                
                logger.info(`Message published for device ${deviceId} via Redis Pub/Sub`);

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
