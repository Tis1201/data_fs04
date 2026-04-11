<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { enhance, deserialize } from '$app/forms';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { initializeDeviceRealtime, deviceRealtimeStore } from '$lib/stores/deviceRealtimeStore';
    import { toast } from '$lib/stores/alertToast';
    import { claimDevice } from '$lib/client/mqtt/claimFlow';
    import { Alert, Button, InputField, TextareaField, DataTable, Modal, Dropdown, Toggle, Tooltip, ProgressBar, TabGroup } from '$lib/design-system/components';
    import EditDeviceModal from '$lib/components/ui_components_sveltekit/radar/EditDeviceModal.svelte';
    import { validateBounds, normalizeBounds, RADAR_CONSTRAINTS, ADD_DEVICE_TRACKING_DEFAULTS } from '$lib/components/ui_components_sveltekit/radar/constraints';
    import type { BadgeColor, SortState } from '$lib/design-system/components';
    import { Search, Filter, Plus, Info, Trash2 } from 'lucide-svelte';
    import type { PageData } from './$types';
    import type { Sensor } from '@prisma/client';

    export let data: PageData;

    type SensorRow = Sensor & {
        /** ISO timestamp — same semantics as IoT devices list (Prisma + ClickHouse + connect fallbacks). */
        deviceLastPingAt?: string | null;
        controller?: {
            id: string;
            device?: {
                id: string;
                name?: string;
                connected?: boolean;
                macAddress?: string | null;
                lanMac?: string | null;
                wifiMac?: string | null;
            };
        } | null;
    };

    // TODO: Re-enable ACL check when radar module ACL is turned back on.
    $: showCreateButton = !!data.user;

    // Search: bind to local value, debounce then sync to URL
    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;


    // Delete confirmation modal (per design: red icon, title, message, Cancel + Delete)
    let sensorToDelete: SensorRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;

    function openDeleteModal(row: SensorRow) {
        sensorToDelete = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        sensorToDelete = null;
    }

    async function confirmDeleteSensor() {
        if (!sensorToDelete) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', sensorToDelete.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Sensor deleted successfully!');
                closeDeleteModal();
                await invalidate('app:userControllersRadar');
                goto($page.url.pathname + $page.url.search, { noScroll: true, keepFocus: true });
            } else {
                toast.error(result.message || 'Unable to delete sensor. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to delete sensor. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Filter modal: Status (Connection Status) + MAC address – aligned with pin-rules pattern
    let showFilterModal = false;
    const STATUS_OPTIONS = [
        { id: 'ACTIVE', label: 'Active' },
        { id: 'INACTIVE', label: 'Inactive' },
        { id: 'MAINTENANCE', label: 'Maintenance' }
    ] as const;
    let filterStatuses: string[] = $page.url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
    let filterDeviceMacs: string[] = $page.url.searchParams.get('device_macs')?.split(',').filter(Boolean) || [];

    $: statusDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label, type: 'checkbox' as const }))
    ];
    $: deviceMacDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...(data.availableMacs || []).map((mac) => ({ id: mac, label: mac, type: 'checkbox' as const }))
    ];

    // All and specific options mutually exclusive – same as pin-rules
    function handleStatusFilterChange(e: CustomEvent<string | string[]>) {
        const val = e.detail;
        const arr = Array.isArray(val) ? val : (val ? [val] : []);
        if (arr.includes('__all__') && !filterStatuses.includes('__all__')) {
            filterStatuses = ['__all__'];
            return;
        }
        if (!arr.includes('__all__') && filterStatuses.includes('__all__')) {
            filterStatuses = arr.length > 0 ? arr : ['__all__'];
            return;
        }
        if (arr.some((v) => v !== '__all__')) {
            filterStatuses = arr.filter((v) => v !== '__all__');
            return;
        }
        filterStatuses = arr.length > 0 ? arr : ['__all__'];
    }

    function handleDeviceMacFilterChange(e: CustomEvent<string | string[]>) {
        const val = e.detail;
        const arr = Array.isArray(val) ? val : (val ? [val] : []);
        if (arr.includes('__all__') && !filterDeviceMacs.includes('__all__')) {
            filterDeviceMacs = ['__all__'];
            return;
        }
        if (!arr.includes('__all__') && filterDeviceMacs.includes('__all__')) {
            filterDeviceMacs = arr.length > 0 ? arr : ['__all__'];
            return;
        }
        if (arr.some((v) => v !== '__all__')) {
            filterDeviceMacs = arr.filter((v) => v !== '__all__');
            return;
        }
        filterDeviceMacs = arr.length > 0 ? arr : ['__all__'];
    }

    function applyFilter() {
        const url = new URL($page.url);
        const statuses = filterStatuses.filter((s) => s !== '__all__');
        const macs = filterDeviceMacs.filter((m) => m !== '__all__');
        if (statuses.length) url.searchParams.set('statuses', statuses.join(','));
        else url.searchParams.delete('statuses');
        if (macs.length) url.searchParams.set('device_macs', macs.join(','));
        else url.searchParams.delete('device_macs');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
        showFilterModal = false;
    }

    function clearFilter() {
        // Only reset selection; user must click Apply to apply changes (modal stays open)
        filterStatuses = ['__all__'];
        filterDeviceMacs = ['__all__'];
    }

    function openFilterModal() {
        // Include __all__ from URL so "All" selection is retained when reopening (same as pin-rules)
        const statusesParam = $page.url.searchParams.get('statuses');
        const macsParam = $page.url.searchParams.get('device_macs');
        filterStatuses = statusesParam ? statusesParam.split(',').filter(Boolean) : ['__all__'];
        filterDeviceMacs = macsParam ? macsParam.split(',').filter(Boolean) : ['__all__'];
        showFilterModal = true;
    }

    // Add Device modal – 2-step flow; claim by PIN (independent from Devices module)
    let showAddDeviceModal = false;
    let addDeviceStep: 1 | 2 = 1;
    let addDeviceLoading = false;
    let addDeviceError = ''; // Server/API errors only – shown with Alert
    let addDevicePinError = ''; // Field validation – shown on PIN InputField
    /** Set after claim on step 1 — used for Register (createSensorForDevice) only. */
    let claimedDeviceId: string | null = null;
    /** Device display name after claim (MAC-style), for init config labels. */
    let claimedDeviceName = '';
    /** When true, Step 2 values come from the assigned device profile (read-only). */
    let addDeviceStep2Locked = false;
    let addDeviceProfileLabel = '';
    let addDeviceForm = {
        pin: '',
        status: 'ACTIVE',
        name: '',
        serialNumber: '',
        description: '',
        location: '',
        firmware: '',
        accountId: ''
    };
    // Step 2: config + zones (max 5). Zone: id, name, active (toggle).
    const MAX_ZONES = 5;
    let addDeviceStep2 = {
        configTemplate: 'CUSTOM',
        trackingXMin: String(ADD_DEVICE_TRACKING_DEFAULTS.X_MIN),
        trackingXMax: String(ADD_DEVICE_TRACKING_DEFAULTS.X_MAX),
        trackingYMin: String(ADD_DEVICE_TRACKING_DEFAULTS.Y_MIN),
        trackingYMax: String(ADD_DEVICE_TRACKING_DEFAULTS.Y_MAX),
        deviceMode: 'LIVE_PREVIEW',
        timezone: 'UTC',
        pathTracking: true,
        dwellThreshold: '0',
        zones: [] as { id: string; name: string; active: boolean }[]
    };
    let addDeviceZoneErrors: Record<string, string> = {}; // zone id -> error message
    let addDeviceTrackingAreaErrors: { xMin?: string; yMin?: string; xMax?: string; yMax?: string } = {};
    $: if (data.currentAccountId) addDeviceForm.accountId = data.currentAccountId;
    $: if (addDeviceForm.pin !== undefined) addDevicePinError = '';
    $: if (addDeviceStep2.zones?.length) {
        const toClear = addDeviceStep2.zones.filter((z) => z.name?.trim() && addDeviceZoneErrors[z.id]).map((z) => z.id);
        if (toClear.length) {
            const next = { ...addDeviceZoneErrors };
            toClear.forEach((id) => delete next[id]);
            addDeviceZoneErrors = next;
        }
    }
    const configTemplateOptions = [
        { id: 'CUSTOM', label: 'Custom Configuration' }
    ];
    const timezoneOptions = [
        { id: 'UTC', label: 'UTC (GMT +0)' },
        { id: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho Chi Minh (GMT +7)' },
        { id: 'America/New_York', label: 'America/New York (GMT -5)' },
        { id: 'Europe/London', label: 'Europe/London (GMT +0/+1)' }
    ];

    function openAddDeviceModal() {
        addDeviceError = '';
        addDevicePinError = '';
        addDeviceTrackingAreaErrors = {};
        claimedDeviceId = null;
        claimedDeviceName = '';
        addDeviceStep2Locked = false;
        addDeviceProfileLabel = '';
        addDeviceStep = 1;
        addDeviceForm = {
            pin: '',
            status: 'ACTIVE',
            name: '',
            serialNumber: '',
            description: '',
            location: '',
            firmware: '',
            accountId: data.currentAccountId || ''
        };
        addDeviceStep2 = {
            configTemplate: 'CUSTOM',
            trackingXMin: String(ADD_DEVICE_TRACKING_DEFAULTS.X_MIN),
            trackingXMax: String(ADD_DEVICE_TRACKING_DEFAULTS.X_MAX),
            trackingYMin: String(ADD_DEVICE_TRACKING_DEFAULTS.Y_MIN),
            trackingYMax: String(ADD_DEVICE_TRACKING_DEFAULTS.Y_MAX),
            deviceMode: 'LIVE_PREVIEW',
            timezone: 'UTC',
            pathTracking: true,
            dwellThreshold: '0',
            zones: [{ id: 'zone-1', name: 'Zone 1', active: false }] // Default disabled: users typically don't prioritize zones; avoids known bug
        };
        addDeviceZoneErrors = {};
        showAddDeviceModal = true;
    }

    function closeAddDeviceModal() {
        showAddDeviceModal = false;
        addDeviceStep = 1;
        addDeviceError = '';
        addDevicePinError = '';
        claimedDeviceId = null;
        claimedDeviceName = '';
        addDeviceStep2Locked = false;
        addDeviceProfileLabel = '';
    }

    $: step2InputsDisabled = addDeviceLoading || addDeviceStep2Locked;

    // Per-field validation for Tracking Area (same pattern as EditDeviceModal, RADAR_CONSTRAINTS: X -4..4, Y 0..7)
    function validateAddDeviceTrackingField(value: string, isXAxis: boolean): string | undefined {
        if (value === '') return 'Required';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (isXAxis) {
            if (num < RADAR_CONSTRAINTS.X_MIN || num > RADAR_CONSTRAINTS.X_MAX) {
                return `Must be between ${RADAR_CONSTRAINTS.X_MIN} and ${RADAR_CONSTRAINTS.X_MAX}`;
            }
        } else {
            if (num < RADAR_CONSTRAINTS.Y_MIN || num > RADAR_CONSTRAINTS.Y_MAX) {
                return `Must be between ${RADAR_CONSTRAINTS.Y_MIN} and ${RADAR_CONSTRAINTS.Y_MAX}`;
            }
        }
        return undefined;
    }

    function validateAddDeviceTrackingArea(): boolean {
        addDeviceTrackingAreaErrors = {
            xMin: validateAddDeviceTrackingField(addDeviceStep2.trackingXMin?.trim() ?? '', true),
            yMin: validateAddDeviceTrackingField(addDeviceStep2.trackingYMin?.trim() ?? '', false),
            xMax: validateAddDeviceTrackingField(addDeviceStep2.trackingXMax?.trim() ?? '', true),
            yMax: validateAddDeviceTrackingField(addDeviceStep2.trackingYMax?.trim() ?? '', false),
        };
        const hasFieldErrors = !!addDeviceTrackingAreaErrors.xMin || !!addDeviceTrackingAreaErrors.yMin ||
            !!addDeviceTrackingAreaErrors.xMax || !!addDeviceTrackingAreaErrors.yMax;
        if (hasFieldErrors) return false;
        const xMin = parseFloat(addDeviceStep2.trackingXMin?.trim() ?? '');
        const yMin = parseFloat(addDeviceStep2.trackingYMin?.trim() ?? '');
        const xMax = parseFloat(addDeviceStep2.trackingXMax?.trim() ?? '');
        const yMax = parseFloat(addDeviceStep2.trackingYMax?.trim() ?? '');
        const taBounds = normalizeBounds({ startX: xMin, startY: yMin, endX: xMax, endY: yMax });
        const taValidation = validateBounds(taBounds);
        if (!taValidation.valid) {
            const err = taValidation.errors[0] ?? 'Invalid bounds';
            if (err.includes('X') && !err.includes('Y')) addDeviceTrackingAreaErrors = { ...addDeviceTrackingAreaErrors, xMax: err };
            else if (err.includes('Y')) addDeviceTrackingAreaErrors = { ...addDeviceTrackingAreaErrors, yMax: err };
            else addDeviceTrackingAreaErrors = { ...addDeviceTrackingAreaErrors, xMax: err };
            return false;
        }
        return true;
    }

    // Edit Device modal – shared with Detail page (EditDeviceModal)
    let sensorToEdit: SensorRow | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sensorToEditForModal: any = null;
    let showEditDeviceModal = false;

    function openEditDeviceModal(row: SensorRow) {
        sensorToEdit = row;
        sensorToEditForModal = row;
        showEditDeviceModal = true;
    }

    function closeEditDeviceModal() {
        showEditDeviceModal = false;
        sensorToEdit = null;
        sensorToEditForModal = null;
    }

    async function submitEditDeviceFromModal(payload: {
        name: string;
        location: string;
        alertSettings?: Record<string, unknown>;
        zones?: Array<{ id: string; name: string; active: boolean }>;
        trackingArea?: { startX: number; startY: number; endX: number; endY: number };
        deviceSettings?: { deviceMode: string; timezone: string; pathTracking: boolean; dwellThreshold: number };
    }) {
        if (!sensorToEdit) return;
        const fd = new FormData();
        fd.set('sensorId', sensorToEdit.id);
        fd.set('name', payload.name);
        fd.set('location', payload.location);
        const res = await fetch('?/updateSensor', { method: 'POST', body: fd });
        const result = await res.json().catch(() => ({}));
        if (result.type !== 'success') {
            toast.error(result.message || 'Unable to update device. Please try again!');
            return;
        }
        const controllerId = getControllerId(sensorToEdit);
        if (payload.alertSettings) {
            await fetch(`/user/controllers/radar/${controllerId}/alert-settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.alertSettings)
            });
        }
        if (payload.zones && payload.zones.length > 0) {
            await fetch(`/user/controllers/radar/${controllerId}/zones`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.zones)
            });
        }
        if (payload.trackingArea || payload.deviceSettings) {
            await fetch(`/user/controllers/radar/${controllerId}/config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingArea: payload.trackingArea, deviceSettings: payload.deviceSettings })
            });
        }
        toast.success('Device updated successfully!');
        closeEditDeviceModal();
        await invalidate('app:userControllersRadar');
    }

    async function addDeviceStep1Next() {
        addDeviceError = '';
        addDevicePinError = '';
        const pinNorm = addDeviceForm.pin?.trim().replace(/\s/g, '') ?? '';
        if (!pinNorm) {
            addDevicePinError = 'Device registration code (PIN) is required.';
            return;
        }
        if (pinNorm.length < 6) {
            addDevicePinError = 'Please enter the full 6-digit code from your device.';
            return;
        }
        addDeviceLoading = true;
        try {
            const confirmation = await claimDevice(pinNorm);
            const deviceId = confirmation.deviceId;
            if (!deviceId) throw new Error('Claim confirmation did not return device ID');
            claimedDeviceId = deviceId;

            const fd = new FormData();
            fd.set('deviceId', deviceId);
            const res = await fetch('?/radarProfileForClaimedDevice', { method: 'POST', body: fd });
            const raw = await res.text();
            const result = typeof raw === 'string' && raw.trim() ? (deserialize(raw) as { type?: string; data?: Record<string, unknown> }) : {};
            if (result.type === 'failure') {
                const msg = String((result.data as { message?: string })?.message ?? 'Failed to load device profile.');
                throw new Error(msg);
            }
            if (result.type !== 'success') {
                throw new Error('Unexpected response from server.');
            }
            const payload = result.data as {
                locked?: boolean;
                profileName?: string | null;
                deviceName?: string;
                step2?: typeof addDeviceStep2;
            };
            claimedDeviceName = typeof payload?.deviceName === 'string' ? payload.deviceName : '';
            addDeviceStep2Locked = payload?.locked === true;
            addDeviceProfileLabel = typeof payload?.profileName === 'string' ? payload.profileName : '';
            if (payload?.step2) {
                const s2 = payload.step2;
                addDeviceStep2 = {
                    configTemplate: s2.configTemplate ?? 'CUSTOM',
                    trackingXMin: String(s2.trackingXMin ?? ADD_DEVICE_TRACKING_DEFAULTS.X_MIN),
                    trackingXMax: String(s2.trackingXMax ?? ADD_DEVICE_TRACKING_DEFAULTS.X_MAX),
                    trackingYMin: String(s2.trackingYMin ?? ADD_DEVICE_TRACKING_DEFAULTS.Y_MIN),
                    trackingYMax: String(s2.trackingYMax ?? ADD_DEVICE_TRACKING_DEFAULTS.Y_MAX),
                    deviceMode: s2.deviceMode ?? 'LIVE_PREVIEW',
                    timezone: s2.timezone ?? 'UTC',
                    pathTracking: s2.pathTracking ?? true,
                    dwellThreshold: String(s2.dwellThreshold ?? '0'),
                    zones: Array.isArray(s2.zones) && s2.zones.length
                        ? s2.zones.map((z) => ({ ...z }))
                        : [{ id: 'zone-1', name: 'Zone 1', active: false }]
                };
            }
            addDeviceForm.serialNumber = `RADAR-${Date.now().toString(36)}`;
            if (!addDeviceStep2.zones?.length) {
                addDeviceStep2.zones = [{ id: 'zone-1', name: 'Zone 1', active: false }];
            }
            addDeviceStep = 2;
        } catch (e) {
            claimedDeviceId = null;
            claimedDeviceName = '';
            addDeviceStep2Locked = false;
            addDeviceProfileLabel = '';
            const err = e instanceof Error ? e.message : String(e);
            addDeviceError = err;
            toast.error(err);
        } finally {
            addDeviceLoading = false;
        }
    }

    function setDwellThresholdFromInput(el: HTMLInputElement | null) {
        if (!el || addDeviceStep2Locked) return;
        const v = el.value;
        addDeviceStep2.dwellThreshold = v;
        addDeviceStep2 = addDeviceStep2;
    }
    function addDeviceAddZone() {
        if (addDeviceStep2Locked) return;
        if (addDeviceStep2.zones.length >= MAX_ZONES) return;
        addDeviceStep2.zones = [...addDeviceStep2.zones, { id: `zone-${Date.now()}`, name: '', active: true }];
        addDeviceZoneErrors = {};
    }

    function addDeviceRemoveZone(id: string) {
        if (addDeviceStep2Locked) return;
        if (addDeviceStep2.zones.length <= 1) return;
        addDeviceStep2.zones = addDeviceStep2.zones.filter((z) => z.id !== id);
        const next = { ...addDeviceZoneErrors };
        delete next[id];
        addDeviceZoneErrors = next;
    }

    function addDeviceToggleZoneActive(id: string) {
        if (addDeviceStep2Locked) return;
        const z = addDeviceStep2.zones.find((x) => x.id === id);
        if (z) z.active = !z.active;
        addDeviceStep2 = addDeviceStep2;
    }

    /** Generate ID matching server generateId() pattern (for init config compatibility with config push / API). */
    function genId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    /** Build config object from Step 2 init setup for DB storage. Format matches saveLayout/config push so API & device receive consistent structure. */
    function buildInitConfigFromStep2(step2: typeof addDeviceStep2, sensorName: string): Record<string, unknown> {
        const xMin = parseFloat(step2.trackingXMin);
        const xMax = parseFloat(step2.trackingXMax);
        const yMin = parseFloat(step2.trackingYMin);
        const yMax = parseFloat(step2.trackingYMax);
        const d = ADD_DEVICE_TRACKING_DEFAULTS;
        const startX = Number.isFinite(xMin) ? xMin : d.X_MIN;
        const endX = Number.isFinite(xMax) ? xMax : d.X_MAX;
        const startY = Number.isFinite(yMin) ? yMin : d.Y_MIN;
        const endY = Number.isFinite(yMax) ? yMax : d.Y_MAX;
        const baseName = sensorName?.trim() || 'Sensor';
        const trackingArea = {
            id: genId(),
            name: `${baseName} Tracking Area`,
            startX,
            startY,
            endX: Math.max(startX, endX),
            endY: Math.max(startY, endY)
        };
        const zones = (step2.zones || []).map((z, i) => ({
            id: genId(),
            name: z.name?.trim() || `Zone ${i + 1}`,
            zoneNumber: i + 1,
            active: z.active,
            startX: trackingArea.startX,
            startY: trackingArea.startY,
            endX: trackingArea.endX,
            endY: trackingArea.endY
        }));
        return {
            trackingArea,
            zones,
            deviceMode: step2.deviceMode || 'LIVE_PREVIEW',
            timezone: step2.timezone || 'UTC',
            pathTracking: step2.pathTracking ?? true,
            dwellThreshold: parseFloat(step2.dwellThreshold) || 0
        };
    }

    function addDeviceSubmit(input: {
        action: URL;
        formData: FormData;
        formElement: HTMLFormElement;
        controller: AbortController;
        submitter: HTMLElement | null;
        cancel: () => void;
    }) {
        addDeviceTrackingAreaErrors = {};
        // Validate zone names before submit (Step 2). Default zone (zone-1) is not required per design note.
        // Profile-locked step 2 skips manual zone checks (values come from assigned profile).
        if (addDeviceStep === 2 && addDeviceStep2.zones && !addDeviceStep2Locked) {
            const errors: Record<string, string> = {};
            for (const z of addDeviceStep2.zones) {
                if (z.id === 'zone-1') continue; // Default zone: do not require
                if (!z.name?.trim()) errors[z.id] = 'This field is required';
            }
            if (Object.keys(errors).length > 0) {
                addDeviceZoneErrors = errors;
                input.cancel();
                toast.error('Please fill out all zone names.');
                return () => {};
            }
            addDeviceZoneErrors = {};
            // Tracking Area: per-field validation (RADAR_CONSTRAINTS X -4..4, Y 0..7)
            if (!validateAddDeviceTrackingArea()) {
                input.cancel();
                return () => {};
            }
        }
        if (addDeviceStep === 2 && addDeviceStep2Locked && !validateAddDeviceTrackingArea()) {
            input.cancel();
            return () => {};
        }
        if (!claimedDeviceId) {
            addDeviceError = 'Device is not registered yet. Go back to step 1 and enter your PIN.';
            input.cancel();
            toast.error(addDeviceError);
            return () => {};
        }
        input.cancel();
        addDeviceLoading = true;
        addDeviceError = '';
        addDevicePinError = '';
        (async () => {
            try {
                const deviceId = claimedDeviceId;
                const name = '';
                let serialNumber = addDeviceForm.serialNumber?.trim() ?? '';
                if (!serialNumber) {
                    serialNumber = `RADAR-${Date.now().toString(36)}`;
                }
                const fd = new FormData();
                fd.set('deviceId', deviceId!);
                fd.set('name', name);
                fd.set('serialNumber', serialNumber);
                fd.set('description', addDeviceForm.description ?? '');
                fd.set('location', addDeviceForm.location ?? '');
                fd.set('firmware', addDeviceForm.firmware ?? '');
                fd.set('status', addDeviceForm.status || 'ACTIVE');
                // Init setup config: tracking area, zones, device settings (saved to DB for client API)
                const initConfig = buildInitConfigFromStep2(addDeviceStep2, claimedDeviceName || '');
                if (Object.keys(initConfig).length > 0) {
                    fd.set('initConfig', JSON.stringify(initConfig));
                }
                const res = await fetch('?/createSensorForDevice', { method: 'POST', body: fd });
                const raw = await res.text();
                const result = typeof raw === 'string' && raw.trim() ? (deserialize(raw) as { type?: string; data?: unknown }) : {};
                let actionData = result.data as
                    | { type?: string; controllerId?: string; message?: string }
                    | string
                    | undefined;
                // Some proxies or double-encoding can leave `data` as a devalue string; parse once more.
                if (typeof actionData === 'string' && actionData.trimStart().startsWith('[')) {
                    try {
                        actionData = deserialize(actionData) as { type?: string; controllerId?: string; message?: string };
                    } catch {
                        /* keep string */
                    }
                }
                const payload =
                    typeof actionData === 'object' && actionData !== null
                        ? actionData
                        : ({} as { type?: string; controllerId?: string; message?: string });

                if (result.type === 'failure') {
                    const err = String(payload.message ?? 'Failed to create sensor. Please try again.');
                    addDeviceError = err;
                    toast.error(err);
                } else if (result.type === 'success' && payload.controllerId) {
                    toast.success('Device registered successfully!');
                    showAddDeviceModal = false;
                    await invalidate('app:userControllersRadar');
                    goto(`/user/controllers/radar/${payload.controllerId}`, { noScroll: true });
                } else if (result.type === 'success' && payload.type === 'error' && payload.message) {
                    // Legacy server: returned { type: 'error', message } as action data (outer envelope was still success).
                    const err = payload.message;
                    addDeviceError = err;
                    toast.error(err);
                } else {
                    const err = payload.message || 'Failed to create sensor. Please try again.';
                    addDeviceError = err;
                    toast.error(err);
                }
            } catch (e) {
                const err = e instanceof Error ? e.message : String(e);
                const isPinRelated = /PIN|invalid|expired|registration code/i.test(err);
                if (isPinRelated) {
                    addDeviceStep = 1;
                    addDevicePinError = err;
                    addDeviceError = '';
                } else {
                    addDeviceError = err;
                }
                toast.error(err || 'Unable to register device. Please try again!');
            } finally {
                addDeviceLoading = false;
            }
        })();
        return () => {};
    }

    // Debounced search: only goto when search param actually changed (avoids resetting page after pagination click)
    $: if (browser && typeof searchValue !== 'undefined') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const currentSearch = $page.url.searchParams.get('search') || '';
            const newSearch = searchValue.trim();
            if (newSearch === currentSearch) return;
            const url = new URL($page.url);
            if (newSearch) {
                url.searchParams.set('search', newSearch);
            } else {
                url.searchParams.delete('search');
            }
            url.searchParams.set('page', '1');
            goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
        }, 500);
    }

    // Pagination state (server meta)
    $: pagination = {
        page: data.meta?.currentPage || 1,
        pageSize: data.meta?.itemsPerPage || 10,
        totalItems: data.meta?.totalItems || 0,
        totalPages: data.meta?.totalPages || 0
    };

    // Sort state (server sort)
    $: sort = {
        field: data.sort?.field || 'createdAt',
        direction: (data.sort?.order as 'asc' | 'desc') || 'desc'
    };

    // Real-time device connection via MQTT
    onMount(() => {
        if (browser) initializeDeviceRealtime();
    });

    // Table data: merge MQTT real-time connection into radar sensors
    $: tableDataRaw = (data.radarSensors || []) as unknown as SensorRow[];
    $: tableData = (() => {
        const store = $deviceRealtimeStore;
        if (!store) return tableDataRaw;
        return tableDataRaw.map((row: SensorRow) => {
            const deviceId = row.controller?.device?.id;
            const serverConnected = row.controller?.device?.connected === true;
            const connected = deviceId && store.getDevice(deviceId) !== null
                ? store.isDeviceConnected(deviceId)
                : serverConnected;
            return {
                ...row,
                controller: row.controller?.device
                    ? { ...row.controller, device: { ...row.controller.device, connected } }
                    : row.controller
            };
        });
    })();

    // Open Edit Device modal when navigated from detail page with ?editSensorId=
    let openedEditFromQuery = false;
    $: if (browser && (data as { editSensor?: unknown }).editSensor && !openedEditFromQuery) {
        openedEditFromQuery = true;
        openEditDeviceModal((data as unknown as { editSensor: SensorRow }).editSensor);
        const u = new URL($page.url);
        u.searchParams.delete('editSensorId');
        goto(u.pathname + u.search, { replaceState: true, noScroll: true, keepFocus: true });
    }

    function handleSort(event: CustomEvent<SortState>) {
        const next = event.detail;
        const url = new URL($page.url);
        if (next.field && next.direction) {
            url.searchParams.set('sort_field', next.field);
            url.searchParams.set('sort_order', next.direction);
        } else {
            url.searchParams.delete('sort_field');
            url.searchParams.delete('sort_order');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
    }

    function getControllerId(row: SensorRow): string {
        return (row.controller?.id ?? row.id) as string;
    }

    // Connection display: device MQTT online status (real-time)
    function connectionLabel(row: SensorRow): string {
        return row.controller?.device?.connected === true ? 'Online' : 'Offline';
    }

    function connectionColor(_value: string, row: SensorRow): BadgeColor {
        return row.controller?.device?.connected === true ? 'success' : 'gray';
    }

    /** Linked device MAC for list: macAddress, else lanMac, else wifiMac. */
    function deviceDisplayMac(row: SensorRow): string {
        const d = row.controller?.device;
        if (!d) return 'N/A';
        const v = d.macAddress?.trim() || d.lanMac?.trim() || d.wifiMac?.trim();
        return v || 'N/A';
    }

    // Status display: ACTIVE/INACTIVE lifecycle (not connection)
    function statusLabel(status: string): string {
        if (status === 'ACTIVE') return 'Active';
        if (status === 'INACTIVE') return 'Inactive';
        return status === 'MAINTENANCE' ? 'Maintenance' : status;
    }

    function statusColor(_value: string, row: SensorRow): BadgeColor {
        const s = row.status;
        if (s === 'ACTIVE') return 'success';
        if (s === 'INACTIVE') return 'gray';
        if (s === 'MAINTENANCE') return 'warning';
        return 'gray';
    }

    // Column widths: fixed px like Devices table for consistent look
    $: columns = [
        {
            id: 'name',
            header: 'Device',
            accessor: (row: SensorRow) => row.controller?.device?.name ?? row.name ?? '',
            type: 'custom' as const,
            sortable: true,
            width: '220px',
            render: (_value: unknown, row: SensorRow) => {
                const name = (row.controller?.device?.name ?? row.name) ?? '—';
                const id = row.id ?? '';
                const link = `<a href="/user/controllers/radar/${getControllerId(row)}" class="text-[14px] font-medium text-[var(--ds-text-link)] hover:text-[var(--ds-text-link-hover)] hover:underline truncate block">${name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</a>`;
                const idLine = id ? `<div style="font-family: var(--ds-font-family-primary); font-size: 12px; color: var(--ds-color-gray-500); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;" title="${id.replace(/"/g, '&quot;')}">${id.replace(/</g, '&lt;')}</div>` : '';
                return `<div class="flex flex-col gap-0 min-w-0"><span class="min-w-0">${link}</span>${idLine}</div>`;
            }
        },
        {
            id: 'deviceMac',
            header: 'MAC address',
            accessor: (row: SensorRow) => deviceDisplayMac(row),
            type: 'text' as const,
            sortable: true,
            width: '170px'
        },
        {
            id: 'connection',
            header: 'Connection',
            accessor: (row: SensorRow) => connectionLabel(row),
            type: 'badge' as const,
            width: '120px',
            statusColor: connectionColor
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row: SensorRow) => statusLabel(row.status),
            type: 'badge' as const,
            sortable: true,
            statusColor,
            width: '120px'
        },
        {
            id: 'lastDevicePing',
            header: 'Last ping',
            accessor: (row: SensorRow) =>
                row.deviceLastPingAt ?? row.updatedAt ?? row.createdAt,
            type: 'relativeTime' as const,
            sortable: true,
            width: '150px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu' as const,
            width: '80px',
            getMenuActions: (row: SensorRow) => {
                const controllerId = getControllerId(row);
                return [
                    {
                        id: 'live-preview',
                        label: 'Live Preview',
                        onClick: () => goto(`/user/controllers/radar/${controllerId}?tab=live-preview`)
                    },
                    {
                        id: 'view',
                        label: 'View',
                        onClick: () => goto(`/user/controllers/radar/${controllerId}`)
                    },
                    {
                        id: 'edit',
                        label: 'Edit',
                        onClick: (row: SensorRow) => openEditDeviceModal(row)
                    },
                    {
                        id: 'delete',
                        label: 'Delete',
                        color: 'danger' as const,
                        onClick: (row: SensorRow) => openDeleteModal(row)
                    }
                ];
            }
        }
    ];

    function handleRowClick(event: CustomEvent<{ row: SensorRow; index: number }>) {
        const controllerId = getControllerId(event.detail.row);
        goto(`/user/controllers/radar/${controllerId}`);
    }
