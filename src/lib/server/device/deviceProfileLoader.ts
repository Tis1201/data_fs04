/**
 * Shared Device Profile Loading Utilities
 * 
 * This module provides reusable functions for loading and managing device profiles
 * across both admin and user routes.
 */

import type { PrismaClient } from '@prisma/client';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

/**
 * Device Profile Schema
 * Used for validating device profile form data
 */
export const deviceProfileSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    settings: z.string().optional().default('[]')
});

/**
 * Load device profile for a specific device
 * 
 * With Override Model:
 * 1. Get GLOBAL profile from assignment
 * 2. Get device-specific overrides (if any)
 * 3. Merge them to show effective configuration
 * 
 * Backward Compatibility:
 * - Still supports DEVICE-level profiles (old model)
 * 
 * @param prisma - Prisma client instance
 * @param deviceId - Device ID to load profile for
 * @returns Device profile with merged settings or null if not found
 */
export async function loadDeviceProfile(prisma: any, deviceId: string) {
    try {
        // Prefer assignment (global profile + overrides) over legacy DEVICE-level profile.
        // Assignment is the source of truth when it exists — ensures config saved via
        // DeviceProfileOverride (Custom + base profile) is displayed, not stale DEVICE-level.
        // Get GLOBAL profile from assignment (new override model)
        const assignment = await prisma.deviceProfileAssignment.findUnique({
            where: { deviceId },
            include: {
                profile: {
                    include: {
                        settings: {
                            orderBy: { order: 'asc' }
                        },
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!assignment?.profile) {
            // Fall back to DEVICE-level profile (legacy) when no assignment
            // @ts-ignore - deviceId will be available after schema migration
            const deviceLevelProfile = await prisma.deviceProfile.findFirst({
                // @ts-ignore - deviceId will be available after schema migration
                where: {
                    deviceId: deviceId,
                    level: 'DEVICE'
                },
                include: {
                    settings: {
                        orderBy: { order: 'asc' }
                    },
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (deviceLevelProfile) {
                if (!deviceLevelProfile.isActive) {
                    console.log('[DeviceProfileLoader] DEVICE-level profile is inactive — returning empty shell (TC-RDM-PR-0137)', {
                        profileId: deviceLevelProfile.id,
                        deviceId
                    });
                    return {
                        id: '',
                        name: '',
                        description: '',
                        level: 'NONE',
                        isActive: true,
                        settings: [],
                        hasOverrides: false,
                        overrideCount: 0,
                        account: null
                    };
                }
                console.log('[DeviceProfileLoader] Found DEVICE-level profile (legacy, no assignment)', {
                    profileId: deviceLevelProfile.id,
                    deviceId
                });
                return deviceLevelProfile;
            }

            console.log('[DeviceProfileLoader] No profile found for device — returning empty shell for device-level config', { deviceId });
            // Return an empty "shell" profile so the configuration form renders.
            // The device can save its own config even without a global profile.
            return {
                id: '',
                name: '',
                description: '',
                level: 'NONE',
                isActive: true,
                settings: [],
                hasOverrides: false,
                overrideCount: 0,
                account: null
            };
        }

        const globalProfile = assignment.profile;

        // TC-RDM-PR-0137: Inactive profile configuration must not be applied to device.
        // When profile is inactive, return empty shell so UI shows no effective config (defaults).
        if (!globalProfile.isActive) {
            console.log('[DeviceProfileLoader] Profile is inactive — returning empty config for device', {
                profileId: globalProfile.id,
                deviceId
            });
            return {
                id: globalProfile.id,
                name: globalProfile.name,
                description: globalProfile.description || '',
                level: 'GLOBAL',
                isActive: false,
                settings: [],
                hasOverrides: false,
                overrideCount: 0,
                account: globalProfile.account
            };
        }

        // Check for device-specific overrides
        const override = await prisma.deviceProfileOverride.findUnique({
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

        // Merge global settings with overrides
        const globalKeys = new Set((globalProfile.settings as any[]).map((s: any) => s.key));
        const effectiveSettings = (globalProfile.settings as any[]).map((setting: any) => {
            const overrideSetting = override?.overriddenSettings.find(
                (os: any) => os.key === setting.key
            );

            return {
                ...setting,
                value: overrideSetting ? overrideSetting.value : setting.value,
                isOverridden: !!overrideSetting
            };
        });

        // Include override-only keys (e.g. schedule keys not in global profile) so UI shows them after save/refresh
        if (override?.overriddenSettings?.length) {
            for (const os of override.overriddenSettings) {
                if (!globalKeys.has(os.key)) {
                    effectiveSettings.push({
                        key: os.key,
                        value: os.value,
                        dataType: (os as any).dataType || 'string',
                        label: (os as any).label ?? os.key,
                        category: (os as any).category ?? null,
                        order: effectiveSettings.length,
                        isOverridden: true
                    });
                }
            }
        }

        // Return profile with merged settings
        const profileWithOverrides = {
            ...globalProfile,
            settings: effectiveSettings,
            hasOverrides: !!override,
            overrideCount: override?.overriddenSettings?.length || 0
        };

        console.log('[DeviceProfileLoader] Found GLOBAL profile with overrides', {
            profileId: globalProfile.id,
            deviceId,
            hasOverrides: !!override,
            overrideCount: override?.overriddenSettings?.length || 0,
            effectiveSettingKeys: effectiveSettings.map((s: any) => s.key)
        });

        return profileWithOverrides;
    } catch (error) {
        console.error('[DeviceProfileLoader] Error loading device profile:', error);
        return null;
    }
}

/**
 * Initialize superform for device profile editing
 * 
 * With Override Model:
 * - Creates form for GLOBAL profiles (edits create overrides)
 * - Still supports DEVICE-level profiles (backward compatibility)
 * 
 * @param deviceProfile - Device profile to create form for
 * @returns Superform instance or null
 */
export async function initializeDeviceProfileForm(deviceProfile: any) {
    if (!deviceProfile) {
        console.log('[DeviceProfileLoader] Not creating form - no profile');
        return null;
    }

    // Support GLOBAL (with overrides), DEVICE-level profiles, and NONE (no profile yet — device-only config)
    const isEditable = deviceProfile.level === 'DEVICE' || deviceProfile.level === 'GLOBAL' || deviceProfile.level === 'NONE';
    
    if (!isEditable) {
        console.log('[DeviceProfileLoader] Not creating form - profile level not supported');
        return null;
    }

    console.log('[DeviceProfileLoader] Creating form for profile', {
        profileId: deviceProfile.id,
        level: deviceProfile.level,
        hasOverrides: deviceProfile.hasOverrides || false
    });

    try {
        const form = await superValidate({
            name: deviceProfile.name,
            description: deviceProfile.description || '',
            settings: JSON.stringify(deviceProfile.settings || [])
        }, zod(deviceProfileSchema));

        console.log('[DeviceProfileLoader] Device profile form created successfully');
        return form;
    } catch (error) {
        console.error('[DeviceProfileLoader] Error creating device profile form:', error);
        return null;
    }
}

/**
 * Combined loader function - loads profile and initializes form
 * 
 * @param prisma - Prisma client instance
 * @param deviceId - Device ID to load profile for
 * @returns Object with deviceProfile and deviceProfileForm
 */
export async function loadDeviceProfileWithForm(prisma: PrismaClient, deviceId: string) {
    const deviceProfile = await loadDeviceProfile(prisma, deviceId);
    const deviceProfileForm = await initializeDeviceProfileForm(deviceProfile);

    return {
        deviceProfile,
        deviceProfileForm
    };
}

