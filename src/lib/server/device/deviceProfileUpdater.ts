/**
 * Shared Device Profile Update Utilities
 * 
 * This module provides reusable functions for updating device profiles
 * and sending updates to devices.
 */

import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { deviceProfileSchema } from './deviceProfileLoader';
import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';
import { ProfileMessagingService } from './profile/ProfileMessagingService';

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
 * Send updated profile configuration to device via MQTT queue
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
        const config = mapToConfigPayload(updatedProfile as any);

        // Use ProfileMessagingService to send via MQTT queue
        const messagingService = new ProfileMessagingService(prisma);

        const result = await messagingService.sendConfigToDevice(
            deviceId,
            config,
            profileId,
            {
                userId: 'system' // Legacy updates use system user
            }
        );

        if (result.success) {
            logger.info(`[DeviceProfileUpdater] Profile update message sent to device ${deviceId} via MQTT`, {
                deviceId,
                profileId,
                logId: result.logId,
                configKeys: Object.keys(config)
            });
        } else {
            logger.error(`[DeviceProfileUpdater] Failed to send profile update to device ${deviceId}:`, result.error);
        }
    } catch (error) {
        logger.error(`[DeviceProfileUpdater] Error sending profile update message to device ${deviceId}:`, error as any);
        // Don't throw - profile was updated successfully even if message sending failed
    }
}

/**
 * Send device profile configuration to device via MQTT queue
 * 
 * This is a generic service function that can be used from multiple places:
 * - Device registration (after preclaim)
 * - Device connection (pending profiles)
 * - Profile updates
 * 
 * @param deviceId - Device ID to send profile to
 * @param profile - Device profile object with settings included
 * @param options - Optional configuration
 * @returns Promise that resolves with logId when message is sent (or null on failure)
 */
export async function sendDeviceProfileConfig(
    deviceId: string,
    profile: any,
    options?: {
        delay?: number; // Optional delay in milliseconds before sending
        prisma?: any; // Prisma client (required for ProfileMessagingService)
        userId?: string; // User ID for action log
    }
): Promise<string | null> {
    if (!options?.prisma) {
        logger.error(`[DeviceProfileUpdater] sendDeviceProfileConfig called without prisma client for device ${deviceId}`);
        return null;
    }

    const sendProfile = async (): Promise<string | null> => {
        try {
            // Map profile to config payload
            const config = mapToConfigPayload(profile);
            
            // Use ProfileMessagingService to send via MQTT queue
            const messagingService = new ProfileMessagingService(options.prisma);

            const result = await messagingService.sendConfigToDevice(
                deviceId,
                config,
                profile.id,
                {
                    userId: options.userId || 'system',
                    delay: undefined // Delay is handled at outer level
                }
            );

            if (result.success) {
                logger.info(`[DeviceProfileUpdater] Profile config sent to device ${deviceId} via MQTT`, {
                    deviceId,
                    profileId: profile.id,
                    logId: result.logId,
                    configKeys: Object.keys(config)
                });
                return result.logId;
            } else {
                logger.error(`[DeviceProfileUpdater] Failed to send profile config to device ${deviceId}:`, result.error);
                return null;
            }
        } catch (error) {
            logger.error(`[DeviceProfileUpdater] Error sending profile config to device ${deviceId}:`, error as any);
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
        // Use ProfileMessagingService which has a dedicated method for this
        const messagingService = new ProfileMessagingService(prisma);

        const count = await messagingService.sendPendingAssignments(deviceId);
        
        if (count > 0) {
            logger.info(`[DeviceProfileUpdater] Sent ${count} pending profile(s) to device ${deviceId} via MQTT`);
        }
    } catch (error) {
        logger.error(`[DeviceProfileUpdater] Error sending pending profiles to device ${deviceId}:`, error as any);
        // Don't throw - allow caller to handle gracefully
    }
}

