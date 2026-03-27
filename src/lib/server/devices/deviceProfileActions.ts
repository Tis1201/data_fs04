/**
 * Device Profile Actions
 * 
 * Handles all device-level profile configuration logic:
 * - Building settings arrays from form data
 * - Saving custom (DEVICE-level) profiles
 * - Assigning global profiles to devices
 * - Comparing settings before/after updates
 * - Triggering reapply when config changes
 * 
 * Extracted from deviceActions.ts for maintainability.
 */

import { logger } from '$lib/server/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfileSetting {
    key: string;
    value: string;
    dataType: string;
    label: string;
}

export interface SaveCustomProfileResult {
    success: boolean;
    profileId: string | null;
    error?: string;
}

export interface AssignGlobalProfileResult {
    success: boolean;
    profileId: string;
}

// ─── Form Data → Settings Mapping ────────────────────────────────────────────

/**
 * Map of camelCase form field names to [snake_case_key, label, dataType].
 * Central definition used by buildSettingsArray.
 */
const FORM_TO_SETTING_MAP: Record<string, [string, string, string]> = {
    kioskLockMode:             ['kiosk_lock_mode',             'Kiosk Lock Mode',             'boolean'],
    exitLockdownPassword:      ['exit_lockdown_password',      'Exit Lockdown Password',      'string'],
    kioskApplication:          ['kiosk_application',           'Kiosk Application',           'string'],
    displayResolution:         ['display_resolution',          'Display Resolution',          'string'],
    screenOrientation:         ['screen_orientation',          'Screen Orientation',          'string'],
    brightnessLevel:           ['brightness_level',            'Brightness Level',            'number'],
    audioEnabled:              ['enable_audio',                'Audio Enabled',               'boolean'],
    audioVolume:               ['volume_level',                'Audio Volume',                'number'],
    timezone:                  ['timezone',                    'Timezone',                    'string'],
    homeLauncher:              ['home_launcher',               'Home Launcher',               'string'],
    powerManagementSchedule:   ['power_management_schedule',   'Power Management Schedule',   'boolean'],
    powerOnDatetime:           ['power_on_datetime',           'Power On Datetime',           'string'],
    powerOffDatetime:          ['power_off_datetime',          'Power Off Datetime',          'string'],
    rebootSchedule:            ['reboot_schedule_enabled',     'Reboot Schedule',             'boolean'],
    rebootFrequency:           ['reboot_schedule_frequency',   'Reboot Frequency',            'string'],
    rebootDay:                 ['reboot_schedule_day',         'Reboot Day',                  'string'],
    rebootTime:                ['reboot_schedule_time',        'Reboot Time',                 'string'],
    downloadSchedule:          ['download_schedule_enabled',   'Download Schedule',           'boolean'],
    downloadFrequency:         ['download_schedule_frequency', 'Download Frequency',          'string'],
    downloadDay:               ['download_schedule_day',       'Download Day',                'string'],
    downloadTime:              ['download_schedule_time',      'Download Time',               'string'],
};

/**
 * Build a settings array from form data for creating/updating a DEVICE-level profile.
 * Maps form fields to { key, value, dataType, label } entries.
 */
export function buildSettingsArray(data: FormData): ProfileSetting[] {
    const settings: ProfileSetting[] = [];

    for (const [formKey, [settingKey, label, dt]] of Object.entries(FORM_TO_SETTING_MAP)) {
        const raw = data.get(formKey)?.toString();
        if (raw !== null && raw !== undefined) {
            let value = raw;
            if (dt === 'boolean') {
                value = raw === 'true' ? 'enabled' : 'disabled';
            }
            settings.push({ key: settingKey, value, dataType: dt, label });
        }
    }

    return settings;
}

// ─── Settings Comparison ─────────────────────────────────────────────────────

export async function getCurrentProfileSettings(prisma: any, deviceId: string): Promise<Record<string, string>> {
    const { loadDeviceProfile } = await import('$lib/server/device/deviceProfileLoader');
    const loaded = await loadDeviceProfile(prisma, deviceId);
    if (!loaded?.settings?.length) {
        return {};
    }
    const settingsMap: Record<string, string> = {};
    for (const setting of loaded.settings as { key: string; value: string }[]) {
        settingsMap[setting.key] = setting.value ?? '';
    }
    return settingsMap;
}

/**
 * Compare two settings maps and return true if they differ.
 */
export function settingsChanged(before: Record<string, string>, after: Record<string, string>): boolean {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
        if (before[key] !== after[key]) {
            return true;
        }
    }
    return false;
}

// ─── Save Custom (DEVICE-level) Profile ──────────────────────────────────────

