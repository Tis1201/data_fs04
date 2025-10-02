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
                    userId: auth.user.id
                }
            });

            if (event.auth.user.systemRole !== SystemRole.ADMIN && !hasAccess) {
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

            const config = mapToConfigPayload(deviceProfile);

            await Promise.all(deviceIds.map(async deviceId => {
                const requestId = crypto.randomUUID();

                // Send command to device via SSE
                const routingMessage = MessageFactory.createSystemMessage(
                    'device:applyProfile',
                    `subscription:device:${deviceId}`,
                    {
                        requestId,
                        profileId,
                        'sentAt': new Date().toISOString(),
                        config,
                    },
                    SystemUser,
                    { echoToSender: false }
                );
                
                await publisher.publish(routingMessage);
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
