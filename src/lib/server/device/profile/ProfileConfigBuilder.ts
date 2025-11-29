/**
 * ProfileConfigBuilder
 * 
 * Builds effective device configuration by merging global profiles
 * with device-specific overrides.
 */

import { logger } from '$lib/server/logger';
import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';

export interface EffectiveConfig {
    [key: string]: {
        value: any;
        dataType: string;
        label: string;
        category: string | null;
        isOverridden: boolean; // True if this setting is customized for the device
    };
}

export interface ConfigMetadata {
    profileId: string;
    profileName: string;
    hasOverrides: boolean;
    overrideCount: number;
}

export class ProfileConfigBuilder {
    constructor(private prisma: any) {}

    /**
     * Build effective configuration for a device
     * Merges global profile with device-specific overrides
     * 
     * @param deviceId - Device ID to build config for
     * @returns Effective configuration with override indicators
     */
    async buildEffectiveConfig(deviceId: string): Promise<{
        config: EffectiveConfig;
        metadata: ConfigMetadata;
    }> {
        try {
            // 1. Get device's profile assignment (should reference global profile)
            const assignment = await this.prisma.deviceProfileAssignment.findUnique({
                where: { deviceId },
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

            if (!assignment || !assignment.profile) {
                throw new Error(`No profile assigned to device ${deviceId}`);
            }

            const globalProfile = assignment.profile;

            // 2. Check for device-specific overrides
            const override = await this.prisma.deviceProfileOverride.findUnique({
                where: {
                    deviceId_globalProfileId: {
                        deviceId: deviceId,
                        globalProfileId: globalProfile.id
                    }
                },
                include: {
                    overriddenSettings: true
                }
            });

            // 3. Build base config from global profile
            const config: EffectiveConfig = {};
            
            for (const setting of globalProfile.settings) {
                config[setting.key] = {
                    value: setting.value,
                    dataType: setting.dataType,
                    label: setting.label,
                    category: setting.category,
                    isOverridden: false // Default to not overridden
                };
            }

            // 4. Apply overrides
            let overrideCount = 0;
            if (override?.overriddenSettings) {
                for (const overriddenSetting of override.overriddenSettings) {
                    if (config[overriddenSetting.key]) {
                        config[overriddenSetting.key].value = overriddenSetting.value;
                        config[overriddenSetting.key].isOverridden = true;
                        overrideCount++;
                    } else {
                        // Override for setting that no longer exists in global
                        logger.warn(`[ProfileConfigBuilder] Override for non-existent setting ${overriddenSetting.key} on device ${deviceId}`);
                    }
                }
            }

            // 5. Build metadata
            const metadata: ConfigMetadata = {
                profileId: globalProfile.id,
                profileName: globalProfile.name,
                hasOverrides: overrideCount > 0,
                overrideCount: overrideCount
            };

            logger.debug(`[ProfileConfigBuilder] Built effective config for device ${deviceId}`, {
                deviceId,
                profileId: globalProfile.id,
                totalSettings: Object.keys(config).length,
                overrideCount
            });

            return { config, metadata };

        } catch (error) {
            logger.error(`[ProfileConfigBuilder] Failed to build config for device ${deviceId}:`, error as any);
            throw error;
        }
    }

    /**
     * Build config from global profile only (no overrides)
     * 
     * @param profile - Global profile with settings
     * @returns Configuration object for device
     */
    buildFromGlobal(profile: any): Record<string, any> {
        try {
            const config = mapToConfigPayload(profile);

            logger.debug(`[ProfileConfigBuilder] Built config from global profile`, {
                profileId: profile.id,
                configKeys: Object.keys(config).length
            });

            return config;

        } catch (error) {
            logger.error(`[ProfileConfigBuilder] Failed to build config from global profile:`, error as any);
            throw error;
        }
    }

    /**
     * Compare settings to identify what needs to be overridden
     * 
     * @param globalSettings - Settings from global profile
     * @param newSettings - New settings from user input
     * @returns Array of settings that differ from global
     */
    identifyOverrides(
        globalSettings: Array<{ key: string; value: string; dataType: string }>,
        newSettings: Record<string, any>
    ): Array<{ key: string; value: string; dataType: string }> {
        const overrides: Array<{ key: string; value: string; dataType: string }> = [];
        
        const globalMap = new Map(
            globalSettings.map(s => [s.key, { value: s.value, dataType: s.dataType }])
        );

        for (const [key, newValue] of Object.entries(newSettings)) {
            const globalSetting = globalMap.get(key);
            
            if (!globalSetting) {
                logger.warn(`[ProfileConfigBuilder] Setting ${key} not found in global profile`);
                continue;
            }

            // Convert both to string for comparison (all values stored as strings in DB)
            const globalValueStr = String(globalSetting.value);
            const newValueStr = String(newValue);

            // Only include if different from global
            if (globalValueStr !== newValueStr) {
                overrides.push({
                    key: key,
                    value: newValueStr,
                    dataType: globalSetting.dataType
                });
            }
        }

        logger.debug(`[ProfileConfigBuilder] Identified ${overrides.length} override(s)`, {
            totalSettings: newSettings ? Object.keys(newSettings).length : 0,
            overrideCount: overrides.length,
            overrideKeys: overrides.map(o => o.key)
        });

        return overrides;
    }
}

