/**
 * Shared Device Profile Update Utilities
 * 
 * This module provides reusable functions for updating device profiles
 * and sending updates to devices.
 */

import type { PrismaClient } from '@prisma/client';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { logger } from '$lib/server/logger';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { deviceProfileSchema } from './deviceProfileLoader';
import { getMessageRelay } from '$lib/server/pushpin/middleware';
import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';
import { ActionLogger } from '$lib/server/action-logger';
import crypto from 'crypto';

export interface ProfileUpdateResult {
    success: boolean;
    message: string;
}

/**
 * Update a device-level profile
 * 
 * @param prisma - Prisma client instance
 * @param deviceId - Device ID
 * @param formData - Form data from request
 * @param userId - User ID performing the update
 * @returns Success/failure result
 */
export async function updateDeviceProfile(
    prisma: any,
    deviceId: string,
    formData: FormData,
    userId: string
): Promise<ProfileUpdateResult | ReturnType<typeof fail>> {
    // Validate form
    const form = await superValidate(formData, zod(deviceProfileSchema));
    
    if (!form.valid) {
        console.error('[DeviceProfileUpdater] Profile update form validation failed:', form.errors);
        return fail(400, { form });
    }

    // Parse settings from JSON string
    let settingsArray: any[] = [];
    try {
        settingsArray = JSON.parse(form.data.settings || '[]');
    } catch (e) {
        console.error('[DeviceProfileUpdater] Error parsing settings JSON:', e);
        return fail(400, { message: 'Invalid settings JSON' });
    }

    try {
        // Convert settings array to key-value map
        const settingsMap: Record<string, any> = {};
        for (const setting of settingsArray) {
            settingsMap[setting.key] = setting.value;
        }

        // Check if device has a DEVICE-level profile (backward compatibility)
        // @ts-ignore - deviceId will be available after schema migration
        const deviceLevelProfile = await prisma.deviceProfile.findFirst({
            // @ts-ignore - deviceId will be available after schema migration
            where: {
                deviceId: deviceId,
                level: 'DEVICE'
            },
            include: {
                settings: true
            }
        });

        if (deviceLevelProfile) {
            // Legacy: Update DEVICE-level profile directly
            await prisma.$transaction(async (tx: any) => {
                // Update profile
                await tx.deviceProfile.update({
                    where: { id: deviceLevelProfile.id },
                    data: {
                        name: form.data.name,
                        description: form.data.description || null,
                        updatedBy: userId
                    }
                });

                // Delete existing settings
                await tx.deviceProfileSetting.deleteMany({
                    where: { profileId: deviceLevelProfile.id }
                });

                // Create new settings
                if (settingsArray.length > 0) {
                    await tx.deviceProfileSetting.createMany({
                        data: settingsArray.map((setting: any, index: number) => ({
                            profileId: deviceLevelProfile.id,
                            key: setting.key,
                            value: String(setting.value || ''),
                            dataType: setting.dataType,
                            label: setting.label,
                            category: setting.category || 'General',
                            order: setting.order !== undefined ? setting.order : index
                        }))
                    });
                }
            });

            // Send updated profile to device
            await sendProfileUpdateToDevice(prisma, deviceId, deviceLevelProfile.id);

            logger.info(`[DeviceProfileUpdater] DEVICE-level profile ${deviceLevelProfile.id} updated for device ${deviceId}`);

            return {
                success: true,
                message: 'Device profile updated successfully'
            };
        } else {
            // New override model: Use DeviceProfileService to create/update overrides
            const { DeviceProfileService } = await import('./profile/DeviceProfileService');
            const profileService = new DeviceProfileService(prisma);

            const result = await profileService.updateDeviceSettings(
                deviceId,
                settingsMap,
                userId
            );

            if (!result.success) {
                return fail(500, { message: result.error || 'Failed to update device settings' });
            }

            logger.info(`[DeviceProfileUpdater] Device settings updated with ${result.overrideCount} override(s) for device ${deviceId}`);

            return {
                success: true,
                message: result.overrideCount > 0 
                    ? `Device settings updated (${result.overrideCount} customization${result.overrideCount === 1 ? '' : 's'})`
                    : 'Device settings reset to global defaults'
            };
        }
    } catch (error) {
        logger.error('[DeviceProfileUpdater] Failed to update device profile:', error as any);
        return fail(500, { message: 'Failed to update device profile' });
    }
}

/**
 * Send updated profile configuration to device via SSE
 * 
 * @param prisma - Prisma client instance
 * @param deviceId - Device ID
 * @param profileId - Profile ID
 */
async function sendProfileUpdateToDevice(
    prisma: any,
    deviceId: string,
    profileId: string
) {
    try {
        // Fetch updated profile with settings
        const updatedProfile = await prisma.deviceProfile.findUnique({
            where: { id: profileId },
            include: {
                settings: true
            }
        });

        if (!updatedProfile) {
            logger.warn(`[DeviceProfileUpdater] Profile ${profileId} not found after update`);
            return;
        }

        // Map profile to config payload
        const { mapToConfigPayload } = await import('$lib/utils/mappers/deviceProfileMapper');
        const config = mapToConfigPayload(updatedProfile as any);

        // Send config update to device
        const routingMessage = MessageFactory.createSystemMessage(
            'device:actionRequest',
            `subscription:device:${deviceId}`,
            {
                action: 'applyProfile',
                deviceId: deviceId,
                profileId: profileId,
                config: config,
                sentAt: new Date().toISOString()
            },
            SystemUser,
            { echoToSender: false }
        );

        await publisher.publish(routingMessage);
        
        logger.info(`[DeviceProfileUpdater] Profile update message sent to device ${deviceId}`, {
            deviceId,
            profileId,
            configKeys: Object.keys(config)
        });
    } catch (error) {
        logger.error(`[DeviceProfileUpdater] Error sending profile update message to device ${deviceId}:`, error as any);
        // Don't throw - profile was updated successfully even if message sending failed
    }
}

