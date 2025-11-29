/**
 * ProfileMessagingService
 * 
 * Handles sending device profile configurations to devices via Redis Pub/Sub or SSE.
 * Creates action logs for tracking and enables devices to send status updates.
 */

import { logger } from '$lib/server/logger';
import { getMessageRelay } from '$lib/server/pushpin/middleware';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { ActionLogger } from '$lib/server/action-logger';
import crypto from 'crypto';

export interface SendConfigOptions {
    delay?: number; // Optional delay in milliseconds before sending
    userId?: string; // User ID for action log (defaults to 'system')
    skipActionLog?: boolean; // Skip action log creation (for retries, etc.)
}

export interface SendConfigResult {
    success: boolean;
    logId: string | null;
    error?: string;
}

export class ProfileMessagingService {
    constructor(private prisma: any) {}

    /**
     * Send profile configuration to device with action logging
     * 
     * @param deviceId - Device ID to send config to
     * @param config - Configuration object (already mapped from profile)
     * @param profileId - Profile ID being applied
     * @param options - Optional configuration
     * @returns Result with logId for tracking
     */
    async sendConfigToDevice(
        deviceId: string,
        config: Record<string, any>,
        profileId: string,
        options?: SendConfigOptions
    ): Promise<SendConfigResult> {
        const sendConfig = async (): Promise<SendConfigResult> => {
            let logId: string | null = null;

            try {
                // Create action log unless explicitly skipped
                if (!options?.skipActionLog) {
                    const requestId = crypto.randomUUID();
                    const userId = options?.userId || 'system';

                    try {
                        const actionLog = await ActionLogger.createInitiated({
                            deviceId: deviceId,
                            actionType: 'config_update',
                            initiatedBy: userId,
                            requestId: requestId,
                            metadata: {
                                action: 'applyProfile',
                                profileId: profileId,
                                configKeys: Object.keys(config)
                            },
                            initialMessage: `Applying device profile configuration`
                        });

                        logId = actionLog.id;

                        logger.info(`[ProfileMessaging] Action log created for device ${deviceId}`, {
                            deviceId,
                            profileId,
                            logId,
                            userId
                        });
                    } catch (logError) {
                        logger.error(`[ProfileMessaging] Failed to create action log:`, logError as any);
                        // Continue even if log creation fails - use requestId as fallback
                        logId = requestId;
                    }
                }

                // Get message relay for Redis Pub/Sub (Pushpin mode)
                const messageRelay = getMessageRelay();

                const messagePayload = {
                    action: 'applyProfile',
                    deviceId: deviceId,
                    profileId: profileId,
                    logId: logId ?? undefined,
                    requestId: logId ?? undefined,
                    config: config,
                    sentAt: new Date().toISOString()
                };

                if (messageRelay) {
                    // Use Redis Pub/Sub for scalable device messaging
                    const message = {
                        type: 'device:actionRequest',
                        payload: messagePayload,
                        timestamp: new Date().toISOString()
                    };

                    await messageRelay.publishToDevice(deviceId, message);

                    logger.info(`[ProfileMessaging] Config sent via Redis Pub/Sub`, {
                        deviceId,
                        profileId,
                        logId,
                        configKeys: Object.keys(config),
                        transport: 'redis'
                    });
                } else {
                    // Fallback to publisher system (SSE mode)
                    logger.warn(`[ProfileMessaging] MessageRelay unavailable, using publisher fallback`);

                    const routingMessage = MessageFactory.createSystemMessage(
                        'device:actionRequest',
                        `subscription:device:${deviceId}`,
                        messagePayload,
                        SystemUser,
                        { echoToSender: false }
                    );

                    await publisher.publish(routingMessage);

                    logger.info(`[ProfileMessaging] Config sent via publisher`, {
                        deviceId,
                        profileId,
                        logId,
                        configKeys: Object.keys(config),
                        transport: 'sse'
                    });
                }

                return {
                    success: true,
                    logId: logId
                };

            } catch (error) {
                logger.error(`[ProfileMessaging] Failed to send config to device ${deviceId}:`, error as any);

                return {
                    success: false,
                    logId: logId,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        };

        // Apply delay if specified
        if (options?.delay && options.delay > 0) {
            return new Promise((resolve) => {
                setTimeout(async () => {
                    resolve(await sendConfig());
                }, options.delay);
            });
        } else {
            return await sendConfig();
        }
    }

    /**
     * Send pending profile assignments to device
     * 
     * Called when device connects to send any profiles that were
     * assigned while the device was offline.
     * 
     * @param deviceId - Device ID to check for pending assignments
     * @returns Number of profiles sent
     */
    async sendPendingAssignments(deviceId: string): Promise<number> {
        try {
            const pendingAssignments = await this.prisma.deviceProfileAssignment.findMany({
                where: {
                    deviceId: deviceId,
                    status: 'APPLYING'
                },
                include: {
                    profile: {
                        include: {
                            settings: {
                                orderBy: { order: 'asc' }
                            }
                        }
                    }
                }
            });

            if (pendingAssignments.length === 0) {
                logger.debug(`[ProfileMessaging] No pending assignments for device ${deviceId}`);
                return 0;
            }

            logger.info(`[ProfileMessaging] Found ${pendingAssignments.length} pending assignment(s) for device ${deviceId}`);

            // Import config mapper
            const { mapToConfigPayload } = await import('$lib/utils/mappers/deviceProfileMapper');

            // Send each pending profile
            for (const assignment of pendingAssignments) {
                if (assignment.profile) {
                    const config = mapToConfigPayload(assignment.profile as any);

                    await this.sendConfigToDevice(
                        deviceId,
                        config,
                        assignment.profileId,
                        {
                            userId: 'system' // Automatic sends use 'system' as userId
                        }
                    );
                }
            }

            logger.info(`[ProfileMessaging] Sent ${pendingAssignments.length} pending profile(s) to device ${deviceId}`);
            return pendingAssignments.length;

        } catch (error) {
            logger.error(`[ProfileMessaging] Error sending pending assignments to device ${deviceId}:`, error as any);
            return 0; // Return 0 on error, don't throw
        }
    }
}