/**
 * Save a custom device-level profile from form data.
 * Creates or updates a DEVICE-level profile and points the assignment to it.
 * Never modifies any GLOBAL profile.
 */
export async function saveCustomProfile(
    prisma: any,
    deviceId: string,
    data: FormData,
    userId: string
): Promise<SaveCustomProfileResult> {
    const deviceRecord = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { name: true, accountId: true }
    });

    if (!deviceRecord?.accountId) {
        return { success: false, profileId: null, error: 'Device has no account. Cannot save device configuration.' };
    }

    const settingsToSave = buildSettingsArray(data);

    // Find existing DEVICE-level profile for this device
    let deviceProfile = await prisma.deviceProfile.findFirst({
        where: { deviceId, level: 'DEVICE' }
    });

    if (deviceProfile) {
        // Update existing DEVICE-level profile settings
        await prisma.deviceProfileSetting.deleteMany({
            where: { profileId: deviceProfile.id }
        });
        await prisma.deviceProfileSetting.createMany({
            data: settingsToSave.map((s, i) => ({
                profileId: deviceProfile!.id,
                key: s.key,
                value: s.value,
                dataType: s.dataType || 'string',
                label: s.label || s.key,
                order: i
            }))
        });
        await prisma.deviceProfile.update({
            where: { id: deviceProfile.id },
            data: { updatedBy: userId, updatedAt: new Date() }
        });
        logger.info('[deviceProfileActions] Updated DEVICE-level profile', {
            deviceId,
            profileId: deviceProfile.id,
            settingCount: settingsToSave.length
        });
    } else {
        // Create new DEVICE-level profile
        deviceProfile = await prisma.deviceProfile.create({
            data: {
                name: `${deviceRecord.name || 'Device'} Config`,
                description: 'Auto-created device-specific configuration',
                level: 'DEVICE',
                deviceId,
                accountId: deviceRecord.accountId,
                createdBy: userId,
                settings: {
                    create: settingsToSave.map((s, i) => ({
                        key: s.key,
                        value: s.value,
                        dataType: s.dataType || 'string',
                        label: s.label || s.key,
                        order: i
                    }))
                }
            }
        });
        logger.info('[deviceProfileActions] Created new DEVICE-level profile', {
            deviceId,
            profileId: deviceProfile.id,
            settingCount: settingsToSave.length
        });
    }

    // Ensure assignment points to the DEVICE-level profile (makes it the active config)
    await prisma.deviceProfileAssignment.upsert({
        where: { deviceId },
        update: {
            profileId: deviceProfile.id,
            assignedBy: userId,
            assignedAt: new Date()
        },
        create: {
            deviceId,
            profileId: deviceProfile.id,
            assignedBy: userId
        }
    });

    // Clear any old overrides (not needed with DEVICE-level profile)
    await prisma.deviceProfileOverride.deleteMany({
        where: { deviceId }
    });

    logger.info('[deviceProfileActions] Device config saved to DEVICE-level profile (active)', {
        deviceId,
        profileId: deviceProfile.id
    });

    return { success: true, profileId: deviceProfile.id };
}

export async function saveDeviceLevelProfileOnly(
    prisma: any,
    deviceId: string,
    data: FormData,
    userId: string
): Promise<SaveCustomProfileResult> {
    const deviceRecord = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { name: true, accountId: true }
    });

    if (!deviceRecord?.accountId) {
        return { success: false, profileId: null, error: 'Device has no account. Cannot save device configuration.' };
    }

    const settingsToSave = buildSettingsArray(data);

    let deviceProfile = await prisma.deviceProfile.findFirst({
        where: { deviceId, level: 'DEVICE' }
    });

    if (deviceProfile) {
        await prisma.deviceProfileSetting.deleteMany({
            where: { profileId: deviceProfile.id }
        });
        await prisma.deviceProfileSetting.createMany({
            data: settingsToSave.map((s, i) => ({
                profileId: deviceProfile!.id,
                key: s.key,
                value: s.value,
                dataType: s.dataType || 'string',
                label: s.label || s.key,
                order: i
            }))
        });
        await prisma.deviceProfile.update({
            where: { id: deviceProfile.id },
            data: { updatedBy: userId, updatedAt: new Date() }
        });
        logger.info('[deviceProfileActions] Updated DEVICE-level profile (assignment unchanged)', {
            deviceId,
            profileId: deviceProfile.id,
            settingCount: settingsToSave.length
        });
    } else {
        deviceProfile = await prisma.deviceProfile.create({
            data: {
                name: `${deviceRecord.name || 'Device'} Config`,
                description: 'Auto-created device-specific configuration',
                level: 'DEVICE',
                deviceId,
                accountId: deviceRecord.accountId,
                createdBy: userId,
                settings: {
                    create: settingsToSave.map((s, i) => ({
                        key: s.key,
                        value: s.value,
                        dataType: s.dataType || 'string',
                        label: s.label || s.key,
                        order: i
                    }))
                }
            }
        });
        logger.info('[deviceProfileActions] Created DEVICE-level profile (assignment unchanged)', {
            deviceId,
            profileId: deviceProfile.id,
            settingCount: settingsToSave.length
        });
    }

    await prisma.deviceProfileOverride.deleteMany({
        where: { deviceId }
    });

    // If there is no assignment at all, create one pointing to this device-level profile
    // so that reapplyIfChanged can send the config to the device via MQTT.
    const existingAssignment = await prisma.deviceProfileAssignment.findUnique({
        where: { deviceId }
    });
    if (!existingAssignment) {
        await prisma.deviceProfileAssignment.create({
            data: { deviceId, profileId: deviceProfile.id, assignedBy: userId }
        });
        logger.info('[deviceProfileActions] Created assignment to DEVICE-level profile (no prior assignment)', {
            deviceId,
            profileId: deviceProfile.id
        });
    }

    return { success: true, profileId: deviceProfile.id };
}

