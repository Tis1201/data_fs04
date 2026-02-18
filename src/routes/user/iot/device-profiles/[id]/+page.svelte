<script lang="ts">
    import { goto, invalidate, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount, onDestroy } from 'svelte';
    import { Button, Card, Badge, TabGroup, ConfirmModal, ActionMenu, Modal } from '$lib/design-system/components';
    import { Pencil, Settings2, HardDriveUpload, ChevronDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Plus, Tag, Search, X, UserMinus } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
    import { toast } from '$lib/stores/alertToast';
    import AddEditProfileModal from '../components/AddEditProfileModal.svelte';
    import DeviceSelector from '$lib/components/ui_components_sveltekit/device_profiles/DeviceSelector.svelte';
    import { useDeviceProfileMqtt } from '$lib/composables/useDeviceProfileMqtt';

    export let data: PageData;
    /** From layout/route – accept to avoid "unknown prop" warning */
    export let params: Record<string, string> = {};

    $: profile = data?.profile ?? null;

    const basePath = '/user/iot';
    const listPath = '/user/iot/device-profiles';
    $: profileId = profile?.id ?? '';

    // Real-time apply status: when device reports success/fail, refresh so Apply status column updates
    const { setup: setupProfileMqtt } = useDeviceProfileMqtt({
        profileId,
        onStatusUpdate: () => invalidate('app:deviceProfile'),
        onProgressUpdate: () => invalidate('app:deviceProfile'),
        onProfileUpdate: () => invalidate('app:deviceProfile')
    });
    // When timeout job marks APPLYING as FAILED (no MQTT is sent), poll so UI eventually shows Failed
    let applyingPollIntervalId = 0;
    function startApplyingPoll() {
        if (applyingPollIntervalId) return;
        applyingPollIntervalId = setInterval(() => invalidate('app:deviceProfile'), 10_000);
    }
    function stopApplyingPoll() {
        if (applyingPollIntervalId) {
            clearInterval(applyingPollIntervalId);
            applyingPollIntervalId = 0;
        }
    }
    $: if (activeTab === 'devices' && (deviceRows?.some((r) => r.applyStatus === 'APPLYING') ?? false)) {
        startApplyingPoll();
    } else {
        stopApplyingPoll();
    }
    onMount(() => {
        if (profileId) setupProfileMqtt();
    });
    onDestroy(() => stopApplyingPoll());

    let showEditProfileModal = false;
    function openEditProfileModal() {
        showEditProfileModal = true;
    }
    function closeEditProfileModal() {
        showEditProfileModal = false;
    }
    async function onEditProfileSuccess() {
        toast.success('Profile updated successfully!');
        closeEditProfileModal();
        await invalidateAll();
    }
    const UPDATE_PROFILE_ERROR_MSG = 'Unable to update Profile. Please try again!';
    function isGenericError(msg: string | null): boolean {
        if (!msg?.trim()) return true;
        const lower = msg.toLowerCase();
        return lower === 'internal error' || lower === 'request failed' || lower.includes('internal server error') || lower === 'error';
    }
    function onEditProfileError(message: string | unknown) {
        const text = typeof message === 'string' ? message : (message && typeof message === 'object' && 'message' in message && typeof (message as { message: unknown }).message === 'string' ? (message as { message: string }).message : null);
        toast.error(isGenericError(text) ? UPDATE_PROFILE_ERROR_MSG : (text || UPDATE_PROFILE_ERROR_MSG));
    }

    let activeTab = $page.url.searchParams.get('tab') || 'configuration';

    function handleTabChange(e: CustomEvent<string>) {
        activeTab = e.detail;
    }

    $: if (typeof window !== 'undefined' && activeTab && activeTab !== $page.url.searchParams.get('tab')) {
        const url = new URL($page.url);
        url.searchParams.set('tab', activeTab);
        goto(url.pathname + url.search, { replaceState: true });
    }

    function formatDateTime(d: Date | string | null | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatLastSeen(d: Date | string | null | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        return formatDateTime(d);
    }

    // Read settings from page data so reactive updates when load completes
    $: profileSettings = Array.isArray(data?.profile?.settings) ? data.profile.settings : [];

    function getSettingValue(key: string): string {
        const settings = Array.isArray(data?.profile?.settings) ? data.profile.settings : [];
        if (settings.length === 0) return '';
        const s = settings.find((x: { key: string; value?: string }) => x.key === key);
        const v = s?.value;
        return v != null && v !== '' ? String(v) : '';
    }

    function getSettingDisplayValue(key: string): string {
        const raw = getSettingValue(key);
        const settingsList = Array.isArray(availableSettings) ? availableSettings : [];
        const def = settingsList.find((a: { key: string; dataType?: string; options?: { label: string; value: string }[]; defaultValue?: string }) => a.key === key);
        // Use raw value from profile, or fall back to default when profile has no setting
        const valueToShow = raw !== '' ? raw : (def?.defaultValue != null && def.defaultValue !== '' ? String(def.defaultValue) : '');
        if (valueToShow === '') return '—';
        if (def?.dataType === 'boolean') return valueToShow === 'enabled' || valueToShow === 'true' ? 'Enable' : 'Disable';
        if (def?.options && Array.isArray(def.options) && def.options.length) {
            const opt = def.options.find((o: { value: string }) => o.value === valueToShow);
            return opt?.label ?? valueToShow;
        }
        return valueToShow;
    }

    // Section keys matching Device tab Config (Kiosk → Display → Schedule)
    const KIOSK_KEYS = ['kiosk_lock_mode', 'kiosk_application'];
    const DISPLAY_KEYS = [
        'display_resolution',
        'screen_orientation',
        'brightness_level',
        'enable_audio',
        'volume_level',
        'timezone',
        'home_launcher'
    ];
    function settingRow(key: string): { key: string; label: string; description: string; value: string } | null {
        const settingsList = Array.isArray(availableSettings) ? availableSettings : [];
        const def = settingsList.find((a: { key: string }) => a.key === key);
        if (!def) return null;
        if (def.dependsOn) {
            const parentVal = getSettingValue(def.dependsOn);
            const parentDef = settingsList.find((a: { key: string }) => a.key === def.dependsOn);
            if (parentDef?.dataType === 'boolean') {
                if (parentVal !== 'enabled') return null;
            } else if (parentDef?.options && (key === 'reboot_schedule_day' || key === 'download_schedule_day')) {
                if (parentVal !== 'weekly') return null;
            }
        }
        let value = getSettingDisplayValue(key);
        if ((key === 'volume_level' || key === 'brightness_level') && value !== '—' && value !== '') {
            value = value + '%';
        }
        return {
            key,
            label: def.label,
            description: def.description,
            value
        };
    }

    // profileSettings is an explicit dependency so Svelte re-runs this block
    // when data reloads (e.g. after invalidateAll() on save). Without this,
    // Svelte's static analyser cannot see the data dependency hidden inside
    // settingRow() → getSettingValue() and the rows would stay stale.
    let kioskSettingsRows: { key: string; label: string; description: string; value: string }[] = [];
    let displaySettingsRows: { key: string; label: string; description: string; value: string }[] = [];
    $: {
        profileSettings; // explicit reactive dependency
        kioskSettingsRows = KIOSK_KEYS.map(settingRow).filter(Boolean) as { key: string; label: string; description: string; value: string }[];
        displaySettingsRows = DISPLAY_KEYS.map(settingRow).filter(Boolean) as { key: string; label: string; description: string; value: string }[];
    }

    $: deviceRows = (profile?.assignments ?? []).map((a: { device: { id: string; name: string; description?: string | null; deviceType?: string | null; status?: string; macAddress?: string | null; wifiMac?: string | null; lastUsedAt?: Date | string | null }; status?: string; appliedAt?: Date | string | null }) => {
        const d = a.device;
        const mac = d.macAddress || d.wifiMac || '—';
        return {
            id: d.id,
            name: d.name,
            description: d.description,
            deviceType: d.deviceType ?? '—',
            status: d.status ?? 'ACTIVE',
            macAddress: mac,
            lastUsedAt: d.lastUsedAt ?? null,
            applyStatus: a.status ?? null
        };
    });

    $: tabs = [
        { id: 'configuration', label: 'Configuration' },
        { id: 'devices', label: 'Assigned Devices' }
    ];

    const DEVICES_PAGE_SIZE = 10;
    let devicesPage = 1;
    $: devicesTotalItems = deviceRows.length;
    $: devicesTotalPages = Math.max(1, Math.ceil(devicesTotalItems / DEVICES_PAGE_SIZE));
    $: paginatedDeviceRows = deviceRows.slice(
        (devicesPage - 1) * DEVICES_PAGE_SIZE,
        devicesPage * DEVICES_PAGE_SIZE
    );
    $: devicesRangeStart = devicesTotalItems === 0 ? 0 : (devicesPage - 1) * DEVICES_PAGE_SIZE + 1;
    $: devicesRangeEnd = Math.min(devicesPage * DEVICES_PAGE_SIZE, devicesTotalItems);

    function devicesPrevPage() {
        if (devicesPage > 1) devicesPage -= 1;
    }
    function devicesNextPage() {
        if (devicesPage < devicesTotalPages) devicesPage += 1;
    }
    function devicesFirstPage() {
        devicesPage = 1;
    }
    function devicesLastPage() {
        devicesPage = devicesTotalPages;
    }

    // Add Device modal (reuse DeviceSelector)
    let showAddDeviceModal = false;
    let addDeviceLoading = false;
    function openAddDeviceModal() {
        showAddDeviceModal = true;
    }
    function closeAddDeviceModal() {
        showAddDeviceModal = false;
    }

    // Assign by tag modal (search + multi-select chips like reference)
    let showAssignByTagModal = false;
    let assignByTagLoading = false;
    let assignByTagTags: { id: string; name: string }[] = [];
    let assignByTagSelected: { id: string; name: string }[] = [];
    let assignByTagSearchTerm = '';
    let assignByTagDropdownOpen = false;
    function openAssignByTagModal() {
        showAssignByTagModal = true;
        assignByTagSelected = [];
        assignByTagSearchTerm = '';
        assignByTagDropdownOpen = false;
        loadAssignByTagTags();
    }
    function closeAssignByTagModal() {
        showAssignByTagModal = false;
        assignByTagSelected = [];
        assignByTagSearchTerm = '';
        assignByTagTags = [];
    }
    async function loadAssignByTagTags() {
        try {
            const res = await fetch('/api/v2/devices/tags');
            const data = await res.json().catch(() => ({}));
            const list = data?.data ?? data;
            assignByTagTags = Array.isArray(list) ? list : [];
        } catch {
            assignByTagTags = [];
        }
    }
    $: assignByTagFilteredTags = assignByTagTags.filter(
        (t) =>
            !assignByTagSelected.some((s) => s.id === t.id) &&
            t.name.toLowerCase().includes(assignByTagSearchTerm.trim().toLowerCase())
    );
    function addAssignByTagTag(tag: { id: string; name: string }) {
        if (!assignByTagSelected.some((s) => s.id === tag.id)) {
            assignByTagSelected = [...assignByTagSelected, tag];
        }
        assignByTagSearchTerm = '';
        assignByTagDropdownOpen = false;
    }
    function removeAssignByTagTag(id: string) {
        assignByTagSelected = assignByTagSelected.filter((t) => t.id !== id);
    }
    async function onConfirmAssignByTag() {
        if (assignByTagSelected.length === 0) return;
        assignByTagLoading = true;
        try {
            const tagIds = assignByTagSelected.map((t) => t.id);
            const res = await fetch(`/api/v2/device-profiles/${profileId}/assign-by-tag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds })
            });
            const data = await res.json().catch(() => ({}));
            const payload = data?.data ?? data;
            if (res.ok && data?.success !== false) {
                const count = payload?.assignedCount ?? 0;
                toast.success(count > 0 ? `Assigned profile to ${count} device(s).` : 'No unassigned devices with selected tags.');
                closeAssignByTagModal();
                invalidate('app:deviceProfile');
            } else {
                toast.error(data?.error?.message || 'Assign by tag failed. Please try again!');
            }
        } catch {
            toast.error('Assign by tag failed. Please try again!');
        } finally {
            assignByTagLoading = false;
        }
    }
    async function onAddDeviceSelect(e: CustomEvent<{ id: string; name: string }[]>) {
        const devices = e.detail || [];
        if (devices.length === 0) return;
        const deviceIds = devices.map((d) => d.id);
        addDeviceLoading = true;
        try {
            const res = await fetch(`/api/v2/device-profiles/${profileId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.success !== false) {
                toast.success('Device added successfully!');
                closeAddDeviceModal();
                invalidate('app:deviceProfile');
            } else {
                toast.error(data?.error?.message || 'Unable to add device. Please try again!');
            }
        } catch {
            toast.error('Unable to add device. Please try again!');
        } finally {
            addDeviceLoading = false;
        }
    }

    // Actions dropdown: only one open at a time (like preclaims)
    let openMoreMenuKey: string | null = null;

    // Remove Device confirmation (reuse ConfirmModal)
    let confirmRemoveOpen = false;
    let deviceToRemove: { id: string; name: string } | null = null;
    let removeDeviceLoading = false;

    function getDeviceMenuActions(row: { id: string; name: string }) {
        return [
            { id: 'view', label: 'View', destructive: false, disabled: false, href: deviceDetailHref(row.id) },
            { id: 'reapply', label: 'Reapply', destructive: false, disabled: reapplyDeviceId === row.id },
            { id: 'remove', label: 'Remove', destructive: true, disabled: false }
        ];
    }

    function handleDeviceActionSelect(row: { id: string; name: string }, itemId: string) {
        if (itemId === 'view') {
            // View is a link (href) in ActionMenu — no goto needed
            return;
        } else if (itemId === 'reapply') {
            onReapplyDevice(row);
        } else if (itemId === 'remove') {
            openRemoveConfirm(row);
        }
    }
    function openRemoveConfirm(row: { id: string; name: string }) {
        deviceToRemove = { id: row.id, name: row.name };
        confirmRemoveOpen = true;
    }
    function closeRemoveConfirm() {
        confirmRemoveOpen = false;
        deviceToRemove = null;
    }
    async function onConfirmRemove() {
        if (!deviceToRemove) return;
        removeDeviceLoading = true;
        try {
            const res = await fetch(`/api/v2/device-profiles/${profileId}/unassign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds: [deviceToRemove.id] })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.success !== false) {
                toast.success('Device removed successfully!');
                closeRemoveConfirm();
                invalidate('app:deviceProfile');
            } else {
                toast.error(data?.error?.message || 'Unable to remove device. Please try again!');
            }
        } catch {
            toast.error('Unable to remove device. Please try again!');
        } finally {
            removeDeviceLoading = false;
        }
    }

    // Reapply profile to a single device
    let reapplyDeviceId: string | null = null;
    async function onReapplyDevice(row: { id: string; name: string }) {
        if (reapplyDeviceId) return;
        reapplyDeviceId = row.id;
        try {
            const res = await fetch(`/api/v2/device-profiles/${profileId}/reapply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds: [row.id] })
            });
            const data = await res.json().catch(() => ({}));
            const payload = data?.data;
            if (res.ok && data?.success !== false) {
                const failed = payload?.failedCount > 0 && payload?.failedDevices?.includes(row.id);
                if (failed) {
                    toast.error(`Could not send reapply to ${row.name || 'device'}. Please try again.`);
                } else {
                    toast.success(`Reapply sent to ${row.name || 'device'}. Status will update when it responds.`);
                    invalidate('app:deviceProfile');
                }
            } else {
                toast.error(data?.error?.message || 'Reapply failed. Please try again!');
            }
        } catch {
            toast.error('Reapply failed. Please try again!');
        } finally {
            reapplyDeviceId = null;
        }
    }

    function deviceDetailHref(deviceId: string): string {
        return `${basePath}/devices/${deviceId}`;
    }

    // Unassign all confirmation
    let showUnassignAllConfirm = false;
    let unassignAllLoading = false;
    function openUnassignAllConfirm() {
        showUnassignAllConfirm = true;
    }
    function closeUnassignAllConfirm() {
        showUnassignAllConfirm = false;
    }
    async function onConfirmUnassignAll() {
        unassignAllLoading = true;
        try {
            const res = await fetch(`/api/v2/device-profiles/${profileId}/unassign-all`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.success !== false) {
                const count = data?.data?.unassignedCount ?? 0;
                toast.success(count > 0 ? `Unassigned profile from ${count} device(s).` : 'No devices were assigned.');
                closeUnassignAllConfirm();
                invalidate('app:deviceProfile');
            } else {
                toast.error(data?.error?.message || 'Unassign all failed. Please try again!');
            }
        } catch {
            toast.error('Unassign all failed. Please try again!');
        } finally {
            unassignAllLoading = false;
        }
    }

    // Unassign by tag modal (same pattern as Assign by tag)
    let showUnassignByTagModal = false;
    let unassignByTagLoading = false;
    let unassignByTagTags: { id: string; name: string }[] = [];
    let unassignByTagSelected: { id: string; name: string }[] = [];
    let unassignByTagSearchTerm = '';
    let unassignByTagDropdownOpen = false;
    function openUnassignByTagModal() {
        showUnassignByTagModal = true;
        unassignByTagSelected = [];
        unassignByTagSearchTerm = '';
        unassignByTagDropdownOpen = false;
        loadUnassignByTagTags();
    }
    function closeUnassignByTagModal() {
        showUnassignByTagModal = false;
        unassignByTagSelected = [];
        unassignByTagSearchTerm = '';
        unassignByTagTags = [];
    }
    async function loadUnassignByTagTags() {
        try {
            const res = await fetch(`/api/v2/device-profiles/${profileId}/assigned-device-tags`);
            const data = await res.json().catch(() => ({}));
            const list = data?.data?.tags ?? [];
            unassignByTagTags = Array.isArray(list) ? list : [];
        } catch {
            unassignByTagTags = [];
        }
    }
    $: unassignByTagFilteredTags = unassignByTagTags.filter(
        (t) =>
            !unassignByTagSelected.some((s) => s.id === t.id) &&
            t.name.toLowerCase().includes(unassignByTagSearchTerm.trim().toLowerCase())
    );
    function addUnassignByTagTag(tag: { id: string; name: string }) {
        if (!unassignByTagSelected.some((s) => s.id === tag.id)) {
            unassignByTagSelected = [...unassignByTagSelected, tag];
        }
        unassignByTagSearchTerm = '';
        unassignByTagDropdownOpen = false;
    }
    function removeUnassignByTagTag(id: string) {
        unassignByTagSelected = unassignByTagSelected.filter((t) => t.id !== id);
    }
    async function onConfirmUnassignByTag() {
        if (unassignByTagSelected.length === 0) return;
        unassignByTagLoading = true;
        try {
            const tagIds = unassignByTagSelected.map((t) => t.id);
            const res = await fetch(`/api/v2/device-profiles/${profileId}/unassign-by-tag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds })
            });
            const data = await res.json().catch(() => ({}));
            const payload = data?.data ?? data;
            if (res.ok && data?.success !== false) {
                const count = payload?.unassignedCount ?? 0;
                toast.success(count > 0 ? `Unassigned profile from ${count} device(s).` : 'No assigned devices with selected tags.');
                closeUnassignByTagModal();
                invalidate('app:deviceProfile');
            } else {
                toast.error(data?.error?.message || 'Unassign by tag failed. Please try again!');
            }
        } catch {
            toast.error('Unassign by tag failed. Please try again!');
        } finally {
            unassignByTagLoading = false;
        }
    }
</script>

{#if profile}
    <div class="profile-detail flex flex-col items-start w-full" style="padding: var(--ds-space-6); gap: var(--ds-space-6);">
        <!-- Top row: Edit Set button (opens Edit Profile modal) -->
        <div class="flex flex-row justify-end w-full">
            <Button
                variant="filled"
                color="primary"
                size="lg"
                iconLeft={true}
                on:click={openEditProfileModal}
            >
                <Pencil size={20} slot="icon-left" />
                Edit Set
            </Button>
        </div>

        <!-- Profile Overview card (design: section wrap, header, details wrap, divider, footer) -->
        <Card
            variant="default"
            padding="none"
            radius="2xl"
            showHeader={true}
            fullWidth={true}
        >
            <!-- Header: flex row, 16px padding, 8px gap, border-bottom -->
            <div
                slot="header"
                class="profile-overview-header"
                style="display: flex; flex-direction: row; align-items: center; padding: var(--ds-space-4); gap: var(--ds-space-2); border-bottom: 1px solid var(--ds-color-neutral-true-200); font-family: var(--ds-font-family-primary);"
            >
                <div
                    class="shrink-0 rounded-lg flex items-center justify-center"
                    style="width: 44px; height: 44px; padding: 12px;"
                >
                    <span
                        class="inline-flex items-center justify-center rounded-full border-2 flex-none"
                        style="width: 20px; height: 20px; border-color: var(--ds-color-neutral-true-400); font-size: 12px; font-weight: 600; color: var(--ds-color-neutral-true-400);"
                    >i</span>
                </div>
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <h3
                        class="font-medium truncate"
                        style="font-size: var(--ds-text-lg); line-height: 24px; color: var(--ds-color-neutral-true-900);"
                    >Profile Overview</h3>
                    <p
                        class="text-sm"
                        style="font-weight: 400; font-size: 14px; line-height: 20px; color: var(--ds-color-gray-600);"
                    >Key information about this profile</p>
                </div>
            </div>
            <!-- Details wrap: 16px padding, 16px gap -->
            <div
                class="flex flex-col justify-center items-start"
                style="padding: var(--ds-space-4); gap: var(--ds-space-4); font-family: var(--ds-font-family-primary);"
            >
                <!-- Row 1: Profile Name (left) | Status (right) -->
                <div class="flex flex-row items-start w-full" style="gap: var(--ds-space-4);">
                    <div class="flex flex-col gap-1 min-w-0 flex-1">
                        <span
                            class="text-sm"
                            style="font-weight: 400; font-size: 14px; line-height: 20px; color: var(--ds-color-neutral-true-600);"
                        >Profile Name</span>
                        <span
                            class="font-medium"
                            style="font-size: 16px; line-height: 24px; color: var(--ds-color-neutral-true-900);"
                        >{profile.name}</span>
                    </div>
                    <div class="flex flex-col gap-1 min-w-0 flex-1">
                        <span
                            class="text-sm"
                            style="font-weight: 400; font-size: 14px; line-height: 20px; color: var(--ds-color-neutral-true-600);"
                        >Status</span>
                        <!-- Design: 80×28px, padding 4px 10px, gap 6px, font 14px, border-radius 16px -->
                        <div class="profile-overview-status-badge">
                            <Badge
                                label={profile.isActive ? 'Active' : 'Inactive'}
                                color={profile.isActive ? 'success' : 'gray'}
                                variant="filled"
                                size="md"
                                showDot={profile.isActive}
                            />
                        </div>
                    </div>
                </div>
                <!-- Row 2: Description full width -->
                <div class="flex flex-col gap-1 w-full">
                    <span
                        class="text-sm"
                        style="font-weight: 400; font-size: 14px; line-height: 20px; color: var(--ds-color-neutral-true-600);"
                    >Description</span>
                    <span
                        class="font-medium"
                        style="font-size: 16px; line-height: 24px; color: var(--ds-color-neutral-true-900);"
                    >{profile.description || '—'}</span>
                </div>
                <!-- Divider -->
                <div
                    class="w-full"
                    style="border-top: 1px solid var(--ds-color-neutral-true-200); padding: 2px 0;"
                />
                <!-- Footer: Created at, Last updated at -->
                <div class="flex flex-col items-start w-full" style="gap: 4px;">
                    <span
                        class="text-xs"
                        style="font-weight: 400; font-size: 12px; line-height: 16px; letter-spacing: 0.01em; color: var(--ds-color-neutral-true-600);"
                    >Created at {formatDateTime(profile.createdAt)}</span>
                    <span
                        class="text-xs"
                        style="font-weight: 400; font-size: 12px; line-height: 16px; letter-spacing: 0.01em; color: var(--ds-color-neutral-true-600);"
                    >Last updated at {formatDateTime(profile.updatedAt)}</span>
                </div>
            </div>
        </Card>

        <!-- Tabs: Configuration | Assigned Devices -->
        <div class="w-full flex flex-col gap-6">
            <TabGroup
                tabs={tabs}
                activeTab={activeTab}
                type="underline"
                size="md"
                on:change={handleTabChange}
            />

            {#if activeTab === 'configuration'}
                <!-- Key so Configuration re-renders when load returns after save -->
                {#key (data?.profile?.updatedAt ? String(data.profile.updatedAt) : '') + (data?.profile?.settings?.length ?? 0)}
                <Card variant="default" padding="none" class="config-card">
                    <div slot="header" class="config-header">
                        <div class="icon-wrap">
                            <Settings2 size={20} color="#A3A3A3" />
                        </div>
                        <div class="header-text">
                            <h4>Device Configuration</h4>
                            <p>Configuration setup of this device</p>
                        </div>
                    </div>

                    <!-- Kiosk Settings Section -->
                    <div class="config-table-wrap">
                        {#each kioskSettingsRows as item, i}
                            <div class="config-row" class:last={i === kioskSettingsRows.length - 1}>
                                <div class="config-cell label-cell">
                                    <div class="cell-content">
                                        <span class="cell-title">{item.label}</span>
                                        <span class="cell-desc">{item.description}</span>
                                    </div>
                                </div>
                                <div class="config-cell value-cell">
                                    <span class="cell-value">{item.value}</span>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <!-- Display Settings Section -->
                    <div class="config-table-wrap">
                        {#each displaySettingsRows as item, i}
                            <div class="config-row" class:last={i === displaySettingsRows.length - 1}>
                                <div class="config-cell label-cell">
                                    <div class="cell-content">
                                        <span class="cell-title">{item.label}</span>
                                        <span class="cell-desc">{item.description}</span>
                                    </div>
                                </div>
                                <div class="config-cell value-cell">
                                    <span class="cell-value">{item.value}</span>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <!-- Schedule Settings Section (grouped, same as Device tab Configuration) -->
                    <div class="config-table-wrap">
                        <!-- Power Management Schedule (grouped) -->
                        <div class="config-row">
                            <div class="config-cell label-cell">
                                <div class="cell-content">
                                    <span class="cell-title">Power Management Schedule</span>
                                    <span class="cell-desc">Scheduled power on/off times</span>
                                </div>
                            </div>
                            <div class="config-cell value-cell">
                                {#if (getSettingValue('power_management_schedule') || 'disabled') === 'enabled'}
                                    <div class="schedule-detail">
                                        <span class="schedule-badge enabled">Enabled</span>
                                        <div class="schedule-items">
                                            <span class="schedule-item"><span class="schedule-label">On:</span> {(getSettingValue('power_on_datetime') || '—').replace('T', ' ')}</span>
                                            <span class="schedule-item"><span class="schedule-label">Off:</span> {(getSettingValue('power_off_datetime') || '—').replace('T', ' ')}</span>
                                        </div>
                                    </div>
                                {:else}
                                    <span class="schedule-badge disabled">Disabled</span>
                                {/if}
                            </div>
                        </div>

                        <!-- Reboot Schedule (grouped) -->
                        <div class="config-row">
                            <div class="config-cell label-cell">
                                <div class="cell-content">
                                    <span class="cell-title">Reboot Schedule</span>
                                    <span class="cell-desc">Scheduled device reboots</span>
                                </div>
                            </div>
                            <div class="config-cell value-cell">
                                {#if (getSettingValue('reboot_schedule_enabled') || 'disabled') === 'enabled'}
                                    <div class="schedule-detail">
                                        <span class="schedule-badge enabled">Enabled</span>
                                        <div class="schedule-items">
                                            <span class="schedule-item"><span class="schedule-label">Frequency:</span> <span style="text-transform: capitalize;">{getSettingValue('reboot_schedule_frequency') || 'daily'}</span></span>
                                            {#if (getSettingValue('reboot_schedule_frequency') || 'daily') === 'weekly'}
                                                <span class="schedule-item"><span class="schedule-label">Day:</span> <span style="text-transform: capitalize;">{getSettingValue('reboot_schedule_day') || 'monday'}</span></span>
                                            {/if}
                                            <span class="schedule-item"><span class="schedule-label">Time:</span> {getSettingValue('reboot_schedule_time') || '02:00'}</span>
                                        </div>
                                    </div>
                                {:else}
                                    <span class="schedule-badge disabled">Disabled</span>
                                {/if}
                            </div>
                        </div>

                        <!-- Download Schedule (grouped) -->
                        <div class="config-row last">
                            <div class="config-cell label-cell">
                                <div class="cell-content">
                                    <span class="cell-title">Download Schedule</span>
                                    <span class="cell-desc">Scheduled content downloads</span>
                                </div>
                            </div>
                            <div class="config-cell value-cell">
                                {#if (getSettingValue('download_schedule_enabled') || 'disabled') === 'enabled'}
                                    <div class="schedule-detail">
                                        <span class="schedule-badge enabled">Enabled</span>
                                        <div class="schedule-items">
                                            <span class="schedule-item"><span class="schedule-label">Frequency:</span> <span style="text-transform: capitalize;">{getSettingValue('download_schedule_frequency') || 'daily'}</span></span>
                                            {#if (getSettingValue('download_schedule_frequency') || 'daily') === 'weekly'}
                                                <span class="schedule-item"><span class="schedule-label">Day:</span> <span style="text-transform: capitalize;">{getSettingValue('download_schedule_day') || 'monday'}</span></span>
                                            {/if}
                                            <span class="schedule-item"><span class="schedule-label">Time:</span> {getSettingValue('download_schedule_time') || '03:00'}</span>
                                        </div>
                                    </div>
                                {:else}
                                    <span class="schedule-badge disabled">Disabled</span>
                                {/if}
                            </div>
                        </div>
                    </div>
                </Card>
                {/key}
            {:else if activeTab === 'devices'}
                <!-- Assigned Devices card (Figma: Frame 34 – header + content + pagination) -->
                <Card variant="default" padding="none" class="assigned-devices-card">
                    <div slot="header" class="assigned-devices-header">
                        <div class="assigned-devices-icon-wrap">
                            <HardDriveUpload size={20} color="#A3A3A3" />
                        </div>
                        <div class="assigned-devices-header-text">
                            <h4 class="assigned-devices-title">Devices</h4>
                            <p class="assigned-devices-subtitle">Devices assigned to this profile</p>
                        </div>
                        <div class="assigned-devices-header-actions">
                            <Button
                                variant="filled"
                                color="primary"
                                size="lg"
                                iconLeft={true}
                                on:click={openAssignByTagModal}
                                class="assigned-devices-add-btn assigned-devices-tag-btn"
                            >
                                <Tag size={20} slot="icon-left" />
                                Assign by tag
                            </Button>
                            <Button
                                variant="filled"
                                color="primary"
                                size="lg"
                                iconLeft={true}
                                on:click={openAddDeviceModal}
                                class="assigned-devices-add-btn"
                            >
                                <Plus size={20} slot="icon-left" />
                                Add Device
                            </Button>
                            <Button
                                variant="filled"
                                color="primary"
                                size="lg"
                                iconLeft={true}
                                on:click={openUnassignByTagModal}
                                class="assigned-devices-add-btn assigned-devices-tag-btn"
                            >
                                <Tag size={20} slot="icon-left" />
                                Unassign by tag
                            </Button>
                            <Button
                                variant="filled"
                                color="primary"
                                size="lg"
                                iconLeft={true}
                                on:click={openUnassignAllConfirm}
                                class="assigned-devices-add-btn"
                            >
                                <UserMinus size={20} slot="icon-left" />
                                Unassign all
                            </Button>
                        </div>
                    </div>

                    <div class="assigned-devices-content">
                        <div class="assigned-devices-table-wrap">
                            <table class="assigned-devices-table">
                                <thead>
                                    <tr class="assigned-devices-thead-tr">
                                        <th class="assigned-devices-th assigned-devices-th-name">
                                            <span class="assigned-devices-th-inner">Device Name <span class="assigned-devices-th-icon"><ChevronDown size={16} /></span></span>
                                        </th>
                                        <th class="assigned-devices-th">
                                            <span class="assigned-devices-th-inner">MAC Address <span class="assigned-devices-th-icon"><ChevronDown size={16} /></span></span>
                                        </th>
                                        <th class="assigned-devices-th">
                                            <span class="assigned-devices-th-inner">Operating System <span class="assigned-devices-th-icon"><ChevronDown size={16} /></span></span>
                                        </th>
                                        <th class="assigned-devices-th">
                                            <span class="assigned-devices-th-inner">Status <span class="assigned-devices-th-icon"><ChevronDown size={16} /></span></span>
                                        </th>
                                        <th class="assigned-devices-th">
                                            <span class="assigned-devices-th-inner">Apply status <span class="assigned-devices-th-icon"><ChevronDown size={16} /></span></span>
                                        </th>
                                        <th class="assigned-devices-th assigned-devices-th-actions">
                                            <span class="assigned-devices-th-inner">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#if paginatedDeviceRows.length === 0}
                                        <tr>
                                            <td colspan="6" class="assigned-devices-empty">No devices assigned to this profile</td>
                                        </tr>
                                    {:else}
                                        {#each paginatedDeviceRows as row}
                                            <tr class="assigned-devices-tbody-tr">
                                                <td class="assigned-devices-td assigned-devices-td-name">
                                                    <div class="assigned-devices-name-cell">
                                                        <span class="assigned-devices-name-text">{row.name}</span>
                                                        {#if row.deviceType && row.deviceType !== '—'}
                                                            <div class="assigned-devices-tags">
                                                                <span class="assigned-devices-tag">{row.deviceType}</span>
                                                            </div>
                                                        {/if}
                                                    </div>
                                                </td>
                                                <td class="assigned-devices-td">{row.macAddress}</td>
                                                <td class="assigned-devices-td">{row.deviceType}</td>
                                                <td class="assigned-devices-td assigned-devices-td-status">
                                                    <Badge
                                                        label={row.status === 'ACTIVE' ? 'Online' : 'Offline'}
                                                        color={row.status === 'ACTIVE' ? 'success' : 'gray'}
                                                        variant="filled"
                                                        size="md"
                                                        showDot={false}
                                                    />
                                                </td>
                                                <td class="assigned-devices-td assigned-devices-td-applystatus">
                                                    {#if row.applyStatus === 'SUCCESS' || row.applyStatus === 'APPLIED'}
                                                        <Badge label="Applied" color="success" variant="filled" size="md" showDot={false} />
                                                    {:else if row.applyStatus === 'APPLYING'}
                                                        <Badge label="Applying" color="warning" variant="filled" size="md" showDot={false} />
                                                    {:else if row.applyStatus === 'FAILED'}
                                                        <Badge label="Failed" color="destructive" variant="filled" size="md" showDot={false} />
                                                    {:else}
                                                        <span class="assigned-devices-applystatus-placeholder">—</span>
                                                    {/if}
                                                </td>
                                                <td class="assigned-devices-td assigned-devices-td-actions">
                                                    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                                                    <div on:click|stopPropagation>
                                                        <ActionMenu
                                                            open={openMoreMenuKey === row.id}
                                                            items={getDeviceMenuActions(row)}
                                                            triggerIcon="dots-vertical"
                                                            align="right"
                                                            size="sm"
                                                            triggerVariant="text"
                                                            width="auto"
                                                            on:open={() => { openMoreMenuKey = row.id; }}
                                                            on:close={() => { openMoreMenuKey = null; }}
                                                            on:select={(e) => handleDeviceActionSelect(row, e.detail.id)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        {/each}
                                    {/if}
                                </tbody>
                            </table>
                        </div>

                        {#if devicesTotalItems > 0}
                            <div class="assigned-devices-pagination">
                                <span class="assigned-devices-pagination-details">
                                    {devicesRangeStart} - {devicesRangeEnd} of {devicesTotalItems}
                                </span>
                                <div class="assigned-devices-pagination-buttons">
                                    <button type="button" class="assigned-devices-pagination-btn" on:click={devicesFirstPage} disabled={devicesPage <= 1} aria-label="First page">
                                        <ChevronsLeft size={20} />
                                    </button>
                                    <button type="button" class="assigned-devices-pagination-btn" on:click={devicesPrevPage} disabled={devicesPage <= 1} aria-label="Previous page">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span class="assigned-devices-pagination-page">{devicesPage}</span>
                                    <button type="button" class="assigned-devices-pagination-btn" on:click={devicesNextPage} disabled={devicesPage >= devicesTotalPages} aria-label="Next page">
                                        <ChevronRight size={20} />
                                    </button>
                                    <button type="button" class="assigned-devices-pagination-btn" on:click={devicesLastPage} disabled={devicesPage >= devicesTotalPages} aria-label="Last page">
                                        <ChevronsRight size={20} />
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </div>
                </Card>
            {/if}
        </div>
    </div>

    <!-- Edit Profile modal (same as list page) -->
    <AddEditProfileModal
        open={showEditProfileModal}
        mode="edit"
        profileId={profileId}
        actionBasePath={listPath}
        on:close={closeEditProfileModal}
        on:success={onEditProfileSuccess}
        on:error={(e) => onEditProfileError(e.detail)}
    />

    <!-- Add Device modal (reuse DeviceSelector – search and select devices, then assign) -->
    <DeviceSelector
        open={showAddDeviceModal}
        profileId={profileId}
        apiPrefix="/api/v2"
        status="available"
        title="Add Device"
        confirmLabel="Add"
        on:close={closeAddDeviceModal}
        on:select={onAddDeviceSelect}
    />

    <!-- Assign Tag modal (search + selected chips like reference) -->
    <Modal
        open={showAssignByTagModal}
        title="Assign Tag"
        size="md"
        showFooter={true}
        confirmText="Assign"
        cancelText="Cancel"
        confirmLoading={assignByTagLoading}
        confirmDisabled={assignByTagSelected.length === 0 || assignByTagLoading}
        on:close={closeAssignByTagModal}
        on:confirm={onConfirmAssignByTag}
    >
        <div class="tag-modal-body">
            <div class="tag-modal-search-wrap">
                <input
                    type="text"
                    class="tag-modal-search-input"
                    placeholder="Search and select tag"
                    bind:value={assignByTagSearchTerm}
                    on:focus={() => (assignByTagDropdownOpen = true)}
                    on:blur={() => setTimeout(() => (assignByTagDropdownOpen = false), 150)}
                    on:keydown={(e) => e.key === 'Escape' && (assignByTagDropdownOpen = false)}
                />
                <span class="tag-modal-search-icon" aria-hidden="true"><Search size={18} /></span>
            </div>
            {#if assignByTagDropdownOpen && assignByTagFilteredTags.length > 0}
                <ul class="tag-modal-dropdown" role="listbox">
                    {#each assignByTagFilteredTags as tag (tag.id)}
                        <li
                            class="tag-modal-dropdown-item"
                            role="option"
                            tabindex="0"
                            on:click={() => addAssignByTagTag(tag)}
                            on:keydown={(e) => e.key === 'Enter' && addAssignByTagTag(tag)}
                        >
                            {tag.name}
                        </li>
                    {/each}
                </ul>
            {/if}
            <div class="tag-modal-selected-section">
                <span class="tag-modal-selected-label">Selected ({assignByTagSelected.length} item{assignByTagSelected.length !== 1 ? 's' : ''})</span>
                {#if assignByTagSelected.length > 0}
                    <div class="tag-modal-chips">
                        {#each assignByTagSelected as tag (tag.id)}
                            <span class="tag-modal-chip">
                                <span class="tag-modal-chip-text">{tag.name}</span>
                                <button
                                    type="button"
                                    class="tag-modal-chip-remove"
                                    aria-label="Remove {tag.name}"
                                    on:click={() => removeAssignByTagTag(tag.id)}
                                >
                                    <X size={14} />
                                </button>
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </Modal>

    <!-- Remove Device confirmation (reuse ConfirmModal) -->
    <ConfirmModal
        open={confirmRemoveOpen}
        title="Remove Device"
        description="Are you sure you want to remove this device? This action cannot be reversed."
        confirmText="Remove"
        cancelText="Cancel"
        confirmLoading={removeDeviceLoading}
        confirmDisabled={removeDeviceLoading}
        on:close={closeRemoveConfirm}
        on:confirm={onConfirmRemove}
    />

    <!-- Unassign all confirmation -->
    <ConfirmModal
        open={showUnassignAllConfirm}
        title="Unassign all"
        description="Unassign this profile from all devices? This action cannot be reversed."
        confirmText="Unassign all"
        cancelText="Cancel"
        confirmLoading={unassignAllLoading}
        confirmDisabled={unassignAllLoading}
        on:close={closeUnassignAllConfirm}
        on:confirm={onConfirmUnassignAll}
    />

    <!-- Unassign by tag modal (search + selected chips) -->
    <Modal
        open={showUnassignByTagModal}
        title="Unassign by tag"
        size="md"
        showFooter={true}
        confirmText="Unassign"
        cancelText="Cancel"
        confirmLoading={unassignByTagLoading}
        confirmDisabled={unassignByTagSelected.length === 0 || unassignByTagLoading}
        on:close={closeUnassignByTagModal}
        on:confirm={onConfirmUnassignByTag}
    >
        <div class="tag-modal-body">
            <div class="tag-modal-search-wrap">
                <input
                    type="text"
                    class="tag-modal-search-input"
                    placeholder="Search and select tag"
                    bind:value={unassignByTagSearchTerm}
                    on:focus={() => (unassignByTagDropdownOpen = true)}
                    on:blur={() => setTimeout(() => (unassignByTagDropdownOpen = false), 150)}
                    on:keydown={(e) => e.key === 'Escape' && (unassignByTagDropdownOpen = false)}
                />
                <span class="tag-modal-search-icon" aria-hidden="true"><Search size={18} /></span>
            </div>
            {#if unassignByTagDropdownOpen && unassignByTagFilteredTags.length > 0}
                <ul class="tag-modal-dropdown" role="listbox">
                    {#each unassignByTagFilteredTags as tag (tag.id)}
                        <li
                            class="tag-modal-dropdown-item"
                            role="option"
                            tabindex="0"
                            on:click={() => addUnassignByTagTag(tag)}
                            on:keydown={(e) => e.key === 'Enter' && addUnassignByTagTag(tag)}
                        >
                            {tag.name}
                        </li>
                    {/each}
                </ul>
            {/if}
            <div class="tag-modal-selected-section">
                <span class="tag-modal-selected-label">Selected ({unassignByTagSelected.length} item{unassignByTagSelected.length !== 1 ? 's' : ''})</span>
                {#if unassignByTagSelected.length > 0}
                    <div class="tag-modal-chips">
                        {#each unassignByTagSelected as tag (tag.id)}
                            <span class="tag-modal-chip">
                                <span class="tag-modal-chip-text">{tag.name}</span>
                                <button
                                    type="button"
                                    class="tag-modal-chip-remove"
                                    aria-label="Remove {tag.name}"
                                    on:click={() => removeUnassignByTagTag(tag.id)}
                                >
                                    <X size={14} />
                                </button>
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </Modal>
{:else}
    <div class="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p class="text-sm text-[var(--ds-text-secondary)]">Profile not found.</p>
        <Button variant="outline" color="primary" on:click={() => goto(`${basePath}/device-profiles`)}>
            Back to Profiles
        </Button>
    </div>
{/if}

<style>
    /* Design spec: Badge 80×28px, padding 4px 10px, border-radius 16px */
    .profile-overview-status-badge :global(button.badge) {
        padding: 4px 10px;
        min-width: 80px;
        border-radius: 16px;
    }

    /* Device Configuration Card - same as devices/[id] */
    :global(.config-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: var(--ds-space-4) !important;
    }

    .config-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-2);
        width: 100%;
        min-height: 60px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--ds-border-default);
    }

    .icon-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
    }

    .header-text {
        flex: 1;
        min-width: 0;
    }

    .header-text h4 {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .header-text p {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }

    :global(.config-card .card-body) {
        padding: var(--ds-card-padding-md);
    }

    .config-table-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        width: 100%;
        background: var(--ds-color-gray-50, #FAFAFA);
        border-radius: var(--ds-radius-lg);
        overflow: hidden;
        margin-bottom: var(--ds-space-4);
    }

    .config-table-wrap:last-child {
        margin-bottom: 0;
    }

    .config-table-wrap .config-row.last .config-cell:first-child {
        border-bottom-left-radius: var(--ds-radius-lg);
    }

    .config-table-wrap .config-row.last .config-cell:last-child {
        border-bottom-right-radius: var(--ds-radius-lg);
    }

    .config-row {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(140px, 400px);
        align-items: stretch;
        padding: 0;
        width: 100%;
        min-height: 56px;
    }

    .config-row:not(.last) .config-cell {
        border-bottom: 1px solid var(--ds-border-default);
    }

    .config-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-4);
        min-height: 56px;
        overflow: hidden;
    }

    .config-cell.label-cell {
        min-width: 0;
    }

    .config-cell.value-cell {
        min-width: 0;
        align-items: center;
    }

    .config-cell .cell-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 2px;
        width: 100%;
        min-width: 0;
        overflow-wrap: break-word;
        word-break: break-word;
    }

    .config-cell .cell-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    .config-cell .cell-desc {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-tertiary);
    }

    .config-cell .cell-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    /* Schedule grouped display (same as Device tab Configuration) */
    .schedule-detail {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    .schedule-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 10px;
        border-radius: 9999px;
        font-size: var(--ds-text-xs, 12px);
        font-weight: var(--ds-font-medium, 500);
        line-height: var(--ds-leading-sm, 20px);
        width: fit-content;
    }

    .schedule-badge.enabled {
        background: var(--ds-color-success-50, #ECFDF5);
        color: var(--ds-color-success-700, #047857);
    }

    .schedule-badge.disabled {
        background: var(--ds-color-gray-100, #F3F4F6);
        color: var(--ds-text-tertiary, #6B7280);
    }

    .schedule-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .schedule-item {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm, 13px);
        line-height: var(--ds-leading-sm, 20px);
        color: var(--ds-text-primary);
    }

    .schedule-label {
        color: var(--ds-text-tertiary, #6B7280);
        font-weight: var(--ds-font-regular, 400);
        margin-right: 4px;
    }

    /* Assigned Devices card – Figma Frame 34 (padding 16px on card root) */
    :global(.assigned-devices-card) {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        /* padding: 16px; */
        gap: 16px;
        background: var(--ds-color-white, #FFFFFF);
        border: 1px solid var(--ds-color-neutral-true-200, #E5E5E5);
        border-radius: 16px;
    }

    :global(.assigned-devices-card .card-header) {
        width: 100%;
        align-self: stretch;
    }

    :global(.assigned-devices-card .card-body) {
        padding: var(--ds-card-padding-md);
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .assigned-devices-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: 8px;
        width: 100%;
        min-width: 0;
        min-height: 62px;
    }

    .assigned-devices-icon-wrap {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 12px;
        gap: 8px;
        width: 44px;
        height: 44px;
        flex-shrink: 0;
        border-radius: 8px;
        box-sizing: border-box;
    }

    .assigned-devices-header-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }

    .assigned-devices-header-actions {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3, 12px);
        flex-shrink: 0;
    }

    /* Assign by tag: same blue style as Add Device, wider so text stays on one line */
    :global(.assigned-devices-tag-btn) {
        min-width: 180px !important;
        width: auto !important;
        white-space: nowrap;
    }

    :global(.assigned-devices-add-btn) {
        width: 156px !important;
        min-width: 156px !important;
        height: 44px !important;
        flex-shrink: 0;
        background: var(--ds-color-blue-light-600) !important;
        border: 1px solid var(--ds-color-blue-light-600) !important;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
    }

    /* Assign Tag modal – search + selected chips (match reference) */
    .tag-modal-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        width: 100%;
        font-family: var(--ds-font-family-primary);
    }

    .tag-modal-search-wrap {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
    }

    .tag-modal-search-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 40px 10px 12px;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
        background: var(--ds-color-white);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-input-radius);
    }

    .tag-modal-search-input::placeholder {
        color: var(--ds-text-secondary);
    }

    .tag-modal-search-icon {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--ds-text-secondary);
        pointer-events: none;
    }

    .tag-modal-dropdown {
        list-style: none;
        margin: 0;
        padding: 0;
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-md);
        max-height: 200px;
        overflow-y: auto;
    }

    .tag-modal-dropdown-item {
        padding: 10px 12px;
        font-size: var(--ds-text-sm);
        color: var(--ds-text-primary);
        cursor: pointer;
    }

    .tag-modal-dropdown-item:hover {
        background: var(--ds-color-gray-50, #f9fafb);
    }

    .tag-modal-selected-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .tag-modal-selected-label {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        color: var(--ds-text-primary);
    }

    .tag-modal-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
    }

    .tag-modal-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        font-size: var(--ds-text-sm);
        color: var(--ds-text-primary);
        background: var(--ds-color-gray-100, #f3f4f6);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-md);
    }

    .tag-modal-chip-text {
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tag-modal-chip-remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        border-radius: 2px;
    }

    .tag-modal-chip-remove:hover {
        color: var(--ds-text-primary);
    }

    .assigned-devices-title {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: var(--ds-color-neutral-true-900, #141414);
        margin: 0;
    }

    .assigned-devices-subtitle {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600, #475467);
        margin: 0;
    }

    .assigned-devices-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        width: 100%;
        background: var(--ds-color-white, #FFFFFF);
        border-radius: 9px;
        overflow: hidden;
    }

    .assigned-devices-table-wrap {
        width: 100%;
        overflow-x: auto;
    }

    .assigned-devices-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    .assigned-devices-thead-tr {
        display: table-row;
    }

    .assigned-devices-th {
        box-sizing: border-box;
        display: table-cell;
        padding: 12px 16px;
        background: var(--ds-color-neutral-true-100, #F5F5F5);
        border-bottom: 1px solid var(--ds-color-gray-200, #EAECF0);
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600, #475467);
        text-align: left;
        height: 44px;
        vertical-align: middle;
    }

    .assigned-devices-th-inner {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
    }

    .assigned-devices-th-icon {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--ds-color-gray-600, #475467);
    }

    .assigned-devices-th-name {
        min-width: 200px;
        width: 42%;
    }

    .assigned-devices-th:not(.assigned-devices-th-name) {
        width: 14%;
    }

    .assigned-devices-tbody-tr {
        display: table-row;
        background: var(--ds-color-white, #FFFFFF);
    }

    .assigned-devices-td {
        box-sizing: border-box;
        display: table-cell;
        padding: 16px;
        border-bottom: 1px solid var(--ds-color-gray-200, #EAECF0);
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-900, #141414);
        vertical-align: middle;
        min-height: 52px;
    }

    .assigned-devices-td-name {
        padding: 12px 16px;
        vertical-align: top;
    }

    .assigned-devices-td-status {
        padding: 12px 16px;
    }

    .assigned-devices-name-cell {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        gap: 6px;
    }

    .assigned-devices-name-text {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-900, #141414);
    }

    .assigned-devices-tags {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 4px;
        flex-wrap: wrap;
    }

    .assigned-devices-tag {
        box-sizing: border-box;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        padding: 4px;
        background: var(--ds-color-white, #FFFFFF);
        border: 1px solid var(--ds-color-neutral-true-300, #D6D6D6);
        border-radius: 6px;
        font-weight: 500;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: var(--ds-color-neutral-true-700, #424242);
    }

    .assigned-devices-td-status :global(button.badge) {
        padding: 4px 8px;
        border-radius: 16px;
    }

    .assigned-devices-applystatus-placeholder {
        color: var(--ds-color-neutral-true-500, #737373);
    }

    .assigned-devices-td-applystatus :global(button.badge) {
        padding: 4px 8px;
        border-radius: 16px;
    }

    .assigned-devices-empty {
        padding: 24px 16px;
        text-align: center;
        color: var(--ds-text-secondary);
        font-size: 14px;
    }

    .assigned-devices-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: 8px 24px;
        gap: 8px;
        width: 100%;
        min-height: 56px;
        border-top: 1px solid var(--ds-color-gray-200, #EAECF0);
    }

    .assigned-devices-pagination-details {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-600, #525252);
    }

    .assigned-devices-pagination-buttons {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 2px;
    }

    .assigned-devices-pagination-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        padding: 8px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--ds-color-neutral-true-800, #292929);
        cursor: pointer;
    }

    .assigned-devices-pagination-btn:hover:not(:disabled) {
        background: var(--ds-color-gray-50, #F9FAFB);
    }

    .assigned-devices-pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .assigned-devices-pagination-page {
        display: flex;
        justify-content: center;
        align-items: center;
        min-width: 40px;
        height: 36px;
        padding: 0 12px;
        background: var(--ds-color-gray-50, #F9FAFB);
        border-radius: 8px;
        font-family: var(--ds-font-family-secondary, 'Inter');
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-800, #1D2939);
    }

    .assigned-devices-th-actions {
        width: 85px;
    }

    .assigned-devices-td-actions {
        padding: 12px 16px;
        vertical-align: middle;
    }
</style>