/**
 * Send device profile configuration to device via Redis Pub/Sub or publisher fallback
 * 
 * This is a generic service function that can be used from multiple places:
 * - Device registration (after preclaim)
 * - Device connection (pending profiles)
 * - Profile updates
 * 
 * @param deviceId - Device ID to send profile to
 * @param profile - Device profile object with settings included
 * @param options - Optional configuration
 * @returns Promise that resolves when message is sent (or fails silently)
 */
export async function sendDeviceProfileConfig(
    deviceId: string,
    profile: any,
    options?: {
        delay?: number; // Optional delay in milliseconds before sending
        prisma?: any; // Prisma client for creating action log
        userId?: string; // User ID for action log
    }
): Promise<string | null> {
    const sendProfile = async (): Promise<string | null> => {
        try {
            // Create action log if prisma and userId are provided
            let logId: string | null = null;
            if (options?.prisma && options?.userId) {
                const requestId = crypto.randomUUID();
                try {
                    const actionLog = await ActionLogger.createInitiated({
                        deviceId: deviceId,
                        actionType: 'config_update',
                        initiatedBy: options.userId,
                        requestId: requestId,
                        metadata: {
                            action: 'applyProfile',
                            profileId: profile.id,
                            profileName: profile.name
                        },
                        initialMessage: `Applying profile: ${profile.name}`
                    });
                    logId = actionLog.id;
                    logger.info(`[DeviceProfileService] ActionLog created for device ${deviceId}`, {
                        deviceId,
                        profileId: profile.id,
                        logId
                    });
                } catch (logError) {
                    logger.error(`[DeviceProfileService] Error creating ActionLog: ${String(logError)}`);
                    // Continue even if log creation fails
                }
            }
            
            // Map profile to config payload
            const config = mapToConfigPayload(profile);
            
            // Get message relay for Redis Pub/Sub (preferred method)
            const messageRelay = getMessageRelay();
            
            if (messageRelay) {
                // Use Redis Pub/Sub for scalable device messaging
                const message = {
                    type: 'device:actionRequest',
                    payload: {
                        action: 'applyProfile',
                        deviceId: deviceId,
                        profileId: profile.id,
                        logId: logId ?? undefined, // Include logId if available
                        requestId: logId ?? undefined, // Use logId as requestId for consistency
                        config: config,
                        sentAt: new Date().toISOString()
                    },
                    timestamp: new Date().toISOString()
                };
                
                await messageRelay.publishToDevice(deviceId, message);
                
                logger.info(`[DeviceProfileService] Profile config sent to device ${deviceId} via Redis Pub/Sub`, {
                    deviceId,
                    profileId: profile.id,
                    logId,
                    configKeys: Object.keys(config)
                });
            } else {
                // Fallback to publisher system for backward compatibility
                logger.warn(`[DeviceProfileService] MessageRelay not initialized - using publisher fallback for device ${deviceId}`);
                
                const routingMessage = MessageFactory.createSystemMessage(
                    'device:actionRequest',
                    `subscription:device:${deviceId}`,
                    {
                        action: 'applyProfile',
                        deviceId: deviceId,
                        profileId: profile.id,
                        logId: logId ?? undefined,
                        requestId: logId ?? undefined,
                        config: config,
                        sentAt: new Date().toISOString()
                    },
                    SystemUser,
                    { echoToSender: false }
                );
                
                await publisher.publish(routingMessage);
                
                logger.info(`[DeviceProfileService] Profile config sent to device ${deviceId} via publisher`, {
                    deviceId,
                    profileId: profile.id,
                    logId,
                    configKeys: Object.keys(config)
                });
            }
            
            return logId;
        } catch (error) {
            logger.error(`[DeviceProfileService] Error sending profile config to device ${deviceId}:`, error as any);
            // Don't throw - allow caller to handle gracefully
            return null;
        }
    };
    
    // Apply delay if specified
    if (options?.delay && options.delay > 0) {
        return new Promise((resolve) => {
            setTimeout(async () => {
                resolve(await sendProfile());
            }, options.delay);
        });
    } else {
        return await sendProfile();
    }
}

/**
 * Send pending profile assignments to device when it connects
 * 
 * Checks for any APPLYING status profile assignments and sends them to the device.
 * This is typically called when a device connects to ensure it receives any
 * profiles that were assigned while it was offline.
 * 
 * @param prisma - Prisma client instance
 * @param deviceId - Device ID to check and send profiles for
 * @returns Promise that resolves when all pending profiles are sent
 */
export async function sendPendingProfileAssignments(
    prisma: any,
    deviceId: string
): Promise<void> {
    try {
        const pendingAssignments = await prisma.deviceProfileAssignment.findMany({
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
            logger.debug(`[DeviceProfileService] No pending profile assignments for device ${deviceId}`);
            return;
        }

        logger.info(`[DeviceProfileService] Found ${pendingAssignments.length} pending profile assignment(s) for device ${deviceId}`);
        
        // Send each pending profile
        for (const assignment of pendingAssignments) {
            if (assignment.profile) {
                // Use 'system' as userId for automatic pending profile sends
                await sendDeviceProfileConfig(deviceId, assignment.profile, {
                    prisma: prisma,
                    userId: 'system'
                });
            }
        }
        
        logger.info(`[DeviceProfileService] Sent ${pendingAssignments.length} pending profile(s) to device ${deviceId}`);
    } catch (error) {
        logger.error(`[DeviceProfileService] Error sending pending profiles to device ${deviceId}:`, error as any);
        // Don't throw - allow caller to handle gracefully
    }
}

