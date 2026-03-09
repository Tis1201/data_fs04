<script lang="ts">
    import { deserialize } from '$app/forms';
    import { createEventDispatcher } from 'svelte';
    import {
        Modal,
        Button,
        TextareaField,
        Toggle,
        InputField,
        Dropdown
    } from '$lib/design-system/components';
    import { Eye, EyeOff } from 'lucide-svelte';
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';

    export let open: boolean = false;
    export let mode: 'add' | 'edit' = 'add';
    export let profileId: string | null = null;
    /** Base path for form actions (e.g. /user/iot/device-profiles). Required for same-page create/update. */
    export let actionBasePath: string = '/user/iot/device-profiles';

    const dispatch = createEventDispatcher<{
        close: void;
        success: void;
        error: string;
    }>();

    let submitting = false;
    let errorMessage: string | null = null;

    // Profile name validation error: show on InputField (below input), not at top of form
    const MAX_NAME_LENGTH = 500;
    const PROFILE_NAME_REQUIRED_MSG = 'Profile name is required';
    const PROFILE_NAME_TOO_LONG_MSG = `Profile name must be ${MAX_NAME_LENGTH} characters or less`;
    $: profileNameError = errorMessage || '';
    $: if (name?.trim() && name.length <= MAX_NAME_LENGTH && (errorMessage === PROFILE_NAME_REQUIRED_MSG || errorMessage === PROFILE_NAME_TOO_LONG_MSG)) errorMessage = null;

    // Form state
    let name = '';
    let isActive = true;
    let description = '';
    let kioskLockMode = false;
    let exitLockdownPassword = '';
    let showPassword = false;
    let kioskApplication = '';
    let displayResolution = '1920x1080';
    let screenOrientation = 'landscape';
    let brightnessLevel = 100;
    let audioEnabled = true;
    let audioVolume = 100;
    let timezone = 'Asia/Ho_Chi_Minh';
    let homeLauncher = '';
    let powerManagementSchedule = false;
    let powerOnDatetime = '';
    let powerOffDatetime = '';
    let rebootSchedule = false;
    let rebootFrequency = 'daily';
    let rebootDay = 'monday';
    let rebootTime = '02:00';
    let downloadSchedule = false;
    let downloadFrequency = 'daily';
    let downloadDay = 'monday';
    let downloadTime = '03:00';

    // Packages list for Kiosk Application and Home/Launcher dropdowns
    interface PackageOption {
        id: string;
        label: string;
    }
    let availablePackages: PackageOption[] = [];
    let packagesLoading = false;

    async function loadAvailablePackages() {
        packagesLoading = true;
        try {
            const res = await fetch('/api/v2/resources/packages/all');
            if (!res.ok) throw new Error('Failed to load packages');
            const data = await res.json();
            
            if (data.success || data.data) {
                const allPackages = data.data?.packages || [];
                availablePackages = allPackages.map((pkg: any) => ({
                    id: pkg.packageName,
                    label: pkg.displayName ? `${pkg.displayName} (${pkg.packageName})` : pkg.packageName
                }));
            } else {
                availablePackages = [];
            }
        } catch {
            availablePackages = [];
        } finally {
            packagesLoading = false;
        }
    }

    // Load packages when modal opens
    $: if (open) {
        loadAvailablePackages();
    }

    // Get current datetime in local format for min attribute (prevent selecting past dates)
    function getCurrentDateTimeLocal(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    $: minDatetime = getCurrentDateTimeLocal();

    // Schedule options from availableSettings (same as Edit Device modal)
    $: frequencyOptions = (() => {
        const def = availableSettings.find((s: { key: string }) => s.key === 'reboot_schedule_frequency');
        if (def?.options) return def.options.map((o: { value: string; label: string }) => ({ id: o.value, label: o.label }));
        return [{ id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }];
    })();
    $: dayOptions = (() => {
        const def = availableSettings.find((s: { key: string }) => s.key === 'reboot_schedule_day');
        if (def?.options) return def.options.map((o: { value: string; label: string }) => ({ id: o.value, label: o.label }));
        return [
            { id: 'monday', label: 'Monday' }, { id: 'tuesday', label: 'Tuesday' }, { id: 'wednesday', label: 'Wednesday' },
            { id: 'thursday', label: 'Thursday' }, { id: 'friday', label: 'Friday' }, { id: 'saturday', label: 'Saturday' },
            { id: 'sunday', label: 'Sunday' }
        ];
    })();
    /** Day of month (1-31) for Monthly frequency */
    const dayOfMonthOptions = Array.from({ length: 31 }, (_, i) => {
        const n = i + 1;
        const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
        return { id: String(n), label: `${n}${suffix}` };
    });
    const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const isValidDayOfMonth = (v: string) => /^([1-9]|1\d|2\d|30|31)$/.test(v);
    /** Reset downloadDay when frequency changes so weekly uses day-of-week, monthly uses day-of-month */
    $: if (downloadSchedule && downloadFrequency === 'monthly' && !isValidDayOfMonth(downloadDay)) downloadDay = '1';
    $: if (downloadSchedule && downloadFrequency === 'weekly' && !WEEKDAYS.includes(downloadDay)) downloadDay = 'monday';
    /** Reset rebootDay when frequency changes so weekly uses day-of-week, monthly uses day-of-month */
    $: if (rebootSchedule && rebootFrequency === 'monthly' && !isValidDayOfMonth(rebootDay)) rebootDay = '1';
    $: if (rebootSchedule && rebootFrequency === 'weekly' && !WEEKDAYS.includes(rebootDay)) rebootDay = 'monday';

    // Dropdown options from availableSettings
    $: displayResolutionOptions = (() => {
        const s = availableSettings.find((x: any) => x.key === 'display_resolution');
        return (s?.options || []).map((o: any) => ({ id: o.value, label: o.label }));
    })();
    $: screenOrientationOptions = (() => {
        const s = availableSettings.find((x: any) => x.key === 'screen_orientation');
        return (s?.options || []).map((o: any) => ({ id: o.value, label: o.label }));
    })();
    const timezoneOptions = [
        { id: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (ICT)' },
        { id: 'UTC', label: 'UTC' },
        { id: 'Asia/Bangkok', label: 'Asia/Bangkok' },
        { id: 'America/New_York', label: 'America/New_York' }
    ];
    // Kiosk Application is a text input per design ("Enter app name or package"), not dropdown

    function getSettingValue(key: string, settings: any[]): string {
        const s = settings.find((x: any) => x.key === key);
        return s?.value != null ? String(s.value) : '';
    }

    function buildSettingsArray(): any[] {
        const map: Record<string, { value: string; dataType: string; label: string; category: string }> = {
            kiosk_lock_mode: {
                value: kioskLockMode ? 'enabled' : 'disabled',
                dataType: 'select',
                label: 'Kiosk Lock Mode',
                category: 'Security'
            },
            exit_lockdown_password: {
                value: exitLockdownPassword,
                dataType: 'password',
                label: 'Exit Lockdown Password',
                category: 'Security'
            },
            kiosk_application: {
                value: kioskApplication,
                dataType: 'select',
                label: 'Kiosk Application',
                category: 'System'
            },
            display_resolution: {
                value: displayResolution,
                dataType: 'select',
                label: 'Display Resolution',
                category: 'Display'
            },
            screen_orientation: {
                value: screenOrientation,
                dataType: 'select',
                label: 'Screen Orientation',
                category: 'Display'
            },
            brightness_level: {
                value: String(brightnessLevel),
                dataType: 'number',
                label: 'Brightness Level',
                category: 'Display'
            },
            enable_audio: {
                value: audioEnabled ? 'enabled' : 'disabled',
                dataType: 'select',
                label: 'Enable Audio',
                category: 'Audio'
            },
            volume_level: {
                value: String(audioVolume),
                dataType: 'number',
                label: 'Volume Level',
                category: 'Audio'
            },
            timezone: {
                value: timezone,
                dataType: 'timezone',
                label: 'Timezone',
                category: 'System'
            },
            home_launcher: {
                value: homeLauncher,
                dataType: 'text',
                label: 'Home/Launcher',
                category: 'System'
            },
            power_management_schedule: {
                value: powerManagementSchedule ? 'enabled' : 'disabled',
                dataType: 'select',
                label: 'Power Management Schedule',
                category: 'Power'
            },
            power_on_datetime: { value: powerOnDatetime || '', dataType: 'string', label: 'Power-On Date & Time', category: 'Power' },
            power_off_datetime: { value: powerOffDatetime || '', dataType: 'string', label: 'Power-Off Date & Time', category: 'Power' },
            reboot_schedule_enabled: {
                value: rebootSchedule ? 'enabled' : 'disabled',
                dataType: 'select',
                label: 'Reboot Schedule',
                category: 'Maintenance'
            },
            reboot_schedule_frequency: { value: rebootFrequency || 'daily', dataType: 'string', label: 'Reboot Frequency', category: 'Maintenance' },
            reboot_schedule_day: {
                value: rebootFrequency === 'monthly' ? (rebootDay || '1') : (rebootDay || 'monday'),
                dataType: 'string',
                label: 'Reboot Day',
                category: 'Maintenance'
            },
            reboot_schedule_time: { value: rebootTime || '02:00', dataType: 'string', label: 'Reboot Time', category: 'Maintenance' },
            download_schedule_enabled: {
                value: downloadSchedule ? 'enabled' : 'disabled',
                dataType: 'select',
                label: 'Download Schedule',
                category: 'Maintenance'
            },
            download_schedule_frequency: { value: downloadFrequency || 'daily', dataType: 'string', label: 'Download Frequency', category: 'Maintenance' },
            download_schedule_day: {
                value: downloadFrequency === 'monthly' ? (downloadDay || '1') : (downloadDay || 'monday'),
                dataType: 'string',
                label: 'Download Day',
                category: 'Maintenance'
            },
            download_schedule_time: { value: downloadTime || '03:00', dataType: 'string', label: 'Download Time', category: 'Maintenance' }
        };
        return Object.entries(map).map(([key], index) => ({
            key,
            value: map[key].value,
            dataType: map[key].dataType,
            label: map[key].label,
            category: map[key].category,
            order: index
        }));
    }

    async function loadProfile() {
        if (!profileId) return;
        try {
            const res = await fetch(`/user/iot/device-profiles/${profileId}`, {
                headers: { Accept: 'application/json' }
            });
            if (!res.ok) throw new Error('Failed to load profile');
            const data = await res.json();
            if (!data?.success || !data?.form) throw new Error('Invalid response');
            const f = data.form;
            name = f.name || '';
            isActive = f.isActive === 'true';
            description = f.description || '';
            let settings: any[] = [];
            try {
                settings = JSON.parse(f.settings || '[]');
            } catch (_) {}
            kioskLockMode = getSettingValue('kiosk_lock_mode', settings) === 'enabled';
            exitLockdownPassword = getSettingValue('exit_lockdown_password', settings) || '';
            kioskApplication = getSettingValue('kiosk_application', settings) || '';
            displayResolution = getSettingValue('display_resolution', settings) || '1920x1080';
            screenOrientation = getSettingValue('screen_orientation', settings) || 'landscape';
            const bright = getSettingValue('brightness_level', settings);
            brightnessLevel = bright ? parseInt(bright, 10) || 100 : 100;
            audioEnabled = getSettingValue('enable_audio', settings) !== 'disabled';
            const vol = getSettingValue('volume_level', settings);
            audioVolume = vol ? parseInt(vol, 10) || 100 : 100;
            timezone = getSettingValue('timezone', settings) || 'Asia/Ho_Chi_Minh';
            homeLauncher = getSettingValue('home_launcher', settings) || '';
            powerManagementSchedule = getSettingValue('power_management_schedule', settings) === 'enabled';
            powerOnDatetime = getSettingValue('power_on_datetime', settings) || '';
            powerOffDatetime = getSettingValue('power_off_datetime', settings) || '';
            rebootSchedule = getSettingValue('reboot_schedule', settings) === 'enabled' || getSettingValue('reboot_schedule_enabled', settings) === 'enabled';
            rebootFrequency = getSettingValue('reboot_schedule_frequency', settings) || 'daily';
            rebootDay = getSettingValue('reboot_schedule_day', settings) || (rebootFrequency === 'monthly' ? '1' : 'monday');
            rebootTime = getSettingValue('reboot_schedule_time', settings) || '02:00';
            downloadSchedule = getSettingValue('download_schedule', settings) === 'enabled' || getSettingValue('download_schedule_enabled', settings) === 'enabled';
            downloadFrequency = getSettingValue('download_schedule_frequency', settings) || 'daily';
            downloadDay = getSettingValue('download_schedule_day', settings) || (downloadFrequency === 'monthly' ? '1' : 'monday');
            downloadTime = getSettingValue('download_schedule_time', settings) || '03:00';
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : 'Failed to load profile';
        }
    }

    function resetForm() {
        name = '';
        isActive = true;
        description = '';
        kioskLockMode = false;
        exitLockdownPassword = '';
        showPassword = false;
        kioskApplication = '';
        displayResolution = '1920x1080';
        screenOrientation = 'landscape';
        brightnessLevel = 100;
        audioEnabled = true;
        audioVolume = 100;
        timezone = 'Asia/Ho_Chi_Minh';
        homeLauncher = '';
        powerManagementSchedule = false;
        powerOnDatetime = '';
        powerOffDatetime = '';
        rebootSchedule = false;
        rebootFrequency = 'daily';
        rebootDay = 'monday';
        rebootTime = '02:00';
        downloadSchedule = false;
        downloadFrequency = 'daily';
        downloadDay = 'monday';
        downloadTime = '03:00';
        errorMessage = null;
    }

    $: if (open && mode === 'add') {
        resetForm();
    }
    $: if (open && mode === 'edit' && profileId) {
        loadProfile();
    }

    /** Always return a string for display; never [object Object]. */
    function toErrorMessage(value: unknown): string {
        if (value == null) return 'Request failed';
        if (typeof value === 'string') return value;
        if (value instanceof Error) return value.message || 'Request failed';
        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            const m = obj.message ?? obj.error ?? (obj as { error?: { message?: string } }).error?.message;
            if (typeof m === 'string') return m;
            if (m && typeof m === 'object' && 'message' in m && typeof (m as { message: unknown }).message === 'string')
                return (m as { message: string }).message;
            if (obj.data && typeof obj.data === 'object' && typeof (obj.data as Record<string, unknown>).message === 'string')
                return (obj.data as { message: string }).message;
        }
        return 'Request failed';
    }

    async function handleSubmit() {
        errorMessage = null;
        if (!name?.trim()) {
            errorMessage = PROFILE_NAME_REQUIRED_MSG;
            return;
        }
        if (name.length > MAX_NAME_LENGTH) {
            errorMessage = PROFILE_NAME_TOO_LONG_MSG;
            return;
        }
        submitting = true;
        try {
            const settingsArray = buildSettingsArray();
            const fd = new FormData();
            fd.set('name', name.trim());
            fd.set('description', description);
            fd.set('isActive', isActive ? 'true' : 'false');
            fd.set('settings', JSON.stringify(settingsArray));
            if (mode === 'edit' && profileId) {
                fd.set('profileId', profileId);
            }

            // Submit to list page so same-route form action runs (full path avoids relative URL issues)
            const actionName = mode === 'add' ? 'create' : 'update';
            const url = `${actionBasePath.replace(/\/$/, '')}?/${actionName}`;
            const res = await fetch(url, {
                method: 'POST',
                body: fd,
                headers: { Accept: 'application/json' },
                credentials: 'same-origin'
            });
            const responseText = await res.text();

            // Form actions return devalue-serialized data; deserialize the whole response first
            let result: { type?: string; status?: number; data?: unknown; success?: boolean } = {};
            try {
                result = deserialize(responseText) as typeof result;
            } catch {
                try {
                    result = JSON.parse(responseText) as typeof result;
                } catch {
                    result = {};
                }
            }

            if (result.type === 'success' || result.success || (result.data as any)?.success) {
                dispatch('success');
            } else {
                let msg = '';
                const data = result.data;
                // data may be object (from full deserialize) or string (from JSON parse of wrapper)
                if (data && typeof data === 'object') {
                    const payload = data as { form?: { errors?: Record<string, string[] | string> }; message?: string };
                    const nameErr = payload?.form?.errors?.name;
                    const nameMsg = Array.isArray(nameErr) ? nameErr[0] : (typeof nameErr === 'string' ? nameErr : '');
                    msg = (typeof payload?.message === 'string' ? payload.message : '') || nameMsg;
                } else if (data && typeof data === 'string') {
                    try {
                        const parsed = deserialize(data) as { form?: { errors?: Record<string, string[] | string> }; message?: string };
                        const nameErr = parsed?.form?.errors?.name;
                        const nameMsg = Array.isArray(nameErr) ? nameErr[0] : (typeof nameErr === 'string' ? nameErr : '');
                        msg = (typeof parsed?.message === 'string' ? parsed.message : '') || nameMsg;
                    } catch {
                        /* ignore */
                    }
                }
                if (!msg) msg = toErrorMessage(result);
                dispatch('error', msg);
                errorMessage = msg;
            }
        } catch (e) {
            const msg = toErrorMessage(e);
            dispatch('error', msg);
            errorMessage = msg;
        } finally {
            submitting = false;
        }
    }

    function handleClose() {
        dispatch('close');
    }
</script>

<Modal
    open={open}
    title={mode === 'add' ? 'Add Profile' : 'Edit Profile'}
    size="lg"
    showFooter={false}
    on:close={handleClose}
>
    <form on:submit|preventDefault={handleSubmit} class="profile-form w-full min-w-0">
        <!-- Profile Name + Active (same row as design, aligned like Edit Device) -->
        <!-- Validation error for Profile Name is shown below the input via InputField state/helperText -->
        <div class="profile-header">
            <div class="flex items-center gap-4">
                <div class="flex-1">
                    <InputField
                        type="text"
                        label="Profile Name"
                        placeholder="Enter"
                        bind:value={name}
                        required={true}
                        maxlength={MAX_NAME_LENGTH}
                        state={profileNameError ? 'error' : 'default'}
                        helperText={profileNameError || ''}
                    />
                    <p class="char-count" class:char-count-limit={name.length === MAX_NAME_LENGTH}>
                        {name.length}/{MAX_NAME_LENGTH} characters
                        {#if name.length === MAX_NAME_LENGTH}
                            — Maximum length reached
                        {/if}
                    </p>
                </div>
                <div class="profile-active-wrap">
                    <Toggle bind:checked={isActive} size="sm" />
                    <span class="profile-active-label">Active</span>
                </div>
            </div>
        </div>

        <!-- Description -->
        <div class="profile-description-wrap">
            <TextareaField
                label="Description"
                placeholder="Enter"
                bind:value={description}
                rows={3}
            />
        </div>

        <!-- Configuration sections (layout like Edit Device modal) -->
        <div class="config-section">
            <!-- Block 1: Kiosk Settings -->
            <div class="config-block">
                <div class="config-row">
                    <div>
                        <p class="config-label">Kiosk Lock Mode</p>
                        <p class="config-description">Enable kiosk mode to lock the device interface</p>
                    </div>
                    <Toggle bind:checked={kioskLockMode} size="sm" />
                </div>

                {#if kioskLockMode}
                <div class="config-row">
                    <div>
                        <p class="config-label">Exit Lockdown Password</p>
                        <p class="config-description">Password required to exit kiosk mode</p>
                    </div>
                    <div class="config-input-wrap">
                        <div class="relative">
                            <InputField
                                type={showPassword ? 'text' : 'password'}
                                placeholder="******"
                                bind:value={exitLockdownPassword}
                            />
                            <button
                                type="button"
                                class="config-password-toggle"
                                on:click={() => (showPassword = !showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {#if showPassword}
                                    <EyeOff size={20} />
                                {:else}
                                    <Eye size={20} />
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>
                {/if}

                <div class="config-row config-row-last">
                    <div>
                        <p class="config-label">Kiosk Application</p>
                        <p class="config-description">Application to run in kiosk mode</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown
                            placeholder={packagesLoading ? 'Loading...' : 'Select application'}
                            options={availablePackages}
                            bind:value={kioskApplication}
                            disabled={packagesLoading}
                        />
                    </div>
                </div>
            </div>

            <!-- Block 2: Display Settings -->
            <div class="config-block">
                <div class="config-row">
                    <div>
                        <p class="config-label">Display Resolution</p>
                        <p class="config-description">Screen resolution for device</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown
                            placeholder="Select"
                            options={displayResolutionOptions}
                            bind:value={displayResolution}
                        />
                    </div>
                </div>

                <div class="config-row">
                    <div>
                        <p class="config-label">Screen Orientation</p>
                        <p class="config-description">Screen orientation preference</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown
                            placeholder="Select"
                            options={screenOrientationOptions}
                            bind:value={screenOrientation}
                        />
                    </div>
                </div>

                <div class="config-row config-row-last">
                    <div>
                        <p class="config-label">Brightness Level</p>
                        <p class="config-description">Screen brightness level (0-100%)</p>
                    </div>
                    <div class="config-slider-row">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={brightnessLevel}
                            class="config-slider"
                            aria-label="Brightness level"
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #525252 0%, #525252 {brightnessLevel}%, var(--ds-color-neutral-true-200) {brightnessLevel}%, var(--ds-color-neutral-true-200) 100%); border-radius: var(--ds-radius-sm); outline: none;"
                        />
                        <div class="config-slider-input-wrapper">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={brightnessLevel}
                                class="config-slider-input"
                            />
                            <span class="config-slider-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 3: Audio Settings -->
            <div class="config-block">
                <div class="config-row">
                    <div>
                        <p class="config-label">Audio</p>
                        <p class="config-description">Enable or disable audio output</p>
                    </div>
                    <Toggle bind:checked={audioEnabled} size="sm" />
                </div>

                <div class="config-row config-row-last">
                    <div>
                        <p class="config-label">Audio Volume</p>
                        <p class="config-description">Audio volume level (0-100%)</p>
                    </div>
                    <div class="config-slider-row">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={audioVolume}
                            class="config-slider"
                            aria-label="Audio volume"
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #525252 0%, #525252 {audioVolume}%, var(--ds-color-neutral-true-200) {audioVolume}%, var(--ds-color-neutral-true-200) 100%); border-radius: var(--ds-radius-sm); outline: none;"
                        />
                        <div class="config-slider-input-wrapper">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={audioVolume}
                                class="config-slider-input"
                            />
                            <span class="config-slider-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 4: System (Timezone, Home/Launcher) -->
            <div class="config-block">
                <div class="config-row">
                    <div>
                        <p class="config-label">Timezone</p>
                        <p class="config-description">Device timezone settings</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown
                            placeholder="Select"
                            options={timezoneOptions}
                            bind:value={timezone}
                        />
                    </div>
                </div>

                <div class="config-row config-row-last">
                    <div>
                        <p class="config-label">Home/ Launcher</p>
                        <p class="config-description">Default home screen launcher</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown
                            placeholder={packagesLoading ? 'Loading...' : 'Select launcher'}
                            options={availablePackages}
                            bind:value={homeLauncher}
                            disabled={packagesLoading}
                        />
                    </div>
                </div>
            </div>

            <!-- Block 5: Schedule Settings (same as Edit Device: date/time, frequency, day, time) -->
            <div class="config-block">
                <!-- Power Management Schedule -->
                <div class="config-row">
                    <div>
                        <p class="config-label">Power Management Schedule</p>
                        <p class="config-description">Enable scheduled power on/off times</p>
                    </div>
                    <Toggle bind:checked={powerManagementSchedule} size="sm" />
                </div>
                {#if powerManagementSchedule}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Power-On Date & Time</p>
                        <p class="config-description">Scheduled time to turn on the device</p>
                    </div>
                    <div class="config-input-wrap config-datetime-wrap">
                        <InputField
                            type="datetime-local"
                            bind:value={powerOnDatetime}
                            min={minDatetime}
                            placeholder=""
                        />
                    </div>
                </div>
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Power-Off Date & Time</p>
                        <p class="config-description">Scheduled time to turn off the device</p>
                    </div>
                    <div class="config-input-wrap config-datetime-wrap">
                        <InputField
                            type="datetime-local"
                            bind:value={powerOffDatetime}
                            min={minDatetime}
                            placeholder=""
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
                    <Toggle bind:checked={rebootSchedule} size="sm" />
                </div>
                {#if rebootSchedule}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Reboot Frequency</p>
                        <p class="config-description">How often to reboot the device</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown placeholder="Select" options={frequencyOptions} bind:value={rebootFrequency} />
                    </div>
                </div>
                {#if rebootFrequency === 'weekly' || rebootFrequency === 'monthly'}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Reboot Day</p>
                        <p class="config-description">
                            {rebootFrequency === 'weekly' ? 'Day of the week for scheduled reboot' : 'Day of the month for scheduled reboot (1-31)'}
                        </p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown
                            placeholder="Select"
                            options={rebootFrequency === 'weekly' ? dayOptions : dayOfMonthOptions}
                            bind:value={rebootDay}
                        />
                    </div>
                </div>
                {/if}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Reboot Time</p>
                        <p class="config-description">Time for scheduled reboot</p>
                    </div>
                    <div class="config-input-wrap">
                        <InputField
                            type="time"
                            bind:value={rebootTime}
                            placeholder=""
                        />
                    </div>
                </div>
                {/if}

                <!-- Download Schedule -->
                <div class="config-row{!downloadSchedule ? ' config-row-last' : ''}">
                    <div>
                        <p class="config-label">Download Schedule</p>
                        <p class="config-description">Enable scheduled content downloads</p>
                    </div>
                    <Toggle bind:checked={downloadSchedule} size="sm" />
                </div>
                {#if downloadSchedule}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Download Frequency</p>
                        <p class="config-description">How often to download content</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown placeholder="Select" options={frequencyOptions} bind:value={downloadFrequency} />
                    </div>
                </div>
                {#if downloadFrequency === 'weekly'}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Download Day</p>
                        <p class="config-description">Day of the week for scheduled downloads</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown placeholder="Select" options={dayOptions} bind:value={downloadDay} />
                    </div>
                </div>
                {:else if downloadFrequency === 'monthly'}
                <div class="config-row config-sub-row">
                    <div>
                        <p class="config-label config-sub-label">Download Day</p>
                        <p class="config-description">Day of the month for scheduled downloads (1-31)</p>
                    </div>
                    <div class="config-input-wrap">
                        <Dropdown placeholder="Select" options={dayOfMonthOptions} bind:value={downloadDay} />
                    </div>
                </div>
                {/if}
                <div class="config-row config-sub-row config-row-last">
                    <div>
                        <p class="config-label config-sub-label">Download Time</p>
                        <p class="config-description">Time for scheduled downloads</p>
                    </div>
                    <div class="config-input-wrap">
                        <InputField
                            type="time"
                            bind:value={downloadTime}
                            placeholder=""
                        />
                    </div>
                </div>
                {/if}
            </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-[var(--ds-border-default)]">
            <Button variant="outline" color="primary" type="button" on:click={handleClose}>
                Cancel
            </Button>
            <Button
                variant="filled"
                color="primary"
                type="submit"
                loading={submitting}
                disabled={submitting}
            >
                {mode === 'add' ? 'Add' : 'Save'}
            </Button>
        </div>
    </form>
</Modal>

<style>
    .profile-form {
        display: flex;
        flex-direction: column;
        gap: 0;
        width: 100%;
    }

    /* Profile Name + Active row (same layout as Edit Device / design) */
    .profile-header {
        width: 100%;
        margin-bottom: var(--ds-space-6);
    }

    .profile-active-wrap {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding-top: var(--ds-space-6);
    }

    .profile-active-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    .profile-description-wrap {
        width: 100%;
        margin-bottom: var(--ds-space-6);
    }

    .config-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        width: 100%;
        max-height: 500px;
        overflow-y: auto;
    }

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

    .config-input-wrap {
        width: 200px;
    }

    .config-datetime-wrap {
        width: 220px;
    }

    .config-sub-row {
        padding-left: calc(var(--ds-space-5) + 16px);
        background: var(--ds-bg-primary);
    }

    .config-sub-label {
        font-size: var(--ds-text-sm);
    }

    .config-input-wrap .relative {
        position: relative;
        width: 100%;
    }

    .config-password-toggle {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-text-secondary);
    }

    .config-slider-row {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
        width: 280px;
    }

    .config-slider {
        cursor: pointer;
    }

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

    .config-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        cursor: pointer;
    }

    .config-slider::-moz-range-track {
        height: 8px;
        border-radius: var(--ds-radius-sm);
        background: transparent;
    }

    .config-slider-input-wrapper {
        position: relative;
        display: inline-block;
        width: 78px;
    }

    .config-slider-input {
        width: 78px;
        height: 52px;
        padding: 6px 8px;
        padding-right: 24px;
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-sm);
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        text-align: center;
        background: #FFFFFF;
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
        pointer-events: none;
    }

    .char-count {
        margin: 4px 0 0;
        font-size: var(--ds-text-xs);
        color: var(--ds-color-neutral-true-500);
    }
    .char-count.char-count-limit {
        color: var(--ds-color-amber-600, #d97706);
    }

</style>
