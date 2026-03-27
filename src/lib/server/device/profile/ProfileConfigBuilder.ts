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
                logger.info(`[ProfileConfigBuilder] No profile assigned to device ${deviceId} — returning empty config`);
                return {
                    config: {} as EffectiveConfig,
                    metadata: {
                        profileId: '',
                        profileName: '',
                        hasOverrides: false,
                        overrideCount: 0
                    }
                };
            }

            const globalProfile = assignment.profile;

            // Inactive profiles must not be applied — return empty config
            if (!globalProfile.isActive) {
                logger.info(`[ProfileConfigBuilder] Profile ${globalProfile.id} is inactive — returning empty config for device ${deviceId}`);
                return {
                    config: {} as EffectiveConfig,
                    metadata: {
                        profileId: globalProfile.id,
                        profileName: globalProfile.name,
                        hasOverrides: false,
                        overrideCount: 0
                    }
                };
            }

            if (globalProfile.level === 'GLOBAL') {
                const deviceLevelProfile = await this.prisma.deviceProfile.findFirst({
                    where: { deviceId, level: 'DEVICE' },
                    include: {
                        settings: {
                            orderBy: { order: 'asc' }
                        }
                    }
                });
                if (
                    deviceLevelProfile?.isActive &&
                    new Date(deviceLevelProfile.updatedAt).getTime() > new Date(globalProfile.updatedAt).getTime()
                ) {
                    const config: EffectiveConfig = {};
                    for (const setting of deviceLevelProfile.settings) {
                        config[setting.key] = {
                            value: setting.value,
                            dataType: setting.dataType,
                            label: setting.label,
                            category: setting.category,
                            isOverridden: false
                        };
                    }
                    return {
                        config,
                        metadata: {
                            profileId: globalProfile.id,
                            profileName: globalProfile.name,
                            hasOverrides: false,
                            overrideCount: 0
                        }
                    };
                }
            }

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

            // 4. Apply overrides (including keys not in global profile — device-only overrides)
            let overrideCount = 0;
            const appliedKeys: string[] = [];
            const addedKeys: string[] = [];
            if (override?.overriddenSettings) {
                logger.info(`[ProfileConfigBuilder] Applying overrides for device ${deviceId}`, {
                    overriddenSettingKeys: override.overriddenSettings.map((s: any) => s.key),
                    count: override.overriddenSettings.length
                });
                for (const overriddenSetting of override.overriddenSettings) {
                    if (config[overriddenSetting.key]) {
                        config[overriddenSetting.key].value = overriddenSetting.value;
                        config[overriddenSetting.key].isOverridden = true;
                        overrideCount++;
                        appliedKeys.push(overriddenSetting.key);
                    } else {
                        // Key not in global profile: add to config so effective config includes it
                        config[overriddenSetting.key] = {
                            value: overriddenSetting.value,
                            dataType: overriddenSetting.dataType || 'string',
                            label: overriddenSetting.key,
                            category: null,
                            isOverridden: true
                        };
                        overrideCount++;
                        addedKeys.push(overriddenSetting.key);
                    }
                }
                logger.info(`[ProfileConfigBuilder] Overrides applied`, {
                    deviceId,
                    overrideCount,
                    appliedKeys,
                    addedKeysNotInProfile: addedKeys
                });
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

        const skippedNotInProfile: string[] = [];
        for (const [key, newValue] of Object.entries(newSettings)) {
            const globalSetting = globalMap.get(key);
            const newValueStr = String(newValue ?? '');

            if (!globalSetting) {
                // Key not in global profile: still save as override so device-specific values persist (e.g. schedule keys)
                overrides.push({
                    key: key,
                    value: newValueStr,
                    dataType: 'string'
                });
                skippedNotInProfile.push(key);
                continue;
            }

            // Convert both to string for comparison (all values stored as strings in DB)
            const globalValueStr = String(globalSetting.value);

            // Only include if different from global
            if (globalValueStr !== newValueStr) {
                overrides.push({
                    key: key,
                    value: newValueStr,
                    dataType: globalSetting.dataType
                });
            }
        }

        logger.info(`[ProfileConfigBuilder] Identified ${overrides.length} override(s)`, {
            totalSettings: newSettings ? Object.keys(newSettings).length : 0,
            overrideCount: overrides.length,
            overrideKeys: overrides.map(o => o.key),
            keysNotInProfileIncluded: skippedNotInProfile.length,
            keysNotInProfile: skippedNotInProfile
        });

        return overrides;
    }
}

