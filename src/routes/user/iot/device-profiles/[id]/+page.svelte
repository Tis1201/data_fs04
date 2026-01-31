<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { Button, Card, Badge, TabGroup } from '$lib/design-system/components';
    import { Pencil, Settings2, HardDriveUpload, ChevronDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { availableSettings } from '$lib/components/ui_components_sveltekit/form/deviceProfileSettings';
    import { toast } from '$lib/stores/alertToast';
    import AddEditProfileModal from '../components/AddEditProfileModal.svelte';

    export let data: PageData;
    /** From layout/route – accept to avoid "unknown prop" warning */
    export let params: Record<string, string> = {};

    $: profile = data?.profile ?? null;

    const basePath = '/user/iot';
    const listPath = '/user/iot/device-profiles';
    $: profileId = profile?.id ?? '';

    let showEditProfileModal = false;
    function openEditProfileModal() {
        showEditProfileModal = true;
    }
    function closeEditProfileModal() {
        showEditProfileModal = false;
    }
    function onEditProfileSuccess() {
        toast.success('Profile updated successfully!');
        closeEditProfileModal();
        invalidate('app:deviceProfile');
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
    const SCHEDULE_KEYS = ['power_management_schedule', 'reboot_schedule_enabled', 'download_schedule_enabled'];

    function settingRow(key: string): { key: string; label: string; description: string; value: string } | null {
        const settingsList = Array.isArray(availableSettings) ? availableSettings : [];
        const def = settingsList.find((a: { key: string }) => a.key === key);
        if (!def) return null;
        if (def.dependsOn && getSettingValue(def.dependsOn) !== 'enabled') return null;
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

    $: kioskSettingsRows = KIOSK_KEYS.map(settingRow).filter(Boolean) as { key: string; label: string; description: string; value: string }[];
    $: displaySettingsRows = DISPLAY_KEYS.map(settingRow).filter(Boolean) as { key: string; label: string; description: string; value: string }[];
    $: scheduleSettingsRows = SCHEDULE_KEYS.map(settingRow).filter(Boolean) as { key: string; label: string; description: string; value: string }[];

    $: deviceRows = (profile?.assignments ?? []).map((a: { device: { id: string; name: string; description?: string | null; deviceType?: string | null; status?: string; macAddress?: string | null; wifiMac?: string | null; lastUsedAt?: Date | string | null } }) => {
        const d = a.device;
        const mac = d.macAddress || d.wifiMac || '—';
        return {
            id: d.id,
            name: d.name,
            description: d.description,
            deviceType: d.deviceType ?? '—',
            status: d.status ?? 'ACTIVE',
            macAddress: mac,
            lastUsedAt: d.lastUsedAt ?? null
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
                <!-- Device Configuration (read-only) - same blocks as Device tab: Kiosk, Display, Schedule -->
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

                    <!-- Schedule Settings Section -->
                    <div class="config-table-wrap">
                        {#each scheduleSettingsRows as item, i}
                            <div class="config-row" class:last={i === scheduleSettingsRows.length - 1}>
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
                </Card>
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
                                            <span class="assigned-devices-th-inner">Last Seen <span class="assigned-devices-th-icon"><ChevronDown size={16} /></span></span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#if paginatedDeviceRows.length === 0}
                                        <tr>
                                            <td colspan="5" class="assigned-devices-empty">No devices assigned to this profile</td>
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
                                                <td class="assigned-devices-td assigned-devices-td-lastseen" class:assigned-devices-lastseen-offline={row.status !== 'ACTIVE' && !row.lastUsedAt}>
                                                    {#if row.lastUsedAt}
                                                        {formatLastSeen(row.lastUsedAt)}
                                                    {:else}
                                                        <span class="assigned-devices-lastseen-placeholder">—</span>
                                                    {/if}
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

    .assigned-devices-lastseen-offline .assigned-devices-lastseen-placeholder,
    .assigned-devices-lastseen-offline {
        color: var(--ds-color-error-600, #D92D20);
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
</style>