// ─── Assign Global Profile ───────────────────────────────────────────────────

/**
 * Copy all settings from a GLOBAL profile into this device's auto-created DEVICE-level profile.
 * Creates the DEVICE profile if missing. Overwrites previous device-level setting rows.
 */
export async function syncDeviceLevelProfileFromGlobalTemplate(
    prisma: any,
    deviceId: string,
    globalProfileId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const globalProfile = await prisma.deviceProfile.findFirst({
        where: { id: globalProfileId, level: 'GLOBAL' },
        include: {
            settings: {
                orderBy: { order: 'asc' }
            }
        }
    });

    if (!globalProfile) {
        return { success: false, error: 'Global profile not found.' };
    }

    const deviceRecord = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { name: true, accountId: true }
    });

    if (!deviceRecord?.accountId) {
        return { success: false, error: 'Device has no account.' };
    }

    const sourceSettings = (globalProfile.settings || []) as Array<{
        key: string;
        value: string;
        dataType: string;
        label: string;
        category?: string | null;
        order: number;
    }>;

    let deviceProfile = await prisma.deviceProfile.findFirst({
        where: { deviceId, level: 'DEVICE' }
    });

    const rows = sourceSettings.map((s, i) => ({
        key: s.key,
        value: s.value ?? '',
        dataType: s.dataType || 'string',
        label: s.label || s.key,
        category: s.category ?? null,
        order: typeof s.order === 'number' ? s.order : i
    }));

    if (deviceProfile) {
        await prisma.deviceProfileSetting.deleteMany({
            where: { profileId: deviceProfile.id }
        });
        if (rows.length > 0) {
            await prisma.deviceProfileSetting.createMany({
                data: rows.map((r) => ({
                    profileId: deviceProfile!.id,
                    key: r.key,
                    value: r.value,
                    dataType: r.dataType,
                    label: r.label,
                    category: r.category,
                    order: r.order
                }))
            });
        }
        await prisma.deviceProfile.update({
            where: { id: deviceProfile.id },
            data: { updatedBy: userId, updatedAt: new Date() }
        });
    } else {
        deviceProfile = await prisma.deviceProfile.create({
            data: {
                name: `${deviceRecord.name || 'Device'} Config`,
                description: 'Auto-created device-specific configuration',
                level: 'DEVICE',
                deviceId,
                accountId: deviceRecord.accountId,
                createdBy: userId,
                ...(rows.length > 0
                    ? {
                          settings: {
                              create: rows.map((r) => ({
                                  key: r.key,
                                  value: r.value,
                                  dataType: r.dataType,
                                  label: r.label,
                                  category: r.category,
                                  order: r.order
                              }))
                          }
                      }
                    : {})
            }
        });
    }

    logger.info('[deviceProfileActions] Synced DEVICE-level profile from GLOBAL template', {
        deviceId,
        globalProfileId,
        deviceProfileId: deviceProfile.id,
        settingCount: rows.length
    });

    return { success: true };
}

/**
 * Assign a profile to a device (typically GLOBAL).
 * When the assigned profile is GLOBAL, DEVICE-level settings are replaced with a copy of that template.
 */