</script>

<!-- Main wrap: same layout as devices listing (padding 24px, gap 16px) -->
<div class="sensors-listing-wrap">
    <!-- Search & filter bar: gap 16px, height 48px -->
    <div class="sensors-listing-toolbar">
        <div style="width: 500px; height: 48px;">
            <InputField
                type="search"
                placeholder="Search by device name, serial, MAC, IP…"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>

        <div style="flex: 1;"></div>

        <Button
            variant="outline"
            color="gray"
            size="lg"
            iconOnly={true}
            icon={Filter}
            iconPosition="only"
            on:click={openFilterModal}
        />

        {#if showCreateButton}
            <Button
                variant="filled"
                color="primary"
                size="lg"
                iconLeft={true}
                on:click={openAddDeviceModal}
            >
                <Plus size={20} slot="icon-left" />
                Register Device
            </Button>
        {/if}
    </div>

    <!-- Table per design -->
    <div class="w-full">
        <DataTable
            {columns}
            data={tableData}
            keyField="id"
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage={showCreateButton
                ? 'No sensors found. Use "Register Device" to add a sensor by entering your device\'s 6-digit registration code (PIN).'
                : 'No sensors found. Register a device with its PIN to create a sensor.'}
            on:sort={handleSort}
            on:pageChange={handlePageChange}
            on:rowClick={handleRowClick}
        />
    </div>
</div>

<!-- Filter Modal: Connection Status + MAC address dropdowns per design -->
<Modal
    open={showFilterModal}
    title="Filter"
    size="md"
    showFooter={false}
    on:close={() => (showFilterModal = false)}
>
    <div class="flex flex-col gap-5 w-full min-w-0">
        <div class="flex flex-col gap-2 w-full min-w-0">
            <span class="text-sm font-medium text-[var(--ds-text-primary)]">Connection Status</span>
            <Dropdown
                label=""
                placeholder="Select"
                options={statusDropdownOptions}
                value={filterStatuses}
                multiple={true}
                width="100%"
                on:change={handleStatusFilterChange}
            />
        </div>
        <div class="flex flex-col gap-2 w-full min-w-0">
            <span class="text-sm font-medium text-[var(--ds-text-primary)]">MAC address</span>
            <Dropdown
                label=""
                placeholder="Select"
                options={deviceMacDropdownOptions}
                value={filterDeviceMacs}
                multiple={true}
                width="100%"
                on:change={handleDeviceMacFilterChange}
            />
        </div>
    </div>
    <div slot="footer" class="flex justify-end gap-3">
        <Button variant="text" color="primary" on:click={clearFilter}>
            Clear All
        </Button>
        <Button variant="filled" color="primary" on:click={applyFilter}>
            Apply
        </Button>
    </div>
</Modal>

<!-- Add Device modal – Figma: header / body (scrollable) / footer (fixed). Footer in Modal footer slot, not inside body. -->
<Modal
    open={showAddDeviceModal}
    title="Add Device"
    size="xl"
    showFooter={false}
    on:close={closeAddDeviceModal}
>
    <form
        id="add-device-form"
        method="POST"
        action="?/create"
        use:enhance={addDeviceSubmit}
        class="add-device-form"
    >
        <input type="hidden" name="accountId" value={addDeviceForm.accountId} />
        <input type="hidden" name="pin" value={addDeviceForm.pin} />
        <input type="hidden" name="status" value={addDeviceForm.status} />
        <input type="hidden" name="name" value={addDeviceForm.name} />
        <input type="hidden" name="location" value={addDeviceForm.location} />
        <input type="hidden" name="serialNumber" value={addDeviceForm.serialNumber} />
        <input type="hidden" name="description" value={addDeviceForm.description ?? ''} />
        <input type="hidden" name="firmware" value={addDeviceForm.firmware ?? ''} />

        {#if addDeviceError}
            <Alert
                severity="error"
                variant="outline"
                message={addDeviceError}
                dismissible={true}
                on:dismiss={() => (addDeviceError = '')}
            />
        {/if}

        {#if addDeviceStep === 1}
            <!-- Step 1: PIN — claim runs on Next; device name is the MAC-style device list name after claim. -->
            <div class="add-device-fields">
                <div class="add-device-field add-device-field-full add-device-field-with-pin-help">
                    <InputField
                        label="Device Registration Code"
                        type="text"
                        bind:value={addDeviceForm.pin}
                        placeholder="000 000"
                        required={true}
                        disabled={addDeviceLoading}
                        align="center"
                        state={addDevicePinError ? 'error' : 'default'}
                        helperText={addDevicePinError}
                    />
                    <div class="add-device-pin-help">
                        <div class="add-device-pin-help-row">
                            <span class="add-device-pin-help-icon" aria-hidden="true">
                                <Info size={20} strokeWidth={2} />
                            </span>
                            <span class="add-device-pin-help-title">Need help finding your device PIN?</span>
                        </div>
                        <ul class="add-device-pin-help-list">
                            <li>The PIN is a 6-digit code displayed on your device or terminal during setup</li>
                            <li>For camera devices, the code may appear on the device's screen</li>
                            <li>If you can't find the code, try resetting the device</li>
                        </ul>
                    </div>
                </div>
                <div class="add-device-field add-device-field-full">
                    <InputField
                        label="Location"
                        type="text"
                        bind:value={addDeviceForm.location}
                        placeholder="Enter"
                        disabled={addDeviceLoading}
                    />
                </div>
            </div>
        {:else}
            <!-- Step 2: Configuration Template, Tracking Area, Zones, Device Settings -->
            <div class="add-device-fields">
                {#if addDeviceStep2Locked}
                    <Alert
                        severity="info"
                        variant="outline"
                        message={addDeviceProfileLabel
                            ? `Configuration is read-only and comes from the profile assigned to this device (${addDeviceProfileLabel}).`
                            : 'Configuration is read-only and comes from the profile assigned to this device.'}
                        dismissible={false}
                    />
                {/if}
                <div class="add-device-field add-device-field-full">
                    <Dropdown
                        label="Configuration Template"
                        placeholder="Select"
                        options={configTemplateOptions}
                        value={addDeviceStep2.configTemplate}
                        width="100%"
                        disabled={step2InputsDisabled}
                    />
                </div>
                <div class="add-device-section">
                    <h3 class="add-device-section-title">Tracking Area</h3>
                    <div class="add-device-row">
                        <div class="add-device-field">
                            <InputField
                                label="X Min (m)"
                                type="text"
                                bind:value={addDeviceStep2.trackingXMin}
                                placeholder="-4 to 4"
                                disabled={step2InputsDisabled}
                                required={true}
                                state={addDeviceTrackingAreaErrors.xMin ? 'error' : 'default'}
                                helperText={addDeviceTrackingAreaErrors.xMin || ''}
                                on:blur={() => { addDeviceTrackingAreaErrors = { ...addDeviceTrackingAreaErrors, xMin: validateAddDeviceTrackingField(addDeviceStep2.trackingXMin?.trim() ?? '', true) }; }}
                            />
                        </div>
                        <div class="add-device-field">
                            <InputField
                                label="Y Min (m)"
                                type="text"
                                bind:value={addDeviceStep2.trackingYMin}
                                placeholder="0 to 7"
                                disabled={step2InputsDisabled}
                                required={true}
                                state={addDeviceTrackingAreaErrors.yMin ? 'error' : 'default'}
                                helperText={addDeviceTrackingAreaErrors.yMin || ''}
                                on:blur={() => { addDeviceTrackingAreaErrors = { ...addDeviceTrackingAreaErrors, yMin: validateAddDeviceTrackingField(addDeviceStep2.trackingYMin?.trim() ?? '', false) }; }}
                            />
                        </div>
                        <div class="add-device-field">
                            <InputField
                                label="X Max (m)"
                                type="text"
                                bind:value={addDeviceStep2.trackingXMax}
                                placeholder="-4 to 4"
                                disabled={step2InputsDisabled}
                                required={true}
                                state={addDeviceTrackingAreaErrors.xMax ? 'error' : 'default'}
                                helperText={addDeviceTrackingAreaErrors.xMax || ''}
                                on:blur={() => { addDeviceTrackingAreaErrors = { ...addDeviceTrackingAreaErrors, xMax: validateAddDeviceTrackingField(addDeviceStep2.trackingXMax?.trim() ?? '', true) }; }}
                            />
                        </div>
                        <div class="add-device-field">
                            <InputField
                                label="Y Max (m)"
                                type="text"
                                bind:value={addDeviceStep2.trackingYMax}
                                placeholder="0 to 7"
                                disabled={step2InputsDisabled}
                                required={true}
                                state={addDeviceTrackingAreaErrors.yMax ? 'error' : 'default'}
                                helperText={addDeviceTrackingAreaErrors.yMax || ''}
                                on:blur={() => { addDeviceTrackingAreaErrors = { ...addDeviceTrackingAreaErrors, yMax: validateAddDeviceTrackingField(addDeviceStep2.trackingYMax?.trim() ?? '', false) }; }}
                            />
                        </div>
                    </div>
                </div>
                <!-- Zones: Frame 54 = title + Add Zone (disabled at 5 with tooltip); zone wrap = Toggle + Input + Trash -->
                <div class="add-device-section">
                    <div class="add-device-zones-header">
                        <h3 class="add-device-section-title">Zones</h3>
                        <div class="add-device-add-zone-right">
                            {#if addDeviceStep2.zones.length >= MAX_ZONES}
                                <span class="add-device-add-zone-trigger-wrap">
                                    <Tooltip text="Maximum 5 zones per device" position="bottom" arrow="top" theme="dark" portal={true}>
                                        <Button
                                            type="button"
                                            variant="text"
                                            color="primary"
                                            size="sm"
                                            disabled={true}
                                            icon={Plus}
                                            iconPosition="left"
                                            class="add-device-add-zone-btn add-device-add-zone-btn-disabled"
                                        >
                                            Add Zone
                                        </Button>
                                    </Tooltip>
                                </span>
                            {:else}
                                <Button
                                    type="button"
                                    variant="text"
                                    color="primary"
                                    size="sm"
                                    icon={Plus}
                                    iconPosition="left"
                                    on:click={addDeviceAddZone}
                                    disabled={step2InputsDisabled}
                                    class="add-device-add-zone-btn"
                                >
                                    Add Zone
                                </Button>
                            {/if}
                        </div>
                    </div>
                    {#each addDeviceStep2.zones as zone (zone.id)}
                        <div class="add-device-zone-wrap">
                            <div class="add-device-zone-toggle">
                                <Tooltip text={zone.active ? 'Active Zone' : 'Inactive Zone'} position="top" theme="dark" portal={true}>
                                    <Toggle
                                        size="sm"
                                        checked={zone.active}
                                        disabled={step2InputsDisabled}
                                        on:change={() => addDeviceToggleZoneActive(zone.id)}
                                    />
                                </Tooltip>
                            </div>
                            <div class="add-device-zone-input">
                                <InputField
                                    type="text"
                                    bind:value={zone.name}
                                    placeholder="Enter"
                                    disabled={step2InputsDisabled}
                                    state={addDeviceZoneErrors[zone.id] ? 'error' : 'default'}
                                    helperText={addDeviceZoneErrors[zone.id] || ''}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                color="danger"
                                size="md"
                                icon={Trash2}
                                iconPosition="only"
                                iconSize={20}
                                aria-label="Delete zone"
                                disabled={step2InputsDisabled || addDeviceStep2.zones.length <= 1}
                                on:click={() => addDeviceRemoveZone(zone.id)}
                                class="add-device-zone-delete"
                            />
                        </div>
                    {/each}
                </div>
                <div class="add-device-section">
                    <h3 class="add-device-section-title">Device Settings</h3>
                    <div class="add-device-row add-device-row-device-settings">
                        <div class="add-device-field">
                            <Dropdown
                                label="Device Mode"
                                placeholder="Select"
                                options={[{ id: 'LIVE_PREVIEW', label: 'Live Preview' }, { id: 'BACKGROUND', label: 'Background' }]}
                                value={addDeviceStep2.deviceMode}
                                width="100%"
                                preferPlacement="bottom"
                                disabled={step2InputsDisabled}
                                on:change={(e) => {
                                    const v = e.detail;
                                    addDeviceStep2.deviceMode = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
                                    addDeviceStep2 = addDeviceStep2;
                                }}
                            />
                        </div>
                        <div class="add-device-field">
                            <Dropdown
                                label="Timezone"
                                placeholder="Select"
                                options={timezoneOptions}
                                value={addDeviceStep2.timezone}
                                width="100%"
                                preferPlacement="bottom"
                                disabled={step2InputsDisabled}
                                on:change={(e) => {
                                    const v = e.detail;
                                    addDeviceStep2.timezone = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
                                    addDeviceStep2 = addDeviceStep2;
                                }}
                            />
                        </div>
                    </div>
                    <div class="add-device-path-tracking-row">
                        <div class="add-device-path-tracking-cell-text">
                            <span class="add-device-path-tracking-title">Path Tracking</span>
                            <span class="add-device-path-tracking-desc">Enable movement path recording</span>
                        </div>
                        <div class="add-device-path-tracking-cell-toggle">
                            <Toggle
                                size="sm"
                                checked={addDeviceStep2.pathTracking}
                                disabled={step2InputsDisabled}
                                on:change={() => {
                                    addDeviceStep2.pathTracking = !addDeviceStep2.pathTracking;
                                    addDeviceStep2 = addDeviceStep2;
                                }}
                            />
                        </div>
                    </div>
                    <div class="add-device-dwell-row">
                        <label class="add-device-dwell-label" for="add-device-dwell-threshold">Dwell Threshold</label>
                        <div class="add-device-dwell-control">
                            <div class="add-device-dwell-slider-wrap">
                                <ProgressBar
                                    value={Math.min(100, (parseFloat(addDeviceStep2.dwellThreshold) || 0) / 60 * 100)}
                                    showThumb={true}
                                    size="md"
                                    color="gray"
                                />
                                <input
                                    id="add-device-dwell-threshold"
                                    type="range"
                                    class="add-device-dwell-range"
                                    min="0"
                                    max="60"
                                    step="1"
                                    value={parseFloat(addDeviceStep2.dwellThreshold) || 0}
                                    disabled={step2InputsDisabled}
                                    on:input={(e) => setDwellThresholdFromInput(e.currentTarget)}
                                />
                            </div>
                            <div class="add-device-dwell-value-wrap">
                                <span class="add-device-dwell-value">{addDeviceStep2.dwellThreshold || '0'}</span>
                                <span class="add-device-dwell-unit">sec</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </form>

    <!-- Footer: rendered in Modal footer slot (sibling of body), not inside form/body -->
    <svelte:fragment slot="footer">
        {#if addDeviceStep === 1}
            <div class="add-device-actions">
                <Button type="button" variant="outline" color="primary" size="lg" on:click={closeAddDeviceModal} disabled={addDeviceLoading}>
                    Cancel
                </Button>
                <Button type="button" variant="filled" color="primary" size="lg" on:click={addDeviceStep1Next} disabled={addDeviceLoading}>
                    Next
                </Button>
            </div>
        {:else}
            <div class="add-device-actions add-device-actions-step2">
                <div class="add-device-actions-right">
                    <Button type="button" variant="outline" color="primary" size="lg" on:click={closeAddDeviceModal} disabled={addDeviceLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" form="add-device-form" variant="filled" color="primary" size="lg" disabled={addDeviceLoading}>
                        {#if addDeviceLoading}
                            Registering…
                        {:else}
                            Register
                        {/if}
                    </Button>
                </div>
            </div>
        {/if}
    </svelte:fragment>
</Modal>

<!-- Edit Device modal – shared with Detail page -->
<EditDeviceModal
    bind:open={showEditDeviceModal}
    sensor={sensorToEditForModal}
    onSave={submitEditDeviceFromModal}
    onClose={closeEditDeviceModal}
/>

<!-- Delete confirmation modal (per design: red icon, title, message, Cancel + Delete) -->
<Modal
    open={showDeleteModal}
    title="Delete Sensor"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDeleteSensor}
>
    <p class="text-[var(--ds-text-secondary)]">
        Are you sure you want to delete this sensor? This action cannot be reversed.
    </p>
</Modal>

<style>
    .sensors-listing-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: var(--ds-space-6, 24px);
        gap: var(--ds-space-4, 16px);
    }
    .sensors-listing-toolbar {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-4, 16px);
        height: 48px;
        width: 100%;
    }

    /* Edit Device modal – body padding 16px gap 16px, tabs underline */
    .edit-device-form {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        width: 100%;
        min-width: 0;
        font-family: var(--ds-font-family-primary);
    }
    .edit-device-tabs-wrap {
        width: 100%;
        border-bottom: 1px solid var(--ds-color-neutral-true-200, #E5E5E5);
    }
    /* Alert tab: section = title + desc outside, cards with gap between them */
    .edit-device-alert-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3, 12px);
        width: 100%;
    }
    .edit-device-alert-section-header {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
    }
    .edit-device-alert-desc {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: var(--ds-color-gray-600, #475467);
        margin: 0;
    }
    .edit-device-alert-table-wrap {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3, 12px);
    }
    /* One card per rule: title row + optional divider + input row stay grouped */
    .edit-device-alert-card {
        width: 100%;
        background: var(--ds-color-neutral-true-50, #FAFAFA);
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .edit-device-alert-card-divider {
        width: 100%;
        height: 0;
        border: none;
        border-top: 1px solid var(--ds-color-gray-200, #EAECF0);
        flex-shrink: 0;
        margin: 0;
    }
    .edit-device-alert-table-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-4);
        padding: 16px;
        min-height: 52px;
        box-sizing: border-box;
    }
    /* Clear vertical gap between divider and input row (toggle content); row height fits 52px field */
    .edit-device-alert-table-row.edit-device-alert-input-row {
        align-items: center;
        min-height: 0;
        padding: 16px;
        margin-top: var(--ds-space-2, 8px);
    }
    /* Threshold / label-field rows: InputField from design-system, horizontal layout (label left, input right) */
    .edit-device-alert-threshold-row,
    .edit-device-alert-label-field-row {
        align-items: center;
        gap: var(--ds-space-4, 16px);
    }
    /* Email / Webhook: label left, input right (space-between) */
    .edit-device-alert-label-field-row.edit-device-alert-field-row-end {
        justify-content: space-between;
    }
    .edit-device-alert-threshold-row :global(.input-field-wrapper),
    .edit-device-alert-label-field-row :global(.input-field-wrapper) {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: row;
        align-items: center;
    }
    .edit-device-alert-threshold-row :global(.input-label),
    .edit-device-alert-label-field-row :global(.input-label) {
        margin-bottom: 0;
        margin-right: var(--ds-space-3, 12px);
        flex-shrink: 0;
    }
    .edit-device-alert-threshold-row :global(.input-container),
    .edit-device-alert-label-field-row :global(.input-container) {
        flex: 1;
        min-width: 0;
    }
    .edit-device-alert-threshold-label {
        flex-shrink: 0;
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: var(--ds-color-neutral-true-600, #525252);
    }
    /* Single white box (328px, 52px height, 8px radius per Figma Base/Input) for Threshold + unit/dropdown */
    .edit-device-alert-field-box {
        display: flex;
        flex-direction: row;
        align-items: center;
        align-self: center;
        width: 100%;
        max-width: 328px;
        height: 52px;
        min-height: 52px;
        max-height: 52px;
        padding: 0;
        background: var(--ds-color-gray-1-9, #FEFEFE);
        border: 1px solid var(--ds-color-neutral-true-300, #D6D6D6);
        border-radius: var(--ds-radius-lg, 8px);
        overflow: hidden;
        flex-shrink: 0;
        box-sizing: border-box;
    }
    .edit-device-alert-field-box :global(.input-field-wrapper) {
        flex: 1;
        min-width: 0;
        margin: 0;
        border: none;
        min-height: 0;
        align-self: stretch;
    }
    /* Content wrap: padding 12px 14px per Figma; keep height within 52px box */
    .edit-device-alert-field-box :global(.input-container) {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        border-radius: 0;
        height: 100%;
        min-height: 0;
        max-height: 52px;
        padding: 12px 14px;
    }
    /* Suffix (inline unit e.g. "minutes"): padding 14px, Text Neutral True/800 */
    .edit-device-alert-field-box .edit-device-alert-unit-inline {
        flex-shrink: 0;
        padding: 14px;
        font-family: var(--ds-font-family-primary);
        font-size: 16px;
        line-height: 24px;
        color: var(--ds-color-neutral-true-800, #292929);
    }
    /* Suffix (unit dropdown): _Base/ Prefix & Suffix – padding 14px, gap 8px; ensure "minutes"/"hours" not truncated */
    .edit-device-alert-field-box .edit-device-alert-unit-dropdown {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        min-width: 120px;
        max-width: 140px;
        padding: 14px;
        gap: 8px;
        box-sizing: border-box;
    }
    .edit-device-alert-field-box .edit-device-alert-unit-dropdown :global(.dropdown-container) {
        flex: 1;
        min-width: 0;
    }
    .edit-device-alert-field-box .edit-device-alert-unit-dropdown :global(.dropdown-trigger) {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        border-radius: 0;
        min-height: 24px;
        padding: 0;
        min-width: 0;
    }
    .edit-device-alert-field-box .edit-device-alert-unit-dropdown :global(.dropdown-trigger-text) {
        min-width: 4.5em;
        flex: 1 1 auto;
    }
    .edit-device-alert-unit-inline {
        flex-shrink: 0;
        font-family: var(--ds-font-family-primary);
        font-size: 16px;
        line-height: 24px;
        color: var(--ds-color-neutral-true-500, #737373);
    }
    /* Dwell field: InputField inside white box – no border so it blends */
    .edit-device-alert-dwell-input-wrap {
        flex: 1;
        min-width: 80px;
        max-width: 120px;
    }
    .edit-device-alert-dwell-input-wrap :global(.input-field-wrapper) {
        margin: 0;
        border: none;
        min-height: 0;
        align-self: stretch;
    }
    /* Middle segment: content wrap – padding 12px 14px per Figma; keep within 52px */
    .edit-device-alert-dwell-input-wrap :global(.input-container) {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        padding: 12px 14px;
        height: 100%;
        min-height: 0;
        max-height: 52px;
    }
    /* Zone & Threshold: one white box (328px, 52px height, 8px radius per Figma Base/Input) */
    .edit-device-alert-dwell-field {
        flex: 1;
        min-width: 0;
        max-width: 328px;
        display: flex;
        flex-direction: row;
        align-items: center;
        align-self: center;
        height: 52px;
        min-height: 52px;
        max-height: 52px;
        padding: 0;
        background: var(--ds-color-gray-1-9, #FEFEFE);
        border: 1px solid var(--ds-color-neutral-true-300, #D6D6D6);
        border-radius: var(--ds-radius-lg, 8px);
        box-sizing: border-box;
        overflow: hidden;
        flex-shrink: 0;
    }
    /* Zone segment: _Base/ Prefix & Suffix – padding 14px, gap 4px, border-right divider */
    .edit-device-alert-dwell-zone-wrap {
        flex: 1 1 auto;
        min-width: 0;
        max-width: 140px;
        display: flex;
        align-items: center;
        padding: 14px;
        gap: 4px;
        border-right: 1px solid var(--ds-color-neutral-true-300, #D6D6D6);
        box-sizing: border-box;
    }
    .edit-device-alert-dwell-zone-wrap :global(.dropdown-container) {
        width: 100%;
        border: none;
    }
    .edit-device-alert-dwell-zone-wrap :global(.dropdown-trigger) {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        border-radius: 0;
        min-height: 24px;
        padding: 0;
    }
    .edit-device-alert-field-divider {
        width: 1px;
        align-self: stretch;
        background: var(--ds-color-neutral-true-300, #D6D6D6);
        flex-shrink: 0;
    }
    /* Right segment (seconds): padding 14px, width 96px, Body/16px, Neutral True/400 */
    .edit-device-alert-dwell-field .edit-device-alert-unit-inline {
        flex: none;
        min-width: 96px;
        padding: 14px;
        font-family: var(--ds-font-family-primary);
        font-size: 16px;
        line-height: 24px;
        color: var(--ds-color-neutral-true-400, #A3A3A3);
    }
    .edit-device-alert-divider {
        width: 100%;
        height: 0;
        border: none;
        border-top: 1px solid var(--ds-color-neutral-true-200, #E5E5E5);
        margin: var(--ds-space-6, 24px) 0;
        flex-shrink: 0;
    }
    .edit-device-alert-rule-label-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .edit-device-alert-rule-title {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        color: var(--ds-text-primary);
    }
    .edit-device-alert-rule-desc {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: var(--ds-color-neutral-true-500, #737373);
    }
    .edit-device-alert-table-row.edit-device-alert-input-row {
        flex-wrap: wrap;
    }
    .edit-device-alert-table-row .edit-device-alert-unit-text {
        align-self: center;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-base);
        line-height: 24px;
        color: var(--ds-text-tertiary);
        padding-bottom: 10px;
    }
    .edit-device-alert-unit-dropdown {
        min-width: 120px;
        max-width: 140px;
    }
    .edit-device-alert-table-row.edit-device-alert-input-row :global(.input-field-wrapper) {
        flex: 1;
        min-width: 0;
    }
    /* Email / Webhook: cap input area at 328px per design */
    .edit-device-alert-label-field-row > :global(.input-field-wrapper) {
        max-width: 328px;
    }

    /* Form must take full width of modal body and allow shrink (min-width: 0) to prevent flex overflow / content collapse */
    .add-device-form {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    /* Sync all field labels in Add Device form: Body/14px/14-Regular, line-height 20px, Neutral True/600 */
    .add-device-form :global(.dropdown-label .label-text),
    .add-device-form :global(.input-field-wrapper .input-label .input-label-text),
    .add-device-path-tracking-title,
    .add-device-dwell-label {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: var(--ds-color-neutral-true-600, #525252);
    }
    .add-device-fields {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        width: 100%;
        min-width: 0;
    }
    .add-device-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ds-space-4, 16px);
        width: 100%;
        min-width: 0;
    }
    /* Device Settings: align two dropdowns to same height (48px trigger) */
    .add-device-row-device-settings {
        align-items: start;
    }
    .add-device-row-device-settings .add-device-field {
        min-width: 0;
    }
    .add-device-row-device-settings .add-device-field :global(button[class*="dropdown-trigger"]) {
        min-height: 48px;
        height: 48px;
    }
    .add-device-row-full {
        grid-template-columns: 1fr;
    }
    .add-device-row-4 {
        grid-template-columns: repeat(4, 1fr);
    }
    /* Section wrap – Figma: Neutral True/50 #FAFAFA, padding 16px, gap 16px, radius 8px */
    .add-device-section {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: var(--ds-space-4);
        gap: var(--ds-space-4);
        width: 100%;
        min-width: 0;
        background: var(--ds-color-neutral-true-50);
        border-radius: var(--ds-radius-lg);
    }
    .add-device-constraint-hint {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
        margin: 0 0 var(--ds-space-1) 0;
    }
    .add-device-tracking-area-error {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-error-500);
        margin: var(--ds-space-1) 0 0 0;
    }
    .add-device-section-title {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-base, 1rem);
        font-weight: 600;
        line-height: 24px;
        color: var(--ds-color-neutral-true-700);
        margin: 0;
    }
    /* Zones – Frame 54: row title + Add Zone; zone wrap: Toggle 36px + Input flex-1 + Trash 40px, gap 16px */
    .add-device-zones-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
        width: 100%;
    }
    .add-device-zones-header .add-device-section-title {
        flex: 0 0 auto;
    }
    .add-device-add-zone-right {
        margin-left: auto;
        flex: none;
    }
    .add-device-add-zone-trigger-wrap {
        display: inline-flex;
        width: fit-content;
    }
    .add-device-zones-header :global(.add-device-add-zone-btn) {
        min-width: 130px;
        padding-left: var(--ds-space-4);
        padding-right: var(--ds-space-4);
    }
    .add-device-zones-header :global(.add-device-add-zone-btn-disabled) :global(svg),
    .add-device-zones-header :global(.add-device-add-zone-btn-disabled) :global(span) {
        color: var(--ds-color-neutral-true-400) !important;
        stroke: var(--ds-color-neutral-true-400);
    }
    .add-device-zone-wrap {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-4);
        width: 100%;
        min-height: 48px;
    }
    .add-device-zone-toggle {
        flex: none;
        width: 36px;
        display: flex;
        align-items: center;
    }
    .add-device-zone-input {
        flex: 1 1 auto;
        min-width: 0;
    }
    .add-device-zone-wrap :global(.add-device-zone-delete) {
        flex: none;
    }
    .add-device-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        min-width: 0;
        width: 100%;
    }
    .add-device-field-full {
        grid-column: 1 / -1;
        width: 100%;
    }
    .add-device-field-with-pin-help {
        gap: 16px;
    }
    /* Path Tracking row – Figma: Device record 816×52, table cell text (flex 1) + table cell toggle 36×52 */
    .add-device-path-tracking-row {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: 0;
        width: 100%;
        height: 52px;
        flex: none;
    }
    .add-device-path-tracking-cell-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 0;
        min-height: 40px;
        justify-content: center;
        flex: 1;
        min-width: 0;
    }
    .add-device-path-tracking-desc {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: var(--ds-color-neutral-true-500, #737373);
    }
    .add-device-path-tracking-cell-toggle {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: 16px 0;
        gap: 12px;
        width: 36px;
        height: 52px;
        min-height: 52px;
        flex: none;
    }
    /* Dwell Threshold – Figma: fields wrap 816×80, label 14px Regular #525252, control row 52px, progress flex-1 8px, value box 130×52 */
    .add-device-dwell-row {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 4px;
        width: 100%;
    }
    .add-device-dwell-control {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
        gap: 16px;
        width: 100%;
        height: 52px;
    }
    .add-device-dwell-slider-wrap {
        position: relative;
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        min-height: 12px;
    }
    .add-device-dwell-slider-wrap :global(.progress-container) {
        width: 100%;
    }
    .add-device-dwell-range {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
        z-index: 2;
        -webkit-appearance: none;
        appearance: none;
    }
    .add-device-dwell-value-wrap {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 12px 14px;
        gap: 4px;
        width: 130px;
        height: 52px;
        min-height: 52px;
        background: var(--ds-color-gray-1-9, #FEFEFE);
        border: 1px solid var(--ds-color-neutral-true-300, #D6D6D6);
        border-radius: 8px;
        flex: none;
    }
    .add-device-dwell-value {
        font-family: var(--ds-font-family-primary);
        font-size: 16px;
        line-height: 24px;
        font-weight: 400;
        color: var(--ds-color-neutral-true-900, #141414);
    }
    .add-device-dwell-unit {
        font-family: var(--ds-font-family-primary);
        font-size: 16px;
        line-height: 24px;
        font-weight: 400;
        color: var(--ds-color-neutral-true-400, #A3A3A3);
    }
    /* Footer actions – now inside Modal footer slot (modal-footer provides border-top + padding). Step 1: buttons right; Step 2: Back left, Cancel+Register right */
    .add-device-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--ds-space-4);
        flex: none;
        width: 100%;
    }
    .add-device-actions-step2 {
        justify-content: space-between;
    }
    .add-device-actions-right {
        display: flex;
        align-items: center;
        gap: var(--ds-space-4);
    }

    /* PIN help – Figma Frame 34: flex column, justify-content center, align-items center, padding 12px, gap 8px, bg Neutral True/50, radius 8px */
    .add-device-pin-help {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: var(--ds-space-3); /* 12px */
        gap: var(--ds-space-2); /* 8px */
        width: 100%;
        box-sizing: border-box;
        background: var(--ds-color-neutral-true-50); /* #FAFAFA */
        border-radius: var(--ds-radius-lg); /* 8px */
        flex: none;
        align-self: stretch;
    }
    /* Frame 35: row, gap 10px, icon 20px, title 14px semibold Neutral True/800 */
    .add-device-pin-help-row {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        gap: 10px;
        width: 100%;
    }
    .add-device-pin-help-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        color: var(--ds-color-neutral-true-600); /* #525252 */
    }
    .add-device-pin-help-title {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: 600;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-800); /* #292929 */
    }
    /* Body: 14px regular, line-height 20px, Neutral True/500 #737373; list on separate lines */
    .add-device-pin-help-list {
        display: block;
        margin: 0;
        padding-left: var(--ds-space-6);
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: var(--ds-color-neutral-true-500); /* #737373 */
        list-style-type: disc;
    }
    .add-device-pin-help-list li {
        display: list-item;
        margin-bottom: var(--ds-space-1);
    }
    .add-device-pin-help-list li:last-child {
        margin-bottom: 0;
    }
</style>
