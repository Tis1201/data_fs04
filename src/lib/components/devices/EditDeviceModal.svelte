<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { Modal, InputField, Toggle, TabGroup, Dropdown, TextareaField, Button, Alert } from '$lib/design-system/components';
    import { DESCRIPTION_MAX, NAME_MAX } from '$lib/constants/description';
    import CharacterCount from '$lib/components/ui_components_sveltekit/form/CharacterCount.svelte';
    import type { TabItem } from '$lib/design-system/components/TabGroup.svelte';
    import { Eye, EyeOff } from 'lucide-svelte';
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
    import { timezoneOptions } from '$lib/utils/timezoneOptions';

    // ==========================================================================
    // TYPES
    // ==========================================================================
    
    interface AvailableTag {
        id: string;
        name: string;
    }

    interface DeviceProfile {
        id: string;
        name: string;
        description?: string;
        settings?: string;
    }

    interface DeviceData {
        id: string;
        name?: string;
        status?: 'ACTIVE' | 'INACTIVE';
        tags?: Array<{ id: string; tagId?: string }>;
        description?: string | null;
        profileId?: string | null;
        hasCustomOverrides?: boolean | string;
        kioskLockMode?: boolean | string;
        exitLockdownPassword?: string | null;
        kioskApplication?: string | null;
        displayResolution?: string | null;
        screenOrientation?: string | null;
        brightnessLevel?: number | string | null;
        audioEnabled?: boolean | string | null;
        audioVolume?: number | string | null;
        timezone?: string | null;
        homeLauncher?: string | null;
        powerManagementSchedule?: boolean | string | null;
        rebootSchedule?: boolean | string | null;
        downloadSchedule?: boolean | string | null;
    }

    // ==========================================================================
    // PROPS
    // ==========================================================================
    
    export let open: boolean = false;
    export let device: DeviceData | null = null;
    export let availableTags: AvailableTag[] = [];
    export let availableProfiles: DeviceProfile[] = [];
    export let saveActionUrl: string = '/user/iot/devices?/updateDevice';
    export let onSaveSuccess: (() => void) | null = null;
    export let onSaveError: ((error: string) => void) | null = null;

    // ==========================================================================
    // EVENTS
    // ==========================================================================
    
    const dispatch = createEventDispatcher<{
        close: void;
        save: { deviceId: string };
    }>();

    // ==========================================================================
    // STATE
    // ==========================================================================
    
    let editDeviceLoading = false;
    let editDeviceError: string | null = null;
    let editActiveTab = "details";
    let editProfileLoading = false;
    
    // Edit Device form state - Details tab
    let editDeviceName = "";
    let editDeviceActive = true;
    let editDeviceTags: string[] = [];
    let editDeviceDescription = "";
    
    // Edit Device form state - Configuration tab
    let editAssignedProfile = "";
    let editKioskLockMode = false;
    let editExitLockdownPassword = "";
    let editShowPassword = false;
    let editKioskApplication = "";
    let editDisplayResolution = "";
    let editScreenOrientation = "";
    let editBrightnessLevel = 100;
    let editAudioEnabled = true;
    let editAudioVolume = 100;
    let editTimezone = "";
    let editHomeLauncher = "";

    // Packages for Home/Launcher dropdown (same as AddEditProfileModal)
    interface PackageOption { id: string; label: string; }
    let availablePackages: PackageOption[] = [];
    let packagesLoading = false;

    async function loadAvailablePackages() {
        packagesLoading = true;
        try {
            const res = await fetch('/api/v2/resources/packages/all');
            if (!res.ok) throw new Error('Failed to load packages');
            const data = await res.json();
            const allPackages = data.data?.packages || [];
            availablePackages = allPackages.map((pkg: any) => ({
                id: pkg.packageName,
                label: pkg.displayName ? `${pkg.displayName} (${pkg.packageName})` : pkg.packageName
            }));
        } catch {
            availablePackages = [];
        } finally {
            packagesLoading = false;
        }
    }
    let editPowerManagementSchedule = false;
    let editPowerOnDatetime = "";
    let editPowerOffDatetime = "";
    let editRebootSchedule = false;
    let editRebootFrequency = "daily";
    let editRebootDay = "monday";
    let editRebootTime = "02:00";
    let editDownloadSchedule = false;
    let editDownloadFrequency = "daily";
    let editDownloadDay = "monday";
    let editDownloadTime = "03:00";
    let hasCustomOverrides = false;
    let originalProfileId: string | null = null;

    // Schedule options from availableSettings (same as admin device-profiles edit)
    $: frequencyOptions = (() => {
        const def = availableSettings.find((s: { key: string }) => s.key === 'reboot_schedule_frequency');
        if (def?.options) return def.options.map((o: { value: string; label: string }) => ({ id: o.value, label: o.label }));
        return [{ id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }];
    })();
    // Reboot day: weekly = day of week (monday..sunday), monthly = day of month (1-31)
    $: rebootDayOptions = (() => {
        if (editRebootFrequency === 'monthly') {
            return Array.from({ length: 31 }, (_, i) => {
                const n = i + 1;
                const mod10 = n % 10, mod100 = n % 100;
                const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
                return { id: String(n), label: `${n}${suffix}` };
            });
        }
        const def = availableSettings.find((s: { key: string }) => s.key === 'reboot_schedule_day');
        if (def?.options) return def.options.map((o: { value: string; label: string }) => ({ id: o.value, label: o.label }));
        return [
            { id: 'monday', label: 'Monday' }, { id: 'tuesday', label: 'Tuesday' }, { id: 'wednesday', label: 'Wednesday' },
            { id: 'thursday', label: 'Thursday' }, { id: 'friday', label: 'Friday' }, { id: 'saturday', label: 'Saturday' },
            { id: 'sunday', label: 'Sunday' }
        ];
    })();
    // When switching to monthly, if current day is a weekday name, default to "1"
    $: if (editRebootFrequency === 'monthly' && rebootDayOptions.length && !rebootDayOptions.some((o: { id: string }) => o.id === editRebootDay)) {
        editRebootDay = '1';
    }
    // When switching to weekly, if current day is numeric (from monthly), default to "monday"
    $: if (editRebootFrequency === 'weekly' && /^\d+$/.test(String(editRebootDay))) {
        editRebootDay = 'monday';
    }

    // Download day: weekly = day of week (monday..sunday), monthly = day of month (1-31) — same as Reboot
    $: downloadDayOptions = (() => {
        if (editDownloadFrequency === 'monthly') {
            return Array.from({ length: 31 }, (_, i) => {
                const n = i + 1;
                const mod10 = n % 10, mod100 = n % 100;
                const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
                return { id: String(n), label: `${n}${suffix}` };
            });
        }
        const def = availableSettings.find((s: { key: string }) => s.key === 'download_schedule_day');
        if (def?.options) return def.options.map((o: { value: string; label: string }) => ({ id: o.value, label: o.label }));
        return [
            { id: 'monday', label: 'Monday' }, { id: 'tuesday', label: 'Tuesday' }, { id: 'wednesday', label: 'Wednesday' },
            { id: 'thursday', label: 'Thursday' }, { id: 'friday', label: 'Friday' }, { id: 'saturday', label: 'Saturday' },
            { id: 'sunday', label: 'Sunday' }
        ];
    })();
    // When switching to monthly, if current day is a weekday name, default to "1"
    $: if (editDownloadFrequency === 'monthly' && downloadDayOptions.length && !downloadDayOptions.some((o: { id: string }) => o.id === editDownloadDay)) {
        editDownloadDay = '1';
    }
    // When switching to weekly, if current day is numeric (from monthly), default to "monday"
    $: if (editDownloadFrequency === 'weekly' && /^\d+$/.test(String(editDownloadDay))) {
        editDownloadDay = 'monday';
    }

    // Edit Device tabs
    const editDeviceTabs: TabItem[] = [
        { id: 'details', label: 'Details' },
        { id: 'configuration', label: 'Configuration' }
    ];

    // Computed: Tag options for Edit Device modal
    $: editTagOptions = availableTags.map((t) => ({ id: t.id, label: t.name, type: 'checkbox' as const }));

    // Profile options - Custom is NOT included by default
    $: profileOptions = availableProfiles.map((p) => ({ 
        id: p.id, 
        label: p.name || 'Unnamed Profile', 
        supportingText: p.description || undefined 
    }));
    
    // Computed: Profile options with Custom (only when hasCustomOverrides is true)
    $: profileOptionsWithCustom = hasCustomOverrides 
        ? [
            { id: '__CUSTOM__', label: 'Custom', supportingText: 'Device-specific custom settings' },
            ...profileOptions
          ]
        : profileOptions;

    // Build dropdown options from availableSettings
    $: displayResolutionOptions = (() => {
        const setting = availableSettings.find(s => s.key === 'display_resolution');
        if (setting?.options) {
            return setting.options.map((opt: any) => ({
                id: opt.value,
                label: opt.label
            }));
        }
        return [];
    })();

    $: screenOrientationOptions = (() => {
        const setting = availableSettings.find(s => s.key === 'screen_orientation');
        if (setting?.options) {
            return setting.options.map((opt: any) => ({
                id: opt.value,
                label: opt.label
            }));
        }
        return [];
    })();

    // ==========================================================================
    // FUNCTIONS
    // ==========================================================================
    
    // Function to switch to Custom when user edits any config field
    function switchToCustom() {
        if ((editAssignedProfile && editAssignedProfile !== '__CUSTOM__' && editAssignedProfile !== '') 
            || originalProfileId) {
            if (!originalProfileId && editAssignedProfile && editAssignedProfile !== '__CUSTOM__') {
                originalProfileId = editAssignedProfile;
            }
            editAssignedProfile = '__CUSTOM__';
            hasCustomOverrides = true;
        }
    }
    
    // Function to load profile settings and populate config fields
    async function loadProfileSettings(profileId: string, deviceData?: any, forceFromProfile: boolean = false) {
        if (!profileId || profileId === '__CUSTOM__') {
            const currentDeviceData = deviceData || device;
            editKioskLockMode = currentDeviceData?.kioskLockMode ?? false;
            editExitLockdownPassword = currentDeviceData?.exitLockdownPassword || "";
            editKioskApplication = currentDeviceData?.kioskApplication || "";
            const displayResolutionSetting = availableSettings.find(s => s.key === 'display_resolution');
            const screenOrientationSetting = availableSettings.find(s => s.key === 'screen_orientation');
            editDisplayResolution = currentDeviceData?.displayResolution || displayResolutionSetting?.defaultValue || "1920x1080";
            const currentOrientation = currentDeviceData?.screenOrientation ? String(currentDeviceData.screenOrientation).toLowerCase() : null;
            editScreenOrientation = currentOrientation || screenOrientationSetting?.defaultValue || "landscape";
            editBrightnessLevel = currentDeviceData?.brightnessLevel ?? 100;
            editAudioEnabled = currentDeviceData?.audioEnabled ?? true;
            editAudioVolume = currentDeviceData?.audioVolume ?? 100;
            editTimezone = currentDeviceData?.timezone || "Asia/Ho_Chi_Minh";
            editHomeLauncher = currentDeviceData?.homeLauncher || "";
            editPowerManagementSchedule = currentDeviceData?.powerManagementSchedule ?? false;
            editRebootSchedule = currentDeviceData?.rebootSchedule ?? false;
            editDownloadSchedule = currentDeviceData?.downloadSchedule ?? false;
            return;
        }

        editProfileLoading = true;
        try {
            const res = await fetch(`/user/iot/device-profiles/${profileId}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!res.ok) {
                console.warn('Failed to load profile settings, using defaults', res.status, res.statusText);
                return;
            }

            const profileData = await res.json();
            const settings: any[] = profileData?.profile?.settings || [];

            const settingsMap = new Map<string, any>();
            settings.forEach((s: any) => {
                settingsMap.set(s.key, s.value);
                const camelKey = s.key.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
                settingsMap.set(camelKey, s.value);
            });

            const effectiveDeviceData = forceFromProfile ? null : (deviceData || device);
            
            // Map settings to config fields
            const kioskLockModeValue = settingsMap.get('kiosk_lock_mode') || settingsMap.get('kioskLockMode');
            if (forceFromProfile) {
                editKioskLockMode = kioskLockModeValue !== undefined 
                    ? (kioskLockModeValue === 'enabled' || kioskLockModeValue === true)
                    : false;
            } else if (kioskLockModeValue !== undefined) {
                if (effectiveDeviceData?.kioskLockMode !== undefined && effectiveDeviceData?.kioskLockMode !== null) {
                    editKioskLockMode = effectiveDeviceData.kioskLockMode === 'enabled' || effectiveDeviceData.kioskLockMode === true || effectiveDeviceData.kioskLockMode === 'true';
                } else {
                    editKioskLockMode = kioskLockModeValue === 'enabled' || kioskLockModeValue === true;
                }
            }
            
            const exitLockdownPasswordValue = settingsMap.get('exit_lockdown_password') || settingsMap.get('exitLockdownPassword');
            if (forceFromProfile) {
                editExitLockdownPassword = exitLockdownPasswordValue !== undefined && exitLockdownPasswordValue !== '' 
                    ? String(exitLockdownPasswordValue) 
                    : "";
            } else if (exitLockdownPasswordValue !== undefined) {
                if (effectiveDeviceData?.exitLockdownPassword) {
                    editExitLockdownPassword = effectiveDeviceData.exitLockdownPassword;
                } else {
                    editExitLockdownPassword = exitLockdownPasswordValue !== '' ? String(exitLockdownPasswordValue) : "";
                }
            }
            
            const kioskApplicationValue = settingsMap.get('kiosk_application') || settingsMap.get('kioskApplication');
            if (forceFromProfile) {
                editKioskApplication = kioskApplicationValue !== undefined ? String(kioskApplicationValue) : "";
            } else {
                if (effectiveDeviceData?.kioskApplication !== undefined && effectiveDeviceData?.kioskApplication !== null && effectiveDeviceData?.kioskApplication !== '') {
                    editKioskApplication = effectiveDeviceData.kioskApplication;
                } else if (kioskApplicationValue !== undefined) {
                    editKioskApplication = String(kioskApplicationValue);
                }
            }
            
            const displayResolutionValue = settingsMap.get('display_resolution') || settingsMap.get('displayResolution');
            const displayResolutionDefault = availableSettings.find(s => s.key === 'display_resolution')?.defaultValue || "1920x1080";
            if (forceFromProfile) {
                editDisplayResolution = displayResolutionValue !== undefined && displayResolutionValue !== '' 
                    ? String(displayResolutionValue) 
                    : displayResolutionDefault;
            } else if (displayResolutionValue !== undefined) {
                if (effectiveDeviceData?.displayResolution) {
                    editDisplayResolution = effectiveDeviceData.displayResolution;
                } else {
                    editDisplayResolution = displayResolutionValue !== '' ? String(displayResolutionValue) : displayResolutionDefault;
                }
            }
            
            const screenOrientationValue = settingsMap.get('screen_orientation') || settingsMap.get('screenOrientation');
            const screenOrientationDefault = availableSettings.find(s => s.key === 'screen_orientation')?.defaultValue || "landscape";
            if (forceFromProfile) {
                const normalizedValue = screenOrientationValue !== undefined 
                    ? String(screenOrientationValue).toLowerCase() 
                    : screenOrientationDefault;
                editScreenOrientation = normalizedValue !== '' ? normalizedValue : screenOrientationDefault;
            } else if (screenOrientationValue !== undefined) {
                if (effectiveDeviceData?.screenOrientation) {
                    const normalizedValue = String(effectiveDeviceData.screenOrientation).toLowerCase();
                    editScreenOrientation = normalizedValue;
                } else {
                    const normalizedValue = String(screenOrientationValue).toLowerCase();
                    editScreenOrientation = normalizedValue !== '' ? normalizedValue : screenOrientationDefault;
                }
            }
            
            const brightnessLevelValue = settingsMap.get('brightness_level') || settingsMap.get('brightnessLevel');
            const brightnessLevelDefault = 100;
            if (forceFromProfile) {
                if (brightnessLevelValue !== undefined && brightnessLevelValue !== '') {
                    const numValue = typeof brightnessLevelValue === 'string' ? parseInt(brightnessLevelValue, 10) : Number(brightnessLevelValue);
                    editBrightnessLevel = !isNaN(numValue) ? numValue : brightnessLevelDefault;
                } else {
                    editBrightnessLevel = brightnessLevelDefault;
                }
            } else if (brightnessLevelValue !== undefined && brightnessLevelValue !== '') {
                if (effectiveDeviceData?.brightnessLevel !== undefined && effectiveDeviceData?.brightnessLevel !== null) {
                    const numValue = typeof effectiveDeviceData.brightnessLevel === 'string' ? parseInt(effectiveDeviceData.brightnessLevel, 10) : Number(effectiveDeviceData.brightnessLevel);
                    if (!isNaN(numValue)) {
                        editBrightnessLevel = numValue;
                    }
                } else {
                    const numValue = typeof brightnessLevelValue === 'string' ? parseInt(brightnessLevelValue, 10) : Number(brightnessLevelValue);
                    if (!isNaN(numValue)) {
                        editBrightnessLevel = numValue;
                    }
                }
            }
            
            const audioEnabledValue = settingsMap.get('enable_audio') || settingsMap.get('audioEnabled');
            if (forceFromProfile) {
                editAudioEnabled = audioEnabledValue !== undefined 
                    ? (audioEnabledValue === 'enabled' || audioEnabledValue === true)
                    : true;
            } else if (audioEnabledValue !== undefined) {
                if (effectiveDeviceData?.audioEnabled !== undefined && effectiveDeviceData?.audioEnabled !== null) {
                    editAudioEnabled = effectiveDeviceData.audioEnabled === 'enabled' || effectiveDeviceData.audioEnabled === true || effectiveDeviceData.audioEnabled === 'true';
                } else {
                    editAudioEnabled = audioEnabledValue === 'enabled' || audioEnabledValue === true;
                }
            }
            
            const audioVolumeValue = settingsMap.get('volume_level') || settingsMap.get('audioVolume');
            const audioVolumeDefault = 100;
            if (forceFromProfile) {
                if (audioVolumeValue !== undefined && audioVolumeValue !== '') {
                    const numValue = typeof audioVolumeValue === 'string' ? parseInt(audioVolumeValue, 10) : Number(audioVolumeValue);
                    editAudioVolume = !isNaN(numValue) ? numValue : audioVolumeDefault;
                } else {
                    editAudioVolume = audioVolumeDefault;
                }
            } else if (audioVolumeValue !== undefined && audioVolumeValue !== '') {
                if (effectiveDeviceData?.audioVolume !== undefined && effectiveDeviceData?.audioVolume !== null) {
                    const numValue = typeof effectiveDeviceData.audioVolume === 'string' ? parseInt(effectiveDeviceData.audioVolume, 10) : Number(effectiveDeviceData.audioVolume);
                    if (!isNaN(numValue)) {
                        editAudioVolume = numValue;
                    }
                } else {
                    const numValue = typeof audioVolumeValue === 'string' ? parseInt(audioVolumeValue, 10) : Number(audioVolumeValue);
                    if (!isNaN(numValue)) {
                        editAudioVolume = numValue;
                    }
                }
            }
            
            const timezoneValue = settingsMap.get('timezone');
            if (forceFromProfile) {
                editTimezone = timezoneValue !== undefined && timezoneValue !== '' 
                    ? String(timezoneValue) 
                    : "UTC";
            } else if (timezoneValue !== undefined && timezoneValue !== '') {
                if (effectiveDeviceData?.timezone) {
                    editTimezone = effectiveDeviceData.timezone;
                } else {
                    editTimezone = String(timezoneValue);
                }
            }
            
            const homeLauncherValue = settingsMap.get('home_launcher') || settingsMap.get('homeLauncher');
            if (forceFromProfile) {
                editHomeLauncher = homeLauncherValue !== undefined ? String(homeLauncherValue) : "";
            } else {
                if (effectiveDeviceData?.homeLauncher !== undefined && effectiveDeviceData?.homeLauncher !== null && effectiveDeviceData?.homeLauncher !== '') {
                    editHomeLauncher = effectiveDeviceData.homeLauncher;
                } else if (homeLauncherValue !== undefined) {
                    editHomeLauncher = String(homeLauncherValue);
                }
            }
            
            const powerManagementScheduleValue = settingsMap.get('power_management_schedule') || settingsMap.get('powerManagementSchedule');
            if (forceFromProfile) {
                editPowerManagementSchedule = powerManagementScheduleValue !== undefined 
                    ? (powerManagementScheduleValue === 'enabled' || powerManagementScheduleValue === true)
                    : false;
            } else if (powerManagementScheduleValue !== undefined) {
                if (effectiveDeviceData?.powerManagementSchedule !== undefined && effectiveDeviceData?.powerManagementSchedule !== null) {
                    editPowerManagementSchedule = effectiveDeviceData.powerManagementSchedule === 'enabled' || effectiveDeviceData.powerManagementSchedule === true || effectiveDeviceData.powerManagementSchedule === 'true';
                } else {
                    editPowerManagementSchedule = powerManagementScheduleValue === 'enabled' || powerManagementScheduleValue === true;
                }
            }
            
            const rebootScheduleValue = settingsMap.get('reboot_schedule_enabled') || settingsMap.get('rebootSchedule');
            if (forceFromProfile) {
                editRebootSchedule = rebootScheduleValue !== undefined 
                    ? (rebootScheduleValue === 'enabled' || rebootScheduleValue === true)
                    : false;
            } else if (rebootScheduleValue !== undefined) {
                if (effectiveDeviceData?.rebootSchedule !== undefined && effectiveDeviceData?.rebootSchedule !== null) {
                    editRebootSchedule = effectiveDeviceData.rebootSchedule === 'enabled' || effectiveDeviceData.rebootSchedule === true || effectiveDeviceData.rebootSchedule === 'true';
                } else {
                    editRebootSchedule = rebootScheduleValue === 'enabled' || rebootScheduleValue === true;
                }
            }
            
            const downloadScheduleValue = settingsMap.get('download_schedule_enabled') || settingsMap.get('downloadSchedule');
            if (forceFromProfile) {
                editDownloadSchedule = downloadScheduleValue !== undefined 
                    ? (downloadScheduleValue === 'enabled' || downloadScheduleValue === true)
                    : false;
            } else if (downloadScheduleValue !== undefined) {
                if (effectiveDeviceData?.downloadSchedule !== undefined && effectiveDeviceData?.downloadSchedule !== null) {
                    editDownloadSchedule = effectiveDeviceData.downloadSchedule === 'enabled' || effectiveDeviceData.downloadSchedule === true || effectiveDeviceData.downloadSchedule === 'true';
                } else {
                    editDownloadSchedule = downloadScheduleValue === 'enabled' || downloadScheduleValue === true;
                }
            }

            // Schedule sub-fields: power on/off datetime
            const powerOnValue = settingsMap.get('power_on_datetime') || settingsMap.get('powerOnDatetime');
            if (powerOnValue !== undefined && powerOnValue !== '') {
                editPowerOnDatetime = String(powerOnValue);
            }
            const powerOffValue = settingsMap.get('power_off_datetime') || settingsMap.get('powerOffDatetime');
            if (powerOffValue !== undefined && powerOffValue !== '') {
                editPowerOffDatetime = String(powerOffValue);
            }

            // Schedule sub-fields: reboot frequency, day, time
            const rebootFreqValue = settingsMap.get('reboot_schedule_frequency') || settingsMap.get('rebootFrequency');
            if (rebootFreqValue !== undefined && rebootFreqValue !== '') {
                editRebootFrequency = String(rebootFreqValue);
            }
            const rebootDayValue = settingsMap.get('reboot_schedule_day') || settingsMap.get('rebootDay');
            if (rebootDayValue !== undefined && rebootDayValue !== '') {
                editRebootDay = String(rebootDayValue);
            }
            const rebootTimeValue = settingsMap.get('reboot_schedule_time') || settingsMap.get('rebootTime');
            if (rebootTimeValue !== undefined && rebootTimeValue !== '') {
                editRebootTime = String(rebootTimeValue);
            }

            // Schedule sub-fields: download frequency, day, time
            const downloadFreqValue = settingsMap.get('download_schedule_frequency') || settingsMap.get('downloadFrequency');
            if (downloadFreqValue !== undefined && downloadFreqValue !== '') {
                editDownloadFrequency = String(downloadFreqValue);
            }
            const downloadDayValue = settingsMap.get('download_schedule_day') || settingsMap.get('downloadDay');
            if (downloadDayValue !== undefined && downloadDayValue !== '') {
                editDownloadDay = String(downloadDayValue);
            }
            const downloadTimeValue = settingsMap.get('download_schedule_time') || settingsMap.get('downloadTime');
            if (downloadTimeValue !== undefined && downloadTimeValue !== '') {
                editDownloadTime = String(downloadTimeValue);
            }
        } catch (error) {
            console.error('Error loading profile settings:', error);
        } finally {
            editProfileLoading = false;
        }
    }

    // Track last loaded device+open state to avoid unnecessary reloads
    let lastLoadedState: string | null = null;
    
    // Load packages when modal opens
    $: if (open) {
        loadAvailablePackages();
    }

    // Load device data when modal opens or device changes
    $: if (open && device) {
        const currentState = `${device.id}-${open}`;
        if (currentState !== lastLoadedState) {
            console.log('[EditDeviceModal] Modal state changed, loading device data for:', device.id);
            lastLoadedState = currentState;
            loadDeviceData();
        }
    }
    
    // Reset tracking when modal closes
    $: if (!open) {
        lastLoadedState = null;
    }

    async function loadDeviceData() {
        if (!device) return;
        
        editActiveTab = "details";
        editDeviceError = null;
        
        // Fetch full device details from API endpoint
        // Always fetch from API to get the latest configuration data
        let fullDeviceData: any = device;
        try {
            console.log('[EditDeviceModal] Fetching device data for:', device.id);
            const res = await fetch(`/user/iot/devices/${device.id}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                cache: 'no-cache' // Ensure we get fresh data
            });
            if (res.ok) {
                const result = await res.json();
                console.log('[EditDeviceModal] API response:', result);
                if (result?.success && result?.device) {
                    fullDeviceData = result.device;
                    console.log('[EditDeviceModal] Using API device data:', fullDeviceData);
                } else if (result?.device) {
                    // Handle case where response doesn't have success field
                    fullDeviceData = result.device;
                    console.log('[EditDeviceModal] Using API device data (no success field):', fullDeviceData);
                } else {
                    console.warn('[EditDeviceModal] API response missing device field, using prop device');
                }
            } else {
                const errorText = await res.text().catch(() => res.statusText);
                console.warn('[EditDeviceModal] API request failed:', res.status, errorText);
                // Fallback to device prop if API fails
                console.log('[EditDeviceModal] Falling back to device prop data');
            }
        } catch (error) {
            console.error('[EditDeviceModal] Error fetching device details:', error);
            // Fallback to device prop if fetch fails
            console.log('[EditDeviceModal] Falling back to device prop data due to error');
        }
        
        console.log('[EditDeviceModal] Final device data to use:', {
            id: fullDeviceData?.id,
            name: fullDeviceData?.name,
            profileId: fullDeviceData?.profileId,
            hasCustomOverrides: fullDeviceData?.hasCustomOverrides,
            kioskLockMode: fullDeviceData?.kioskLockMode,
            displayResolution: fullDeviceData?.displayResolution,
            screenOrientation: fullDeviceData?.screenOrientation
        });
        
        // Populate Details tab
        editDeviceName = fullDeviceData.name || "";
        editDeviceActive = fullDeviceData.status === 'ACTIVE';
        editDeviceTags = (fullDeviceData.tags || []).map((t: any) => t.id || t.tagId) || [];
        editDeviceDescription = (fullDeviceData.description !== null && fullDeviceData.description !== undefined) 
            ? fullDeviceData.description 
            : "";
        
        // Get profileId from API response
        const deviceProfileId = fullDeviceData.profileId || null;
        originalProfileId = deviceProfileId;
        hasCustomOverrides = fullDeviceData.hasCustomOverrides === true || fullDeviceData.hasCustomOverrides === 'true';
        
        console.log('[EditDeviceModal] Profile info:', {
            deviceProfileId,
            hasCustomOverrides,
            availableProfilesCount: availableProfiles.length,
            profileOptionsCount: profileOptions.length,
            fullDeviceDataKeys: Object.keys(fullDeviceData || {})
        });
        
        // Wait for modal to render and profileOptions to be ready
        await tick();
        
        // Set assigned profile AFTER modal is rendered and profileOptions are ready
        if (hasCustomOverrides && deviceProfileId) {
            console.log('[EditDeviceModal] Setting to CUSTOM profile');
            editAssignedProfile = '__CUSTOM__';
            originalProfileId = deviceProfileId;
            
            // Load effective config (device values with overrides)
            editKioskLockMode = fullDeviceData.kioskLockMode === 'enabled' || fullDeviceData.kioskLockMode === true || fullDeviceData.kioskLockMode === 'true';
            editExitLockdownPassword = fullDeviceData.exitLockdownPassword || "";
            editShowPassword = false;
            editKioskApplication = fullDeviceData.kioskApplication || "";
            const displayResolutionSetting = availableSettings.find(s => s.key === 'display_resolution');
            const screenOrientationSetting = availableSettings.find(s => s.key === 'screen_orientation');
            editDisplayResolution = fullDeviceData.displayResolution || displayResolutionSetting?.defaultValue || "1920x1080";
            const currentOrientation = fullDeviceData.screenOrientation ? String(fullDeviceData.screenOrientation).toLowerCase() : null;
            editScreenOrientation = currentOrientation || screenOrientationSetting?.defaultValue || "landscape";
            editBrightnessLevel = (() => {
                const v = fullDeviceData.brightnessLevel;
                if (v == null) return 100;
                const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
                return !isNaN(n) ? n : 100;
            })();
            editAudioEnabled = fullDeviceData.audioEnabled === 'enabled' || fullDeviceData.audioEnabled === true || fullDeviceData.audioEnabled === 'true';
            editAudioVolume = (() => {
                const v = fullDeviceData.audioVolume;
                if (v == null) return 100;
                const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
                return !isNaN(n) ? n : 100;
            })();
            editTimezone = fullDeviceData.timezone || "UTC";
            editHomeLauncher = fullDeviceData.homeLauncher || "";
            editPowerManagementSchedule = fullDeviceData.powerManagementSchedule === 'enabled' || fullDeviceData.powerManagementSchedule === true || fullDeviceData.powerManagementSchedule === 'true';
            editPowerOnDatetime = fullDeviceData.powerOnDatetime || '';
            editPowerOffDatetime = fullDeviceData.powerOffDatetime || '';
            editRebootSchedule = fullDeviceData.rebootSchedule === 'enabled' || fullDeviceData.rebootSchedule === true || fullDeviceData.rebootSchedule === 'true';
            editRebootFrequency = fullDeviceData.rebootFrequency || 'daily';
            editRebootDay = fullDeviceData.rebootDay || 'monday';
            editRebootTime = fullDeviceData.rebootTime || '02:00';
            editDownloadSchedule = fullDeviceData.downloadSchedule === 'enabled' || fullDeviceData.downloadSchedule === true || fullDeviceData.downloadSchedule === 'true';
            editDownloadFrequency = fullDeviceData.downloadFrequency || 'daily';
            editDownloadDay = fullDeviceData.downloadDay || 'monday';
            editDownloadTime = fullDeviceData.downloadTime || '03:00';
        } else if (deviceProfileId) {
            console.log('[EditDeviceModal] Setting assigned profile:', deviceProfileId);
            const profileIdString = String(deviceProfileId);
            
            // Wait for profileOptions to be ready
            let retryCount = 0;
            while (profileOptions.length === 0 && retryCount < 10) {
                await tick();
                retryCount++;
            }
            
            console.log('[EditDeviceModal] Profile options ready:', profileOptions.length, 'options');
            console.log('[EditDeviceModal] Available profile IDs:', profileOptions.map(p => p.id));
            
            // Verify profile exists in options before setting
            const profileExists = profileOptions.some(p => p.id === profileIdString);
            if (profileExists) {
                editAssignedProfile = profileIdString;
                originalProfileId = deviceProfileId;
                console.log('[EditDeviceModal] Profile found in options, setting to:', profileIdString);
                console.log('[EditDeviceModal] Loading profile settings for:', deviceProfileId, 'with device data:', fullDeviceData);
                // Pass fullDeviceData so loadProfileSettings can use device's effective config values
                await loadProfileSettings(String(deviceProfileId), fullDeviceData, false);
                console.log('[EditDeviceModal] Profile settings loaded');
            } else {
                console.warn('[EditDeviceModal] Profile not found in options:', profileIdString, 'Available:', profileOptions.map(p => p.id));
                // Still set it, dropdown might handle it
                editAssignedProfile = profileIdString;
                originalProfileId = deviceProfileId;
                await loadProfileSettings(String(deviceProfileId), fullDeviceData, false);
            }
        } else {
            console.log('[EditDeviceModal] No profile assigned, using defaults');
            editAssignedProfile = "";
            const displayResolutionSetting = availableSettings.find(s => s.key === 'display_resolution');
            const screenOrientationSetting = availableSettings.find(s => s.key === 'screen_orientation');
            editKioskLockMode = false;
            editExitLockdownPassword = "";
            editShowPassword = false;
            editKioskApplication = "";
            editDisplayResolution = displayResolutionSetting?.defaultValue || "1920x1080";
            editScreenOrientation = screenOrientationSetting?.defaultValue || "landscape";
            editBrightnessLevel = 100;
            editAudioEnabled = true;
            editAudioVolume = 100;
            editTimezone = "UTC";
            editHomeLauncher = "";
            editPowerManagementSchedule = false;
            editRebootSchedule = false;
            editDownloadSchedule = false;
        }
        
        console.log('[EditDeviceModal] Final state:', {
            editAssignedProfile,
            editDisplayResolution,
            editScreenOrientation,
            editKioskLockMode
        });
        
        await tick();
    }

    async function saveEditDevice() {
        if (!device) return;
        
        editDeviceLoading = true;
        editDeviceError = null;
        
        try {
            // Validate schedule sub-fields when toggles are enabled
            if (editPowerManagementSchedule) {
                if (!editPowerOnDatetime || !editPowerOffDatetime) {
                    throw new Error('Power Management Schedule is enabled. Please set both Power-On and Power-Off date/time.');
                }
            }
            if (editRebootSchedule) {
                if (!editRebootFrequency) {
                    throw new Error('Reboot Schedule is enabled. Please select a Reboot Frequency.');
                }
                if ((editRebootFrequency === 'weekly' || editRebootFrequency === 'monthly') && !editRebootDay) {
                    throw new Error(editRebootFrequency === 'monthly' ? 'Reboot Schedule is set to Monthly. Please select a day of the month.' : 'Reboot Schedule is set to Weekly. Please select a Reboot Day.');
                }
                if (!editRebootTime) {
                    throw new Error('Reboot Schedule is enabled. Please set a Reboot Time.');
                }
            }
            if (editDownloadSchedule) {
                if (!editDownloadFrequency) {
                    throw new Error('Download Schedule is enabled. Please select a Download Frequency.');
                }
                if ((editDownloadFrequency === 'weekly' || editDownloadFrequency === 'monthly') && !editDownloadDay) {
                    throw new Error(editDownloadFrequency === 'monthly' ? 'Download Schedule is set to Monthly. Please select a day of the month.' : 'Download Schedule is set to Weekly. Please select a Download Day.');
                }
                if (!editDownloadTime) {
                    throw new Error('Download Schedule is enabled. Please set a Download Time.');
                }
            }

            const fd = new FormData();
            fd.set('id', device.id);
            fd.set('name', editDeviceName || '');
            fd.set('status', editDeviceActive ? 'ACTIVE' : 'INACTIVE');
            fd.set('description', editDeviceDescription || '');
            fd.set('tags', JSON.stringify(editDeviceTags || []));
            
            // Determine if user is assigning a global profile or editing device's own config.
            // - editAssignedProfile is a profile ID = user selected a global profile from dropdown
            // - editAssignedProfile is '' or '__CUSTOM__' = user is editing device's own config
            const isAssigningGlobal = editAssignedProfile && editAssignedProfile !== '__CUSTOM__' && editAssignedProfile !== '';
            
            console.log('[EditDeviceModal] saveEditDevice: config payload', {
                editAssignedProfile: editAssignedProfile ?? '(empty)',
                originalProfileId: originalProfileId ?? '(empty)',
                isAssigningGlobal,
                deviceId: device.id
            });
            
            if (isAssigningGlobal) {
                // User selected a global profile — send profileId only (server assigns it, no device config saved)
                fd.set('profileId', String(editAssignedProfile));
            } else {
                // User is editing device's own config (no profile, or __CUSTOM__ after editing fields)
                fd.set('isCustom', 'true');
                // When Custom with a base profile (originalProfileId), send it so server uses DeviceProfileOverride
                if (originalProfileId && originalProfileId !== '__CUSTOM__') {
                    fd.set('profileId', String(originalProfileId));
                }
                // Always include all config fields so device can have its own settings
                fd.set('kioskLockMode', String(editKioskLockMode));
                if (editExitLockdownPassword) {
                    fd.set('exitLockdownPassword', editExitLockdownPassword);
                }
                fd.set('kioskApplication', editKioskApplication);
                fd.set('displayResolution', editDisplayResolution);
                fd.set('screenOrientation', editScreenOrientation);
                fd.set('brightnessLevel', String(editBrightnessLevel));
                fd.set('audioEnabled', String(editAudioEnabled));
                fd.set('audioVolume', String(editAudioVolume));
                fd.set('timezone', editTimezone);
                fd.set('homeLauncher', editHomeLauncher);
                fd.set('powerManagementSchedule', String(editPowerManagementSchedule));
                if (editPowerManagementSchedule) {
                    fd.set('powerOnDatetime', editPowerOnDatetime);
                    fd.set('powerOffDatetime', editPowerOffDatetime);
                }
                fd.set('rebootSchedule', String(editRebootSchedule));
                if (editRebootSchedule) {
                    fd.set('rebootFrequency', editRebootFrequency);
                    fd.set('rebootDay', editRebootDay);
                    fd.set('rebootTime', editRebootTime);
                }
                fd.set('downloadSchedule', String(editDownloadSchedule));
                if (editDownloadSchedule) {
                    fd.set('downloadFrequency', editDownloadFrequency);
                    fd.set('downloadDay', editDownloadDay);
                    fd.set('downloadTime', editDownloadTime);
                }
            }

            const formKeys = Array.from(fd.keys());
            console.log('[EditDeviceModal] saveEditDevice: posting to', saveActionUrl, 'with form keys:', formKeys.join(', '));
            const res = await fetch(saveActionUrl, { method: 'POST', body: fd });

            if (res.status >= 200 && res.status < 300) {
                try {
                    await res.json();
                } catch (e) {
                    // Non-JSON response is fine
                }
                if (onSaveSuccess) {
                    onSaveSuccess();
                }
                dispatch('save', { deviceId: device.id });
                open = false;
            } else {
                const payload = await res.json().catch(() => ({}));
                const errorMessage = payload?.error || payload?.message || payload?.data?.error || res.statusText;
                throw new Error(errorMessage || 'Failed to save device');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            editDeviceError = errorMsg;
            if (onSaveError) {
                onSaveError(errorMsg);
            }
        } finally {
            editDeviceLoading = false;
        }
    }

    function closeEditDeviceModal() {
        open = false;
        editDeviceError = null;
        dispatch('close');
    }

    // Handle profile change
    async function handleProfileChange(e: CustomEvent<string | string[]>) {
        const newProfileId = String(e.detail);
        const previousProfileId = editAssignedProfile;
        editAssignedProfile = newProfileId;
        
        if (newProfileId === '__CUSTOM__') {
            if (!originalProfileId && previousProfileId && previousProfileId !== '__CUSTOM__' && previousProfileId !== '') {
                originalProfileId = previousProfileId;
            }
            hasCustomOverrides = true;
        } else if (newProfileId && newProfileId !== '') {
            originalProfileId = newProfileId;
            hasCustomOverrides = false;
            
            // Reset all fields to defaults first
            const displayResolutionSetting = availableSettings.find(s => s.key === 'display_resolution');
            const screenOrientationSetting = availableSettings.find(s => s.key === 'screen_orientation');
            editKioskLockMode = false;
            editExitLockdownPassword = "";
            editShowPassword = false;
            editKioskApplication = "";
            editDisplayResolution = displayResolutionSetting?.defaultValue || "1920x1080";
            editScreenOrientation = screenOrientationSetting?.defaultValue || "landscape";
            editBrightnessLevel = 100;
            editAudioEnabled = true;
            editAudioVolume = 100;
            editTimezone = "UTC";
            editHomeLauncher = "";
            editPowerManagementSchedule = false;
            editPowerOnDatetime = "";
            editPowerOffDatetime = "";
            editRebootSchedule = false;
            editRebootFrequency = "daily";
            editRebootDay = "monday";
            editRebootTime = "02:00";
            editDownloadSchedule = false;
            editDownloadFrequency = "daily";
            editDownloadDay = "monday";
            editDownloadTime = "03:00";
            
            await loadProfileSettings(newProfileId, undefined, true);
        } else {
            originalProfileId = null;
            hasCustomOverrides = false;
        }
    }
</script>

<!-- Edit Device Modal (Figma) -->
<Modal
    open={open}
    title="Edit Device"
    size="lg"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={false}
    closeOnEscape={true}
    showFooter={true}
    on:close={closeEditDeviceModal}
>
    <!-- Device Name Row with Active Toggle aligned to input -->
    <div class="w-full" style="margin-bottom: var(--ds-space-6);">
        <div class="flex items-center gap-4">
            <div class="flex-1">
                <InputField
                    id="edit-device-name"
                    type="text"
                    label="Device Name"
                    placeholder="Enter device name"
                    bind:value={editDeviceName}
                    maxlength={NAME_MAX}
                    state={editDeviceError ? 'error' : 'default'}
                    helperText={editDeviceError || undefined}
                />
                <CharacterCount current={editDeviceName.length} max={NAME_MAX} />
            </div>
            <div class="flex items-center gap-2" style="padding-top: var(--ds-space-6);">
                <Toggle
                    bind:checked={editDeviceActive}
                    size="sm"
                />
                <span style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-text-primary);">
                    Active
                </span>
            </div>
        </div>
    </div>

    <!-- Tabs -->
    <div style="margin-bottom: var(--ds-space-6); width: 100%;">
        <TabGroup
            tabs={editDeviceTabs}
            bind:activeTab={editActiveTab}
            type="underline"
            size="sm"
        />
    </div>

    <!-- Tab Content -->
    {#if editActiveTab === 'details'}
        <!-- Details Tab -->
        <div class="flex flex-col" style="width: 100%; gap: var(--ds-space-6);">
            <!-- Tag Dropdown -->
            <Dropdown
                label="Tag"
                placeholder="Select tags"
                multiple={true}
                searchable={true}
                options={editTagOptions}
                value={editDeviceTags}
                on:change={(e) => editDeviceTags = Array.isArray(e.detail) ? e.detail : [e.detail]}
            />

            <!-- Description -->
            <TextareaField
                label="Description"
                placeholder="Enter device description"
                bind:value={editDeviceDescription}
                rows={4}
                maxlength={DESCRIPTION_MAX}
            />
            <CharacterCount current={editDeviceDescription?.length ?? 0} max={DESCRIPTION_MAX} />
        </div>
    {:else}
        <!-- Configuration Tab -->
        <div class="flex flex-col gap-4" style="width: 100%; max-height: 500px; overflow-y: auto;">
            
            <!-- Assigned Profile Dropdown (standalone) -->
            <Dropdown
                label="Assigned Profile"
                placeholder="Select"
                options={profileOptionsWithCustom}
                value={editAssignedProfile}
                clearable={false}
                on:change={handleProfileChange}
            />

            <!-- Block 1: Kiosk Settings -->
            <div class="config-block">
                <!-- Kiosk Lock Mode -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Kiosk Lock Mode</p>
                        <p class="config-description">Enable kiosk mode to lock the device interface</p>
                    </div>
                    <Toggle 
                        bind:checked={editKioskLockMode} 
                        size="sm"
                        on:change={() => switchToCustom()}
                    />
                </div>

                <!-- Exit Lockdown Password -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Exit Lockdown Password</p>
                        <p class="config-description">Password required to exit kiosk mode</p>
                    </div>
                    <div style="width: 200px;">
                        <div class="relative">
                            <InputField
                                type={editShowPassword ? 'text' : 'password'}
                                placeholder="******"
                                bind:value={editExitLockdownPassword}
                                on:change={() => switchToCustom()}
                            />
                            <button
                                type="button"
                                class="absolute right-3 top-1/2 -translate-y-1/2"
                                on:click={() => editShowPassword = !editShowPassword}
                                style="background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-center;"
                            >
                                {#if editShowPassword}
                                    <EyeOff size={20} style="color: var(--ds-text-secondary);" />
                                {:else}
                                    <Eye size={20} style="color: var(--ds-text-secondary);" />
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Kiosk Application -->
                <div class="flex items-center justify-between" style="padding: var(--ds-space-4) var(--ds-space-5);">
                    <div>
                        <p class="config-label">Kiosk Application</p>
                        <p class="config-description">Application to run in kiosk mode</p>
                    </div>
                    <div style="width: 200px;">
                        <InputField
                            placeholder="Enter app name or package"
                            bind:value={editKioskApplication}
                            on:change={() => switchToCustom()}
                        />
                    </div>
                </div>
            </div>

            <!-- Block 2: Display Settings -->
            <div class="config-block">
                <!-- Display Resolution -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Display Resolution</p>
                        <p class="config-description">Screen resolution for device</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={displayResolutionOptions}
                            value={editDisplayResolution}
                            on:change={(e) => {
                                editDisplayResolution = String(e.detail);
                                switchToCustom();
                            }}
                        />
                    </div>
                </div>

                <!-- Screen Orientation -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Screen Orientation</p>
                        <p class="config-description">Screen orientation preference</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={screenOrientationOptions}
                            value={editScreenOrientation}
                            on:change={(e) => {
                                editScreenOrientation = String(e.detail);
                                switchToCustom();
                            }}
                        />
                    </div>
                </div>

                <!-- Brightness Level -->
                <div class="config-row config-row-last">
                    <div>
                        <p class="config-label">Brightness Level</p>
                        <p class="config-description">Screen brightness level (0-100%)</p>
                    </div>
                    <div class="flex items-center gap-3" style="width: 280px;">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={editBrightnessLevel}
                            class="config-slider"
                            on:input={() => switchToCustom()}
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #525252 0%, #525252 {editBrightnessLevel}%, var(--ds-color-neutral-true-200) {editBrightnessLevel}%, var(--ds-color-neutral-true-200) 100%); border-radius: var(--ds-radius-sm); outline: none;"
                        />
                        <div class="config-slider-input-wrapper">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={editBrightnessLevel}
                                class="config-slider-input"
                                on:change={() => switchToCustom()}
                            />
                            <span class="config-slider-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 3: Audio Settings -->
            <div class="config-block">
                <!-- Audio -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Audio</p>
                        <p class="config-description">Enable or disable audio output</p>
                    </div>
                    <Toggle 
                        bind:checked={editAudioEnabled} 
                        size="sm"
                        on:change={() => switchToCustom()}
                    />
                </div>

                <!-- Audio Volume -->
                <div class="config-row config-row-last">
                    <div>
                        <p class="config-label">Audio Volume</p>
                        <p class="config-description">Audio volume level (0-100%)</p>
                    </div>
                    <div class="flex items-center gap-3" style="width: 280px;">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={editAudioVolume}
                            class="config-slider"
                            on:input={() => switchToCustom()}
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #525252 0%, #525252 {editAudioVolume}%, var(--ds-color-neutral-true-200) {editAudioVolume}%, var(--ds-color-neutral-true-200) 100%); border-radius: var(--ds-radius-sm); outline: none;"
                        />
                        <div class="config-slider-input-wrapper">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={editAudioVolume}
                                class="config-slider-input"
                                on:change={() => switchToCustom()}
                            />
                            <span class="config-slider-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 4: System Settings -->
            <div class="config-block">
                <!-- Timezone -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Timezone</p>
                        <p class="config-description">Device timezone settings</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={timezoneOptions}
                            value={editTimezone}
                            on:change={(e) => {
                                editTimezone = String(e.detail);
                                switchToCustom();
                            }}
                        />
                    </div>
                </div>

                <!-- Home/Launcher -->
                <div class="config-row config-row-last">
                    <div>
                        <p class="config-label">Home/ Launcher</p>
                        <p class="config-description">Default home screen launcher</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder={packagesLoading ? 'Loading...' : 'Select launcher'}
                            options={availablePackages}
                            value={editHomeLauncher}
                            disabled={packagesLoading}
                            on:change={(e) => { editHomeLauncher = String(e.detail ?? ''); switchToCustom(); }}
                        />
                    </div>
                </div>
            </div>

            <!-- Block 5: Schedule Settings -->
            <div class="config-block">
                <!-- Power Management Schedule -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Power Management Schedule</p>
                        <p class="config-description">Enable scheduled power on/off times</p>
                    </div>
                    <Toggle 
                        bind:checked={editPowerManagementSchedule} 
                        size="sm"
                        on:change={() => switchToCustom()}
                    />
                </div>
                {#if editPowerManagementSchedule}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Power-On Date & Time</p>
                        <p class="config-description">Scheduled time to turn on the device</p>
                    </div>
                    <div style="width: 220px;">
                        <input
                            type="datetime-local"
                            class="config-input"
                            bind:value={editPowerOnDatetime}
                            on:change={() => switchToCustom()}
                        />
                    </div>
                </div>
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Power-Off Date & Time</p>
                        <p class="config-description">Scheduled time to turn off the device</p>
                    </div>
                    <div style="width: 220px;">
                        <input
                            type="datetime-local"
                            class="config-input"
                            bind:value={editPowerOffDatetime}
                            on:change={() => switchToCustom()}
                        />
                    </div>
                </div>
                {/if}

                <!-- Reboot Schedule -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Reboot Schedule</p>
                        <p class="config-description">Enable scheduled device reboots</p>
                    </div>
                    <Toggle 
                        bind:checked={editRebootSchedule} 
                        size="sm"
                        on:change={() => switchToCustom()}
                    />
                </div>
                {#if editRebootSchedule}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Reboot Frequency</p>
                        <p class="config-description">How often to reboot the device</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={frequencyOptions}
                            value={editRebootFrequency}
                            on:change={(e) => {
                                editRebootFrequency = String(e.detail);
                                switchToCustom();
                            }}
                        />
                    </div>
                </div>
                {#if editRebootFrequency === 'weekly' || editRebootFrequency === 'monthly'}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Reboot Day</p>
                        <p class="config-description">{editRebootFrequency === 'monthly' ? 'Day of the month (1–31) for scheduled reboot' : 'Day of the week for scheduled reboot'}</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={rebootDayOptions}
                            value={editRebootDay}
                            on:change={(e) => {
                                editRebootDay = String(e.detail);
                                switchToCustom();
                            }}
                        />
                    </div>
                </div>
                {/if}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Reboot Time</p>
                        <p class="config-description">Time for scheduled reboot</p>
                    </div>
                    <div style="width: 200px;">
                        <input
                            type="time"
                            class="config-input"
                            bind:value={editRebootTime}
                            on:change={() => switchToCustom()}
                        />
                    </div>
                </div>
                {/if}

                <!-- Download Schedule -->
                <div class="config-row{!editDownloadSchedule ? ' config-row-last' : ''}">
                    <div>
                        <p class="config-label">Download Schedule</p>
                        <p class="config-description">Enable scheduled content downloads</p>
                    </div>
                    <Toggle 
                        bind:checked={editDownloadSchedule} 
                        size="sm"
                        on:change={() => switchToCustom()}
                    />
                </div>
                {#if editDownloadSchedule}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Download Frequency</p>
                        <p class="config-description">How often to download content</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={frequencyOptions}
                            value={editDownloadFrequency}
                            on:change={(e) => {
                                editDownloadFrequency = String(e.detail);
                                switchToCustom();
                            }}
                        />
                    </div>
                </div>
                {#if editDownloadFrequency === 'weekly' || editDownloadFrequency === 'monthly'}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Download Day</p>
                        <p class="config-description">{editDownloadFrequency === 'monthly' ? 'Day of the month (1–31) for scheduled downloads' : 'Day of the week for scheduled downloads'}</p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={downloadDayOptions}
                            value={editDownloadDay}
                            on:change={(e) => {
                                editDownloadDay = String(e.detail);
                                switchToCustom();
                            }}
                        />
                    </div>
                </div>
                {/if}
                <div class="config-row config-sub-row config-row-last">
                    <div>
                        <p class="config-label config-sub-label">Download Time</p>
                        <p class="config-description">Time for scheduled downloads</p>
                    </div>
                    <div style="width: 200px;">
                        <input
                            type="time"
                            class="config-input"
                            bind:value={editDownloadTime}
                            on:change={() => switchToCustom()}
                        />
                    </div>
                </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Error Message -->
    {#if editDeviceError}
        <div style="margin-top: 16px;">
            <Alert severity="error" variant="outline" message={editDeviceError} />
        </div>
    {/if}

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px;"
            on:click={closeEditDeviceModal}
            disabled={editDeviceLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={saveEditDevice}
            disabled={editDeviceLoading || !editDeviceName.trim()}
            loading={editDeviceLoading}
        >
            Save
        </Button>
    </div>
</Modal>

<style>
    /* Edit Device Modal - Configuration blocks */
    .config-block {
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-xl);
        padding: 0;
    }

    .config-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ds-space-4) var(--ds-space-5);
        border-bottom: 1px solid var(--ds-border-default);
    }

    .config-row-last {
        border-bottom: none;
    }

    .config-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .config-description {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-tertiary);
        margin: 0;
    }

    /* Sub-row for schedule detail fields */
    .config-sub-row {
        padding-left: calc(var(--ds-space-5) + 16px);
        background: var(--ds-bg-primary);
    }

    .config-sub-label {
        font-size: var(--ds-text-sm);
    }

    /* Native datetime/time input styling */
    .config-input {
        width: 100%;
        height: 40px;
        padding: 6px 12px;
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-sm);
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        background: #FFFFFF;
        color: var(--ds-text-primary);
        box-sizing: border-box;
    }

    .config-input:focus {
        outline: none;
        border-color: var(--ds-color-primary-500);
        box-shadow: 0px 0px 0px 3px var(--ds-color-primary-100);
    }

    /* Edit Device Modal - Slider styles */
    .config-slider {
        cursor: pointer;
    }

    /* Slider thumb styling - WebKit browsers (Chrome, Safari, Edge) */
    .config-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        cursor: pointer;
    }

    .config-slider::-webkit-slider-thumb:hover {
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #F2F4F7;
    }

    /* Slider thumb styling - Firefox */
    .config-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        cursor: pointer;
    }

    .config-slider::-moz-range-thumb:hover {
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #F2F4F7;
    }

    /* Slider track styling - Firefox */
    .config-slider::-moz-range-track {
        height: 8px;
        border-radius: var(--ds-radius-sm);
        background: transparent;
    }

    /* Edit Device Modal - Slider input wrapper */
    .config-slider-input-wrapper {
        position: relative;
        display: inline-block;
        width: 78px;
    }

    .config-slider-input {
        width: 78px;
        height: 52px;
        padding: 6px 8px;
        padding-right: 24px; /* Space for % symbol */
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-sm); /* 4px */
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        text-align: center;
        background: #FFFFFF; /* White background as per design */
        color: var(--ds-text-primary);
        box-sizing: border-box;
    }

    .config-slider-input:focus {
        outline: none;
        border-color: var(--ds-color-primary-500);
        box-shadow: 0px 0px 0px 3px var(--ds-color-primary-100);
    }

    .config-slider-unit {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-text-tertiary);
        pointer-events: none; /* Allow clicks to pass through to input */
    }
</style>
