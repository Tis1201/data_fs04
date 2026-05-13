import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { DeviceProfileService } from '$lib/server/device/profile';

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

            // Use the new DeviceProfileService to assign GLOBAL profiles (no device-level copies)
            const profileService = new DeviceProfileService(prisma);

            await Promise.all(deviceIds.map(async (deviceId: string) => {
                try {
                    // 1. Assign GLOBAL profile to device (creates assignment, no copy)
                    const assignmentResult = await profileService.assignProfile(
                        deviceId,
                        profileId,
                        auth?.user?.id || 'system'
                    );

                    if (!assignmentResult.success) {
                        logger.error(`Failed to assign profile to device ${deviceId}:`, {
                            error: assignmentResult.error,
                            deviceId,
                            profileId
                        } as any);
                        return; // Skip this device
                    }

                    // 2. Update assignment status to APPLYING
                    await prisma.deviceProfileAssignment.update({
                        where: { deviceId: deviceId },
                        data: { status: 'APPLYING' }
                    });

                    // 3. Get the global profile with settings for sending config
                    const globalProfile = await prisma.deviceProfile.findUnique({
                        where: { id: profileId },
                        include: {
                            settings: {
                                orderBy: { order: 'asc' }
                            }
                        }
                    });

                    if (!globalProfile) {
                        logger.error(`Profile ${profileId} not found when sending config to device ${deviceId}`);
                        return;
                    }

                    // 4. Send config to device using ProfileMessagingService
                    const { ProfileMessagingService } = await import('$lib/server/device/profile');
                    const { ProfileConfigBuilder } = await import('$lib/server/device/profile');
                    
                    const configBuilder = new ProfileConfigBuilder(prisma);
                    const messagingService = new ProfileMessagingService(prisma);
                    
                    const config = configBuilder.buildFromGlobal(globalProfile);
                    
                    await messagingService.sendConfigToDevice(
                        deviceId,
                        config,
                        profileId,
                        {
                            userId: auth?.user?.id || 'system'
                        }
                    );

                    logger.info(`Profile assigned and config sent to device ${deviceId}`, {
                        deviceId,
                        profileId,
                        assignmentId: assignmentResult.assignmentId
                    });

                } catch (error) {
                    logger.error(`Error assigning profile to device ${deviceId}:`, error as any);
                    // Continue with other devices even if one fails
                }
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