export async function assignGlobalProfile(
    prisma: any,
    deviceId: string,
    profileId: string,
    userId: string
): Promise<AssignGlobalProfileResult> {
    const meta = await prisma.deviceProfile.findUnique({
        where: { id: profileId },
        select: { level: true }
    });

    await prisma.deviceProfileAssignment.upsert({
        where: { deviceId },
        update: {
            profileId,
            assignedBy: userId,
            assignedAt: new Date()
        },
        create: {
            deviceId,
            profileId,
            assignedBy: userId
        }
    });

    await prisma.deviceProfileOverride.deleteMany({
        where: { deviceId }
    });

    if (meta?.level === 'GLOBAL') {
        const syncResult = await syncDeviceLevelProfileFromGlobalTemplate(prisma, deviceId, profileId, userId);
        if (!syncResult.success) {
            logger.warn(
                `[deviceProfileActions] assignGlobalProfile: sync to DEVICE-level failed for device ${deviceId}: ${syncResult.error}`
            );
        }
    }

    logger.info(`[deviceProfileActions] Assigned profile ${profileId} to device ${deviceId} (level=${meta?.level ?? 'unknown'})`);

    return { success: true, profileId };
}

// ─── Reapply Profile to Device ───────────────────────────────────────────────

/**
 * Bump DeviceProfile.updatedAt (via @updatedAt) after a successful manual reapply so
 * effective-config rules that compare GLOBAL vs DEVICE updatedAt prefer the template.
 */
export async function touchDeviceProfileAfterReapply(
    prisma: any,
    profileId: string,
    userId: string
): Promise<void> {
    await prisma.deviceProfile.update({
        where: { id: profileId },
        data: { updatedBy: userId }
    });
    logger.info('[deviceProfileActions] Profile timestamp bumped after reapply', { profileId, userId });
}

/**
 * If profile settings changed, send the updated config to the device.
 * Compares before/after snapshots and only sends if there's a difference.
 */
export async function reapplyIfChanged(
    prisma: any,
    deviceId: string,
    settingsBefore: Record<string, string>,
    settingsAfter: Record<string, string>,
    userId: string
): Promise<void> {
    const configChanged = settingsChanged(settingsBefore, settingsAfter);

    if (!configChanged) {
        logger.info('[deviceProfileActions] Profile config unchanged, skipping reapply', { deviceId });
        return;
    }

    logger.info('[deviceProfileActions] Profile config changed, triggering reapply', {
        deviceId,
        settingsBefore: Object.keys(settingsBefore).length,
        settingsAfter: Object.keys(settingsAfter).length
    });

    const currentAssignment = await prisma.deviceProfileAssignment.findUnique({
        where: { deviceId },
        select: {
            profileId: true,
            profile: {
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                    level: true
                }
            }
        }
    });

    if (!currentAssignment?.profile) {
        logger.info('[deviceProfileActions] No profile assigned after update, skipping reapply', { deviceId });
        return;
    }

    if (!currentAssignment.profile.isActive) {
        logger.info('[deviceProfileActions] Profile is inactive, skipping reapply', { deviceId, profileId: currentAssignment.profileId });
        return;
    }

    try {
        const { loadDeviceProfile } = await import('$lib/server/device/deviceProfileLoader');
        const effective = await loadDeviceProfile(prisma, deviceId);
        if (!effective?.settings?.length) {
            logger.info('[deviceProfileActions] No effective settings to reapply', { deviceId });
            return;
        }

        await prisma.deviceProfileAssignment.update({
            where: { deviceId },
            data: { status: 'APPLYING', lastSyncAt: new Date() }
        });

        const { ProfileMessagingService } = await import('$lib/server/device/profile/ProfileMessagingService');
        const { mapToConfigPayload } = await import('$lib/utils/mappers/deviceProfileMapper');

        const messagingService = new ProfileMessagingService(prisma);
        const configPayload = mapToConfigPayload({
            id: currentAssignment.profileId,
            name: effective.name || currentAssignment.profile.name,
            settings: effective.settings as any
        });

        const result = await messagingService.sendConfigToDevice(
            deviceId,
            configPayload,
            currentAssignment.profileId,
            { userId }
        );

        if (result.success) {
            logger.info('[deviceProfileActions] Reapply sent to device successfully', {
                deviceId,
                profileId: currentAssignment.profileId,
                logId: result.logId
            });
        } else {
            logger.warn('[deviceProfileActions] Failed to send reapply to device', {
                deviceId,
                profileId: currentAssignment.profileId,
                error: result.error
            });
        }
    } catch (reapplyErr) {
        logger.warn('[deviceProfileActions] Error sending reapply to device', {
            deviceId,
            error: reapplyErr
        });
    }
}
