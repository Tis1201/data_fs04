/**
 * DeviceProfileService
 * 
 * Core service for managing device profile assignments and overrides.
 * Handles CRUD operations for profiles and device-specific customizations.
 */

import { logger } from '$lib/server/logger';
import { ProfileConfigBuilder } from './ProfileConfigBuilder';
import { ProfileMessagingService } from './ProfileMessagingService';

export interface AssignProfileResult {
    success: boolean;
    assignmentId: string | null;
    error?: string;
}

export interface UpdateSettingsResult {
    success: boolean;
    overrideCount: number;
    error?: string;
}

export class DeviceProfileService {
    private configBuilder: ProfileConfigBuilder;
    private messagingService: ProfileMessagingService;

    constructor(private prisma: any) {
        this.configBuilder = new ProfileConfigBuilder(prisma);
        this.messagingService = new ProfileMessagingService(prisma);
    }

    /**
     * Assign a global profile to a device
     * Does NOT create a device-level copy - just creates the assignment
     * 
     * @param deviceId - Device ID to assign profile to
     * @param profileId - Global profile ID
     * @param userId - User performing the assignment
     * @returns Assignment result
     */
    async assignProfile(
        deviceId: string,
        profileId: string,
        userId: string
    ): Promise<AssignProfileResult> {
        try {
            // Verify profile exists and is GLOBAL
            const profile = await this.prisma.deviceProfile.findUnique({
                where: { id: profileId },
                select: { id: true, level: true, name: true }
            });

            if (!profile) {
                return {
                    success: false,
                    assignmentId: null,
                    error: 'Profile not found'
                };
            }

            if (profile.level !== 'GLOBAL') {
                return {
                    success: false,
                    assignmentId: null,
                    error: 'Can only assign GLOBAL profiles to devices'
                };
            }

            // Create or update assignment
            const assignment = await this.prisma.deviceProfileAssignment.upsert({
                where: { deviceId: deviceId },
                update: {
                    profileId: profileId,
                    assignedBy: userId,
                    status: 'PENDING', // Will be updated when device confirms
                    assignedAt: new Date()
                },
                create: {
                    deviceId: deviceId,
                    profileId: profileId,
                    assignedBy: userId,
                    status: 'PENDING'
                }
            });

            logger.info(`[DeviceProfileService] Profile assigned to device`, {
                deviceId,
                profileId,
                assignmentId: assignment.id,
                userId
            });

            return {
                success: true,
                assignmentId: assignment.id
            };

        } catch (error) {
            logger.error(`[DeviceProfileService] Failed to assign profile:`, error as any);
            return {
                success: false,
                assignmentId: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Update device-specific settings (create/update overrides)
     * Only saves settings that differ from the global profile
     * 
     * @param deviceId - Device ID
     * @param newSettings - New settings (key-value pairs)
     * @param userId - User performing the update
     * @returns Update result
     */
    async updateDeviceSettings(
        deviceId: string,
        newSettings: Record<string, any>,
        userId: string
    ): Promise<UpdateSettingsResult> {
        try {
            // 1. Get current assignment and global profile
            const assignment = await this.prisma.deviceProfileAssignment.findUnique({
                where: { deviceId },
                include: {
                    profile: {
                        include: {
                            settings: true
                        }
                    }
                }
            });

            if (!assignment || !assignment.profile) {
                return {
                    success: false,
                    overrideCount: 0,
                    error: 'No profile assigned to device'
                };
            }

            // 2. Identify which settings differ from global (includes keys not in profile)
            logger.info(`[DeviceProfileService] updateDeviceSettings called`, {
                deviceId,
                newSettingsKeys: Object.keys(newSettings),
                newSettingsKeyCount: Object.keys(newSettings).length,
                globalProfileSettingKeys: (assignment.profile.settings as any[]).map((s: any) => s.key)
            });
            const overrides = this.configBuilder.identifyOverrides(
                assignment.profile.settings,
                newSettings
            );
            logger.info(`[DeviceProfileService] identifyOverrides result`, {
                deviceId,
                overrideCount: overrides.length,
                overrideKeys: overrides.map(o => o.key)
            });

            // 3. Save or remove overrides
            if (overrides.length > 0) {
                // Device has customizations - create/update override record
                await this.prisma.deviceProfileOverride.upsert({
                    where: {
                        deviceId_globalProfileId: {
                            deviceId: deviceId,
                            globalProfileId: assignment.profileId
                        }
                    },
                    create: {
                        deviceId: deviceId,
                        globalProfileId: assignment.profileId,
                        createdBy: userId,
                        overriddenSettings: {
                            create: overrides.map(o => ({
                                key: o.key,
                                value: o.value,
                                dataType: o.dataType
                            }))
                        }
                    },
                    update: {
                        updatedBy: userId,
                        updatedAt: new Date(),
                        overriddenSettings: {
                            deleteMany: {}, // Clear old overrides
                            create: overrides.map(o => ({
                                key: o.key,
                                value: o.value,
                                dataType: o.dataType
                            }))
                        }
                    }
                });

                logger.info(`[DeviceProfileService] Saved ${overrides.length} override(s) for device ${deviceId}`, {
                    deviceId,
                    overrideKeys: overrides.map(o => o.key)
                });
            } else {
                // All settings match global - remove override record if it exists
                const deleted = await this.prisma.deviceProfileOverride.deleteMany({
                    where: {
                        deviceId: deviceId,
                        globalProfileId: assignment.profileId
                    }
                });

                if (deleted.count > 0) {
                    logger.info(`[DeviceProfileService] Removed overrides for device ${deviceId} (all settings match global)`);
                }
            }

            // 4. Send updated config to device
            const { config } = await this.configBuilder.buildEffectiveConfig(deviceId);
            const simpleConfig = Object.entries(config).reduce((acc, [key, setting]) => {
                acc[key] = setting.value;
                return acc;
            }, {} as Record<string, any>);

            await this.messagingService.sendConfigToDevice(
                deviceId,
                simpleConfig,
                assignment.profileId,
                { userId }
            );

            return {
                success: true,
                overrideCount: overrides.length
            };

        } catch (error) {
            logger.error(`[DeviceProfileService] Failed to update device settings:`, error as any);
            return {
                success: false,
                overrideCount: 0,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Reset device to global profile defaults (remove all overrides)
     * 
     * @param deviceId - Device ID
     * @param userId - User performing the reset
     * @returns Success status
     */
    async resetToGlobal(deviceId: string, userId: string): Promise<boolean> {
        try {
            const assignment = await this.prisma.deviceProfileAssignment.findUnique({
                where: { deviceId },
                select: { profileId: true }
            });

            if (!assignment) {
                logger.warn(`[DeviceProfileService] No assignment found for device ${deviceId}`);
                return false;
            }

            // Delete all overrides for this device
            const deleted = await this.prisma.deviceProfileOverride.deleteMany({
                where: {
                    deviceId: deviceId,
                    globalProfileId: assignment.profileId
                }
            });

            logger.info(`[DeviceProfileService] Reset device ${deviceId} to global profile defaults`, {
                deviceId,
                deletedOverrides: deleted.count
            });

            // Send global config to device
            const globalProfile = await this.prisma.deviceProfile.findUnique({
                where: { id: assignment.profileId },
                include: {
                    settings: {
                        orderBy: { order: 'asc' }
                    }
                }
            });

            if (globalProfile) {
                const config = this.configBuilder.buildFromGlobal(globalProfile);
                await this.messagingService.sendConfigToDevice(
                    deviceId,
                    config,
                    globalProfile.id,
                    { userId }
                );
            }

            return true;

        } catch (error) {
            logger.error(`[DeviceProfileService] Failed to reset device to global:`, error as any);
            return false;
        }
    }

    /**
     * Get device's effective configuration (for display)
     * 
     * @param deviceId - Device ID
     * @returns Effective config with override indicators
     */
    async getDeviceConfig(deviceId: string) {
        return await this.configBuilder.buildEffectiveConfig(deviceId);
    }

    /**
     * Check if device has any customizations
     * 
     * @param deviceId - Device ID
     * @returns True if device has overrides
     */
    async hasOverrides(deviceId: string): Promise<boolean> {
        const assignment = await this.prisma.deviceProfileAssignment.findUnique({
            where: { deviceId },
            select: { profileId: true }
        });

        if (!assignment) {
            return false;
        }

        const override = await this.prisma.deviceProfileOverride.findUnique({
            where: {
                deviceId_globalProfileId: {
                    deviceId: deviceId,
                    globalProfileId: assignment.profileId
                }
            },
            select: { id: true }
        });

        return !!override;
    }
}

