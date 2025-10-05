import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { SystemUser } from '$lib/server/messaging/interfaces/message';

// Validation schema for reapply request
const ReapplyRequestSchema = z.object({
    deviceIds: z.array(z.string()).min(1, 'At least one device ID is required')
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
    try {
        const profileId = params.id;
        if (!profileId) {
            return json({ error: 'Profile ID is required' }, { status: 400 });
        }

        // Parse and validate request body
        const body = await request.json();
        const validatedData = ReapplyRequestSchema.parse(body);

        logger.info(`[Reapply Profile] Starting reapply for profile ${profileId}`, {
            profileId,
            deviceIds: validatedData.deviceIds,
            deviceCount: validatedData.deviceIds.length
        });

        // Verify profile exists
        const profile = await prisma.deviceProfile.findUnique({
            where: { id: profileId },
            select: { id: true, name: true }
        });

        if (!profile) {
            return json({ error: 'Profile not found' }, { status: 404 });
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
            return json({ error: 'Some devices not found or not assigned to this profile' }, { status: 400 });
        }

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
            try {
                // Create routing message for device
                const routingMessage = MessageFactory.createSystemMessage(
                    'device:actionRequest',
                    `subscription:device:${deviceId}`,
                    {
                        action: 'applyProfile',
                        deviceId: deviceId,
                        profileId: profileId,
                        message: 'Profile reapplication requested',
                        sentAt: new Date().toISOString()
                    },
                    SystemUser,
                    { echoToSender: false }
                );

                await publisher.publish(routingMessage);
                
                logger.info(`[Reapply Profile] Message sent to device ${deviceId}`, {
                    deviceId,
                    profileId,
                    messageId: routingMessage.id
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
            results: {
                total: validatedData.deviceIds.length,
                successful: successCount,
                failed: failureCount,
                details: results
            }
        });

    } catch (error) {
        logger.error(`[Reapply Profile] Error processing reapply request: ${String(error)}`);
        
        if (error instanceof z.ZodError) {
            return json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
        }
        
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
