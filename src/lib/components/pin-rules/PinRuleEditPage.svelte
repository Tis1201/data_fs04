<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { Button, Card, Badge, TabGroup, Modal, ActionMenu } from '$lib/design-system/components';
    import { ArrowLeft, Plus, Trash, Copy, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-svelte';
    import DeviceSelector from '$lib/components/bundles_ui/device_select/DeviceSelector.svelte';
    import AppPickerModal from '$lib/components/shared/AppPickerModal.svelte';
    import type { AppPickerItem } from '$lib/components/shared/AppPickerModal.svelte';
    import { toast } from 'svelte-sonner';
    import { onMount } from 'svelte';
    
    import { browser } from '$app/environment';

    export let rule: any;
    export let title: string;
    export let breadcrumbs: [string, string][];
    export let basePath: string;
    export let apiPrefix: string;
    export let context: 'admin' | 'user' = 'admin';
    export let showDelete = false;
    /** When true, show read-only detail view with "Edit" button instead of "Edit Rule" submit and Add App */
    export let readOnly: boolean = false;
    /** When provided and readOnly, Edit button calls this instead of navigating to edit page (e.g. open edit modal) */
    export let onEditClick: (() => void) | undefined = undefined;

    $: rule = rule;

    let formData = {
        name: '',
        description: '',
        apps: '',
        targetType: 'all',
        isActive: true
    };

    $: if (rule) {
        formData = {
            name: rule.name || '',
            description: rule.description || '',
            apps: (rule.apps || []).join(', '),
            targetType: rule.targetType || 'all',
            isActive: rule.isActive ?? true
        };
    }

    let isSubmitting = false;
    let deleting = false;
    let appPickerOpen = false;
    let devicePickerOpen = false;

    // Add App modal handler (uses shared AppPickerModal component)
    let savingUpdates = false;

    function openAddAppModal() {
        appPickerOpen = true;
    }

    /** Persist current apps and devices to the server (used after add/remove app or device on detail page) */
    async function saveRuleToServer() {
        if (!rule?.id || savingUpdates) return;
        savingUpdates = true;
        try {
            const response = await fetch(`${apiPrefix}/pin-rules/${rule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    description: formData.description?.trim() || null,
                    apps: Array.from(selectedApps),
                    targetType: formData.targetType,
                    targetValue: formData.targetType === 'specific' ? selectedDevices.map((d) => d.id) : [],
                    isActive: formData.isActive
                })
            });
            const result = await response.json();
            if (result.success) {
                toast.success('Rule updated');
                await invalidate();
            } else {
                toast.error(result.message || 'Failed to update rule');
            }
        } catch {
            toast.error('Failed to update rule');
        } finally {
            savingUpdates = false;
        }
    }

    async function handleAddAppConfirm(e: CustomEvent<{ selected: string[]; apps: AppPickerItem[] }>) {
        const { selected } = e.detail;
        selected.forEach((pkg) => selectedApps.add(pkg));
        selectedApps = new Set(selectedApps);
        syncAppsToForm();
        loadAppDetails();
        appPickerOpen = false;
        await saveRuleToServer();
    }

    let deleteOpen = false;
    let openMoreMenuKey: string | null = null;
    let duplicateLoading = false;
    let appsSearch = '';

    type AppDetail = { version?: string | null; format?: string | null; releaseType?: string | null; size?: number | null };
    let appDetailsMap: Record<string, AppDetail> = {};

    let selectedApps = new Set<string>();
    $: if (rule?.apps) {
        selectedApps = new Set<string>(rule.apps);
    }

    async function loadAppDetails() {
        const packages = Array.from(selectedApps).filter(Boolean);
        if (packages.length === 0) return;
        try {
            const res = await fetch(
                `${apiPrefix}/resources/apps?packages=${encodeURIComponent(packages.join(','))}&pageSize=100`
            );
            const data = await res.json().catch(() => ({}));
            const items = data?.data?.items ?? data?.items ?? [];
            const map: Record<string, AppDetail> = {};
            for (const item of items) {
                const pkg = item.packageName;
                if (pkg) {
                    map[pkg] = {
                        version: item.version ?? null,
                        format: item.format ?? null,
                        releaseType: item.releaseType ?? null,
                        size: item.size ?? null
                    };
                }
            }
            appDetailsMap = map;
        } catch {
            appDetailsMap = {};
        }
    }
    function formatSize(bytes: number | null | undefined): string {
        if (bytes == null || bytes === 0) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    type SelectedDevice = {
        id: string;
        name: string;
        macAddress?: string | null;
        status?: string;
        connected?: boolean;
        lastUsedAt?: string | null;
    };
    let selectedDevices: SelectedDevice[] = [];

    $: if (browser && rule?.targetType === 'specific' && rule?.targetValue && Array.isArray(rule.targetValue) && rule.targetValue.length > 0) {
        loadSelectedDevices();
    } else if (browser && rule?.targetType === 'all') {
        selectedDevices = [];
    }

    onMount(() => {
        if (rule?.apps?.length) loadAppDetails();
    });

    async function loadSelectedDevices() {
        if (!rule?.targetValue || !Array.isArray(rule.targetValue) || rule.targetValue.length === 0) return;
        try {
            const response = await fetch(`/api/v2/devices/select?includeDeviceIds=${rule.targetValue.join(',')}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data?.devices) {
                    selectedDevices = result.data.devices.map((d: any) => ({
                        id: d.id,
                        name: d.name || d.id,
                        macAddress: d.macAddress ?? null,
                        status: d.status,
                        connected: d.connected,
                        lastUsedAt: d.lastUsedAt ?? null
                    }));
                }
            }
        } catch {
            toast.error('Failed to load selected devices');
        }
    }

    function formatLastSeen(lastUsedAt: string | null | undefined): string {
        if (!lastUsedAt) return '—';
        try {
            const d = new Date(lastUsedAt);
            if (Number.isNaN(d.getTime())) return '—';
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} min ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours} hr ago`;
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return '—';
        }
    }

    function syncAppsToForm() {
        formData.apps = Array.from(selectedApps).join(', ');
    }

    async function handleDevicesSelected(e: CustomEvent<{ id: string; name: string }[]>) {
        selectedDevices = [...selectedDevices, ...e.detail];
        devicePickerOpen = false;
        await saveRuleToServer();
    }

    async function removeDevice(deviceId: string) {
        selectedDevices = selectedDevices.filter((d) => d.id !== deviceId);
        await saveRuleToServer();
    }

    async function removeApp(pkg: string) {
        selectedApps.delete(pkg);
        selectedApps = new Set(selectedApps);
        syncAppsToForm();
        openMoreMenuKey = null;
        await saveRuleToServer();
    }

    async function handleSubmit() {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }
        if (!formData.apps.trim()) {
            toast.error('At least one app is required');
            return;
        }
        if (formData.targetType === 'specific' && selectedDevices.length === 0) {
            toast.error('Please select at least one device for specific targeting');
            return;
        }
        isSubmitting = true;
        try {
            const response = await fetch(`/api/v2/pin-rules/${rule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    description: formData.description.trim() || null,
                    apps: Array.from(selectedApps),
                    targetType: formData.targetType,
                    targetValue: formData.targetType === 'specific' ? selectedDevices.map((d) => d.id) : [],
                    isActive: formData.isActive
                })
            });
            const result = await response.json();
            if (result.success) {
                toast.success('Pin rule updated successfully');
                goto(`${basePath}/iot/pin-rules`);
            } else {
                toast.error(result.message || 'Failed to update pin rule');
            }
        } catch {
            toast.error('Failed to update pin rule');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDuplicate() {
        duplicateLoading = true;
        try {
            const res = await fetch(`/api/v2/pin-rules/${rule.id}/duplicate`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data?.error?.message || 'Failed to duplicate rule');
                return;
            }
            const newId = data?.data?.id ?? data?.id;
            toast.success('Rule duplicated successfully');
            if (newId) goto(`${basePath}/iot/pin-rules/${newId}`);
            else goto(`${basePath}/iot/pin-rules`);
        } catch {
            toast.error('Failed to duplicate rule');
        } finally {
            duplicateLoading = false;
        }
    }

    async function handleDelete() {
        deleting = true;
        try {
            const res = await fetch(`/api/v2/pin-rules/${rule.id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                toast.success('Pin rule deleted');
                goto(`${basePath}/iot/pin-rules`);
            } else {
                throw new Error(result.message || 'Failed to delete');
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete pin rule');
        } finally {
            deleting = false;
        }
    }

    function formatDateTime(d: Date | string | null | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    // Tabs (same pattern as device-profiles)
    let activeTab = 'pinned_apps';
    const tabs = [
        { id: 'pinned_apps', label: 'Pinned Apps' },
        { id: 'target_devices', label: 'Target Devices' }
    ];
    function handleTabChange(e: CustomEvent<string>) {
        activeTab = e.detail;
    }

    // Pinned apps: search filter + pagination (match device-profiles pattern)
    const APPS_PAGE_SIZE = 10;
    let appsPage = 1;
    $: appsList = Array.from(selectedApps);
    $: filteredAppsList = appsSearch.trim()
        ? appsList.filter((p) => p.toLowerCase().includes(appsSearch.trim().toLowerCase()))
        : appsList;
    $: appsTotalItems = filteredAppsList.length;
    $: appsTotalPages = Math.max(1, Math.ceil(appsTotalItems / APPS_PAGE_SIZE));
    $: if (appsPage > appsTotalPages && appsTotalPages > 0) appsPage = appsTotalPages;
    $: paginatedApps = filteredAppsList.slice((appsPage - 1) * APPS_PAGE_SIZE, appsPage * APPS_PAGE_SIZE);
    $: appsRangeStart = appsTotalItems === 0 ? 0 : (appsPage - 1) * APPS_PAGE_SIZE + 1;
    $: appsRangeEnd = Math.min(appsPage * APPS_PAGE_SIZE, appsTotalItems);

    function appsFirstPage() {
        appsPage = 1;
    }
    function appsPrevPage() {
        if (appsPage > 1) appsPage -= 1;
    }
    function appsNextPage() {
        if (appsPage < appsTotalPages) appsPage += 1;
    }
    function appsLastPage() {
        appsPage = appsTotalPages;
    }

    const targetTypeOptions = [
        { id: 'all', label: 'All Devices' },
        { id: 'specific', label: 'Specific Devices' }
    ];
</script>

<svelte:head>
    <title>Edit Pin Rule{context === 'admin' ? ' - Admin Panel' : ''}</title>
</svelte:head>

<div class="pin-rule-detail flex flex-col items-start w-full" style="padding: var(--ds-space-6); gap: var(--ds-space-6);">
    <!-- Top row: Back + Duplicate + (Edit Rule submit or Edit button) -->
    <div class="flex flex-row justify-between items-center w-full">
        <Button variant="text" color="gray" size="lg" on:click={() => goto(`${basePath}/iot/pin-rules`)}>
            <ArrowLeft size={20} slot="icon-left" />
            Back to Pin Rules
        </Button>
        <div class="flex flex-row items-center gap-3">
            <Button variant="outline" color="gray" size="lg" iconLeft={true} disabled={duplicateLoading} on:click={handleDuplicate}>
                <Copy size={18} slot="icon-left" />
                {duplicateLoading ? 'Duplicating...' : 'Duplicate'}
            </Button>
            {#if readOnly}
                <Button
                    variant="filled"
                    color="primary"
                    size="lg"
                    on:click={() => {
                        if (onEditClick) onEditClick();
                        else if (rule?.id) goto(`${basePath}/iot/pin-rules/${rule.id}/edit`);
                    }}
                >
                    Edit
                </Button>
            {:else}
                <Button
                    variant="filled"
                    color="primary"
                    size="lg"
                    iconLeft={true}
                    disabled={isSubmitting}
                    on:click={handleSubmit}
                >
                    {#if isSubmitting}
                        <span class="pin-rule-spinner" aria-hidden="true"></span>
                    {/if}
                    Edit Rule
                </Button>
            {/if}
        </div>
    </div>

    <!-- Rule Overview card (same structure as device-profiles Profile Overview) -->
    <Card variant="default" padding="none" radius="2xl" showHeader={true} fullWidth={true}>
        <div
            slot="header"
            class="pin-rule-overview-header"
            style="display: flex; flex-direction: row; align-items: center; padding: var(--ds-space-4); gap: var(--ds-space-2); border-bottom: 1px solid var(--ds-color-neutral-true-200);"
        >
            <div class="pin-rule-overview-icon" style="width: 44px; height: 44px; padding: 12px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--ds-color-neutral-true-100);">
                <!-- Inline SVG for SSR compatibility (circle-info icon) -->
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                </svg>
            </div>
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                <h3 class="font-medium truncate" style="font-size: var(--ds-text-lg); line-height: 24px; color: var(--ds-color-neutral-true-900);">Rule Overview</h3>
                <p class="text-sm" style="font-weight: 400; font-size: 14px; line-height: 20px; color: var(--ds-color-gray-600);">Key information about this rule</p>
            </div>
        </div>
        <div class="overview-details-wrap pin-rule-overview-details">
            <div class="overview-field">
                <p class="overview-label">Name</p>
                <p class="overview-value">{rule?.name || '—'}</p>
            </div>
            <div class="overview-field">
                <p class="overview-label">Status</p>
                <Badge
                    label={rule?.isActive !== false ? 'Active' : 'Inactive'}
                    color={rule?.isActive !== false ? 'success' : 'gray'}
                    variant="filled"
                    size="md"
                    showDot={rule?.isActive !== false}
                    interactive={false}
                />
            </div>
            <div class="overview-field overview-field-full-width">
                <p class="overview-label">Description</p>
                <p class="overview-value">{rule?.description || '—'}</p>
            </div>
            <div class="overview-divider" aria-hidden="true"></div>
            <div class="overview-field overview-field-full-width overview-audit">
                <p class="overview-muted">Created at {formatDateTime(rule?.createdAt)}</p>
                <p class="overview-muted">Last updated at {formatDateTime(rule?.updatedAt)}</p>
            </div>
        </div>
    </Card>

    <!-- Tabs: Pinned Apps | Target Devices -->
    <div class="w-full flex flex-col gap-6">
        <TabGroup tabs={tabs} activeTab={activeTab} type="underline" size="md" on:change={handleTabChange} />

        {#if activeTab === 'pinned_apps'}
            <Card variant="default" padding="none" class="pin-rule-apps-card">
                <div slot="header" class="pin-rule-apps-header">
                    <div class="pin-rule-apps-icon-wrap">
                        <!-- Package/box icon (outline style, matches reference) -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
                        </svg>
                    </div>
                    <div class="pin-rule-apps-header-text">
                        <h4 class="pin-rule-apps-title">Pinned Apps</h4>
                        <p class="pin-rule-apps-subtitle">List of selected pinned apps</p>
                    </div>
                    <div class="pin-rule-apps-header-actions">
                        <Button variant="filled" color="primary" size="lg" iconLeft={true} on:click={openAddAppModal}>
                            <Plus size={20} slot="icon-left" />
                            Add App
                        </Button>
                    </div>
                </div>
                <div class="pin-rule-apps-content">
                    <div class="pin-rule-apps-search-row">
                        <div class="pin-rule-apps-search-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pin-rule-apps-search-icon" aria-hidden="true">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                type="search"
                                class="pin-rule-apps-search-input"
                                placeholder="Search by package name..."
                                bind:value={appsSearch}
                                autocomplete="off"
                            />
                        </div>
                    </div>
                    <div class="pin-rule-apps-table-wrap">
                        <table class="pin-rule-apps-table">
                            <thead>
                                <tr>
                                    <th class="pin-rule-apps-th pin-rule-apps-th-name">Package Name</th>
                                    <th class="pin-rule-apps-th pin-rule-apps-th-version">Version</th>
                                    <th class="pin-rule-apps-th pin-rule-apps-th-format">Format</th>
                                    <th class="pin-rule-apps-th pin-rule-apps-th-release">Release Type</th>
                                    <th class="pin-rule-apps-th pin-rule-apps-th-size">Size</th>
                                    <th class="pin-rule-apps-th pin-rule-apps-th-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#if paginatedApps.length === 0}
                                    <tr>
                                        <td colspan="6" class="pin-rule-apps-empty">No pinned apps. Click &quot;Add App&quot; to select apps.</td>
                                    </tr>
                                {:else}
                                    {#each paginatedApps as pkg}
                                        {@const detail = appDetailsMap[pkg]}
                                        <tr class="pin-rule-apps-tbody-tr">
                                            <td class="pin-rule-apps-td pin-rule-apps-td-name">
                                                <span class="pin-rule-apps-name-text">{pkg}</span>
                                            </td>
                                            <td class="pin-rule-apps-td pin-rule-apps-td-version">{detail?.version ?? '—'}</td>
                                            <td class="pin-rule-apps-td pin-rule-apps-td-format">
                                                {#if detail?.format}
                                                    <Badge variant="outline" size="sm" label={detail.format.toUpperCase()} interactive={false} />
                                                {:else}
                                                    —
                                                {/if}
                                            </td>
                                            <td class="pin-rule-apps-td pin-rule-apps-td-release">
                                                {#if detail?.releaseType}
                                                    <Badge variant="outline" size="sm" label={detail.releaseType} interactive={false} />
                                                {:else}
                                                    —
                                                {/if}
                                            </td>
                                            <td class="pin-rule-apps-td pin-rule-apps-td-size">{formatSize(detail?.size)}</td>
                                            <td class="pin-rule-apps-td pin-rule-apps-td-actions">
                                                <ActionMenu
                                                    open={openMoreMenuKey === pkg}
                                                    items={[{ id: 'remove', label: 'Remove', destructive: true }]}
                                                    triggerIcon="dots-vertical"
                                                    align="right"
                                                    size="sm"
                                                    triggerVariant="text"
                                                    width="auto"
                                                    on:open={() => (openMoreMenuKey = pkg)}
                                                    on:close={() => (openMoreMenuKey = null)}
                                                    on:select={(e) => e.detail.id === 'remove' && removeApp(pkg)}
                                                />
                                            </td>
                                        </tr>
                                    {/each}
                                {/if}
                            </tbody>
                        </table>
                    </div>
                    {#if appsTotalItems > 0}
                        <div class="pin-rule-apps-pagination">
                            <span class="pin-rule-apps-pagination-details">{appsRangeStart} - {appsRangeEnd} of {appsTotalItems}</span>
                            <div class="pin-rule-apps-pagination-buttons">
                                <button type="button" class="pin-rule-apps-pagination-btn" on:click={appsFirstPage} disabled={appsPage <= 1} aria-label="First page">
                                    <ChevronsLeft size={20} />
                                </button>
                                <button type="button" class="pin-rule-apps-pagination-btn" on:click={appsPrevPage} disabled={appsPage <= 1} aria-label="Previous page">
                                    <ChevronLeft size={20} />
                                </button>
                                <span class="pin-rule-apps-pagination-page">{appsPage}</span>
                                <button type="button" class="pin-rule-apps-pagination-btn" on:click={appsNextPage} disabled={appsPage >= appsTotalPages} aria-label="Next page">
                                    <ChevronRight size={20} />
                                </button>
                                <button type="button" class="pin-rule-apps-pagination-btn" on:click={appsLastPage} disabled={appsPage >= appsTotalPages} aria-label="Last page">
                                    <ChevronsRight size={20} />
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            </Card>
        {:else if activeTab === 'target_devices'}
            <Card variant="default" padding="md" class="pin-rule-target-card">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-col gap-2">
                        <span class="text-sm font-medium" style="color: var(--ds-color-neutral-true-700);">Target type</span>
                        <p class="overview-value">{rule?.targetType === 'specific' ? 'Specific Devices' : 'All Devices'}</p>
                    </div>
                    {#if rule?.targetType === 'specific'}
                        <div class="flex flex-col gap-2">
                            <div class="flex flex-row items-center justify-between gap-2">
                                <span class="text-sm font-medium" style="color: var(--ds-color-neutral-true-700);">Selected devices</span>
                                <Button variant="filled" color="primary" size="md" iconLeft={true} on:click={() => (devicePickerOpen = true)}>
                                    <Plus size={18} slot="icon-left" />
                                    Add Device
                                </Button>
                            </div>
                            {#if selectedDevices.length === 0}
                                <span class="text-sm" style="color: var(--ds-color-gray-500);">No devices selected. Click &quot;Add Device&quot; to select devices.</span>
                            {:else}
                                <div class="pin-rule-devices-table-wrap">
                                    <table class="pin-rule-devices-table">
                                        <thead>
                                            <tr>
                                                <th>Device Name</th>
                                                <th>MAC Address</th>
                                                <th>Status</th>
                                                <th>Last Seen</th>
                                                <th class="pin-rule-th-actions">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each selectedDevices as device (device.id)}
                                                <tr>
                                                    <td>
                                                        <span class="pin-rule-device-name">{device.name || device.id}</span>
                                                    </td>
                                                    <td class="pin-rule-mac">{device.macAddress || '—'}</td>
                                                    <td>
                                                        {#if device.connected != null}
                                                            <span class="pin-rule-status-badge" class:online={device.connected} class:offline={!device.connected}>
                                                                {device.connected ? 'Online' : 'Offline'}
                                                            </span>
                                                        {:else}
                                                            —
                                                        {/if}
                                                    </td>
                                                    <td class="pin-rule-last-seen">{formatLastSeen(device.lastUsedAt)}</td>
                                                    <td class="pin-rule-td-actions">
                                                        <ActionMenu
                                                            items={[{ id: 'remove', label: 'Remove', destructive: true }]}
                                                            triggerIcon="dots-vertical"
                                                            triggerColor="gray"
                                                            triggerVariant="text"
                                                            size="sm"
                                                            on:select={() => removeDevice(device.id)}
                                                        />
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </Card>
        {/if}
    </div>

</div>

<!-- Add App Modal (shared component, same UX as device detail Install New App) -->
<AppPickerModal
    open={appPickerOpen}
    title="Add App"
    size="md"
    confirmText="Assign"
    appsEndpoint={`${apiPrefix}/resources/apps`}
    excludePackages={Array.from(selectedApps).filter(Boolean)}
    selectionMode="packageName"
    on:close={() => (appPickerOpen = false)}
    on:confirm={handleAddAppConfirm}
/>

<DeviceSelector
    bind:open={devicePickerOpen}
    bundleId=""
    {apiPrefix}
    devicesEndpoint="/api/v2/devices/select"
    excludeDeviceIds={selectedDevices.map((d) => d.id)}
    on:select={handleDevicesSelected}
    on:close={() => (devicePickerOpen = false)}
/>

{#if showDelete && context === 'user'}
    <Modal
        open={deleteOpen}
        title="Delete Pin Rule"
        type="error"
        size="md"
        cancelText="Cancel"
        confirmText="Delete"
        confirmLoading={deleting}
        confirmDisabled={deleting}
        on:close={() => (deleteOpen = false)}
        on:confirm={() => {
            deleteOpen = false;
            handleDelete();
        }}
    >
        <p class="text-[var(--ds-text-secondary)]">Are you sure you want to delete this pin rule? This action cannot be undone.</p>
    </Modal>
{/if}

<style>
    .pin-rule-spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid transparent;
        border-top-color: currentColor;
        border-radius: 50%;
        animation: pin-rule-spin 0.8s linear infinite;
        margin-right: 8px;
    }
    @keyframes pin-rule-spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Rule Overview details – same layout/CSS as bundles Deployment Overview */
    .pin-rule-overview-details.overview-details-wrap {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        padding: var(--ds-space-4);
        gap: var(--ds-space-4) var(--ds-space-6);
        box-sizing: border-box;
    }
    .pin-rule-overview-details .overview-field {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ds-space-1);
        min-width: 0;
    }
    .pin-rule-overview-details .overview-field-full-width {
        grid-column: 1 / -1;
    }
    .pin-rule-overview-details .overview-label {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }
    .pin-rule-overview-details .overview-value {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-md);
        font-weight: var(--ds-font-medium);
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }
    .pin-rule-overview-details .overview-muted {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }
    .pin-rule-overview-details .overview-divider {
        grid-column: 1 / -1;
        width: 100%;
        height: 0;
        border-top: 1px solid var(--ds-color-neutral-true-200);
    }
    .pin-rule-overview-details .overview-audit {
        flex-direction: row;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
    }

    .pin-rule-apps-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px 24px;
        gap: 12px;
        border-bottom: 1px solid var(--ds-color-neutral-true-200);
    }
    .pin-rule-apps-icon-wrap {
        width: 44px;
        height: 44px;
        padding: 12px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ds-color-neutral-true-100);
    }
    .pin-rule-apps-header-text {
        flex: 1;
        min-width: 0;
    }
    .pin-rule-apps-title {
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }
    .pin-rule-apps-subtitle {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600);
        margin: 0;
    }
    .pin-rule-apps-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .pin-rule-apps-content {
        display: flex;
        flex-direction: column;
        width: 100%;
    }
    .pin-rule-apps-search-row {
        padding: 12px 24px;
        border-bottom: 1px solid var(--ds-color-neutral-true-200);
    }
    .pin-rule-apps-search-wrap {
        position: relative;
        max-width: 320px;
        color: var(--ds-color-neutral-true-500);
    }
    .pin-rule-apps-search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        flex-shrink: 0;
    }
    .pin-rule-apps-search-input {
        width: 100%;
        padding: 8px 12px 8px 40px;
        border: 1px solid var(--ds-color-neutral-true-300);
        border-radius: 8px;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-900);
        background: var(--ds-color-white);
        cursor: text;
    }
    .pin-rule-apps-search-input::placeholder {
        color: var(--ds-color-neutral-true-500);
    }
    .pin-rule-apps-search-input:focus {
        outline: none;
        border-color: var(--ds-color-primary-500);
        box-shadow: 0 0 0 2px var(--ds-color-primary-100);
    }
    .pin-rule-apps-table-wrap {
        width: 100%;
        overflow-x: auto;
    }
    .pin-rule-apps-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
    }
    .pin-rule-apps-th {
        padding: 12px 16px;
        background: var(--ds-color-neutral-true-100);
        border-bottom: 1px solid var(--ds-color-gray-200);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600);
        text-align: left;
        height: 44px;
    }
    .pin-rule-apps-th-name {
        min-width: 180px;
        width: auto;
    }
    .pin-rule-apps-th-version {
        min-width: 90px;
        width: auto;
    }
    .pin-rule-apps-th-format {
        min-width: 80px;
        width: auto;
    }
    .pin-rule-apps-th-release {
        min-width: 100px;
        width: auto;
    }
    .pin-rule-apps-th-size {
        min-width: 80px;
        width: auto;
    }
    .pin-rule-apps-th-actions {
        width: 85px;
        min-width: 85px;
    }
    .pin-rule-apps-tbody-tr {
        background: var(--ds-color-white);
    }
    .pin-rule-apps-td {
        padding: 16px;
        border-bottom: 1px solid var(--ds-color-gray-200);
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-900);
        vertical-align: middle;
    }
    .pin-rule-apps-td-name {
        padding: 12px 16px;
    }
    .pin-rule-apps-td-version,
    .pin-rule-apps-td-format,
    .pin-rule-apps-td-release,
    .pin-rule-apps-td-size {
        padding: 12px 16px;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-700);
        vertical-align: middle;
    }
    .pin-rule-apps-name-text {
        font-weight: 500;
        font-size: 14px;
        color: var(--ds-color-neutral-true-900);
    }
    .pin-rule-apps-td-actions {
        padding: 12px 16px;
    }
    .pin-rule-apps-empty {
        padding: 24px 16px;
        text-align: center;
        color: var(--ds-text-secondary);
        font-size: 14px;
    }
    .pin-rule-apps-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: 8px 24px;
        gap: 8px;
        min-height: 56px;
        border-top: 1px solid var(--ds-color-gray-200);
    }
    .pin-rule-apps-pagination-details {
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-600);
    }
    .pin-rule-apps-pagination-buttons {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    .pin-rule-apps-pagination-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        padding: 8px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--ds-color-neutral-true-800);
        cursor: pointer;
    }
    .pin-rule-apps-pagination-btn:hover:not(:disabled) {
        background: var(--ds-color-gray-50);
    }
    .pin-rule-apps-pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .pin-rule-apps-pagination-page {
        display: flex;
        justify-content: center;
        align-items: center;
        min-width: 40px;
        height: 36px;
        padding: 0 12px;
        background: var(--ds-color-gray-50);
        border-radius: 8px;
        font-weight: 500;
        font-size: 14px;
        color: var(--ds-color-gray-800);
    }
    .pin-rule-target-card .overview-value {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-md);
        font-weight: var(--ds-font-medium);
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }
    .pin-rule-select {
        padding: 8px 12px;
        border: 1px solid var(--ds-color-neutral-true-300);
        border-radius: 8px;
        font-size: 14px;
        min-width: 200px;
    }
    .pin-rule-devices-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
    }
    .pin-rule-devices-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--ds-text-sm);
    }
    .pin-rule-devices-table thead {
        background: var(--ds-color-gray-50);
    }
    .pin-rule-devices-table th {
        text-align: left;
        padding: var(--ds-space-3);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
        border-bottom: 1px solid var(--ds-border-default);
    }
    .pin-rule-devices-table td {
        padding: var(--ds-space-3);
        border-bottom: 1px solid var(--ds-color-gray-100);
        vertical-align: middle;
    }
    .pin-rule-devices-table tbody tr:last-child td {
        border-bottom: none;
    }
    .pin-rule-devices-table tbody tr:hover {
        background: var(--ds-color-gray-50);
    }
    .pin-rule-th-actions,
    .pin-rule-td-actions {
        width: 1%;
        white-space: nowrap;
        text-align: right;
    }
    .pin-rule-device-name {
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
    }
    .pin-rule-mac {
        font-family: var(--ds-font-family-mono, ui-monospace, monospace);
        color: var(--ds-text-secondary);
    }
    .pin-rule-last-seen {
        color: var(--ds-text-secondary);
    }
    .pin-rule-status-badge {
        display: inline-block;
        padding: 2px var(--ds-space-2);
        border-radius: var(--ds-radius-md);
        font-size: var(--ds-text-xs);
        font-weight: var(--ds-font-medium);
    }
    .pin-rule-status-badge.online {
        background: var(--ds-color-green-50, #ecfdf5);
        color: var(--ds-color-green-700, #15803d);
    }
    .pin-rule-status-badge.offline {
        background: var(--ds-color-gray-100);
        color: var(--ds-text-secondary);
    }
    .pin-rule-chip-remove {
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
    }
    .pin-rule-chip-remove:hover {
        color: var(--ds-text-primary);
    }

    /* Add App Modal styles are now in shared AppPickerModal component */
</style>
