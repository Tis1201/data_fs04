<script lang="ts">
    import { tick, onMount } from "svelte";
    import { DeviceTable, Button, InputField, Modal, ConfirmModal, Checkbox, BulkActionsBar, Dropdown, Tag, Radio } from "$lib/design-system/components";
    import { initializeDeviceRealtime, deviceRealtimeStore } from "$lib/stores/deviceRealtimeStore";
    import type { DeviceRow, DeviceTablePagination, DeviceTableSort } from "$lib/design-system/components/DeviceTable.svelte";
    import { goto, invalidate } from "$app/navigation";
    import { page } from "$app/stores";
    import { Search, Filter, Plus, Tags, GitFork, Server, BookUp2, Eye, EyeOff, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Info } from "lucide-svelte";
    import { claimDevice } from "$lib/client/mqtt/claimFlow";
    import type { PageData } from "./$types";
    import EditDeviceModal from "$lib/components/devices/EditDeviceModal.svelte";
    import { toast } from "$lib/stores/alertToast";
    import { browser } from "$app/environment";
    import { getAppFormatsForDeviceType } from "$lib/utils/bundleUtils";
    import { parseAsUtc } from "$lib/utils/deviceDetailsUtils";

    // Type for available tags
    interface AvailableTag {
        id: string;
        name: string;
    }

    // Type for device profiles
    interface DeviceProfile {
        id: string;
        name: string;
        description?: string;
        settings?: string; // JSON string of settings array
    }

    export let data: PageData;
    /** Route params from SvelteKit (avoids "unknown prop 'params'" warning) */
    export let params: Record<string, string> = {};

    // State
    let devices: DeviceRow[] = [];
    let selectedRows: DeviceRow[] = [];
    let loading = false;
    let searchValue = "";
    let activeFilters: Record<string, string[]> = {};

    // =========================
    // Modals (Figma)
    // =========================
    let showAddDeviceModal = false;
    let showFilterModal = false;

    // Add Device (PIN claim) modal state
    let claimPin = "";
    let claimLoading = false;
    let claimError: string | null = null;

    // =========================
    // Confirmation Modals
    // =========================
    let showDeactivateModal = false;
    let showDeleteModal = false;
    let pendingActionDevice: DeviceRow | null = null;
    let actionLoading = false;

    // =========================
    // Edit Device Modal
    // =========================
    let showEditDeviceModal = false;
    let editDevice: DeviceRow | null = null;

    // Filter modal selections (UI values)
    // Include '__all__' type for "All" option
    let filterOsVersions: string[] = ['__all__'];
    let filterConnection: Array<'Online' | 'Offline' | '__all__'> = ['__all__'];
    let filterStatuses: Array<'ACTIVE' | 'INACTIVE' | '__all__'> = ['__all__'];
    let filterTagIds: string[] = ['__all__'];

    const OS_OPTIONS = ["Android", "Linux", "Windows", "macOS"];
    const CONNECTION_OPTIONS: Array<'Online' | 'Offline'> = ["Online", "Offline"];
    const STATUS_OPTIONS: Array<'ACTIVE' | 'INACTIVE'> = ["ACTIVE", "INACTIVE"];

    function normalizeMultiSelect(next: string | string[], prev: string[]): string[] {
        const arr = Array.isArray(next) ? next : (next ? [next] : []);

        // If "All" was just added (not in prev but in arr), select only "All"
        if (arr.includes('__all__') && !prev.includes('__all__')) {
            return ['__all__'];
        }

        // If "All" was just removed (in prev but not in arr), keep empty (will show "Select")
        if (!arr.includes('__all__') && prev.includes('__all__')) {
            // User clicked "All" to deselect it, but we want "All" to always be selected when clicked
            // So if arr is empty, return ['__all__']
            if (arr.length === 0) return ['__all__'];
            return arr.filter(v => v !== '__all__');
        }

        // If any non-All option is selected, remove "All"
        if (arr.some(v => v !== '__all__')) {
            return arr.filter(v => v !== '__all__');
        }

        // Default: if nothing selected, show "All"
        if (arr.length === 0) return ['__all__'];

        return arr;
    }

    // Get actual filter values (excluding __all__ which means "no filter")
    function getActualFilterValues(values: string[]): string[] {
        if (values.includes('__all__') || values.length === 0) return [];
        return values;
    }

    $: availableTags = ((data as any)?.availableTags || []) as AvailableTag[];
    $: tagOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...availableTags.map((t) => ({ id: t.id, label: t.name, type: 'checkbox' as const }))
    ];

    // Device Profiles - load from server-side data (similar to availableTags)
    $: availableProfiles = ((data as any)?.availableProfiles || []) as DeviceProfile[];

    $: deviceStatusOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        { id: 'ACTIVE', label: 'Active', type: 'checkbox' as const },
        { id: 'INACTIVE', label: 'Deactivated', type: 'checkbox' as const }
    ];

    $: connectionStatusOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        { id: 'Online', label: 'Online', type: 'checkbox' as const },
        { id: 'Offline', label: 'Offline', type: 'checkbox' as const }
    ];

    $: osVersionOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...OS_OPTIONS.map((os) => ({ id: os, label: os, type: 'checkbox' as const }))
    ];

    // Transform server data to DeviceRow format
    function transformServerData(serverData: any): DeviceRow[] {
        if (!serverData?.devices) return [];

        return serverData.devices.map((device: any) => {
            const mac = device.macAddress || device.lanMac || device.wifiMac;
            const deviceInfo = serverData.deviceInformation?.[mac]
                ?? serverData.deviceInformationByDeviceId?.[device.id];
            const osFromInfo = deviceInfo?.os_version;
            const deviceTypeFromInfo = osFromInfo
                ? (/\b(darwin|macos|ios|apple)\b/i.test(osFromInfo) ? 'Apple'
                    : /\b(android)\b/i.test(osFromInfo) ? 'Android'
                    : /\b(linux|ubuntu|debian|centos|fedora|rhel|arch|suse)\b/i.test(osFromInfo) ? 'Linux'
                    : /\b(windows|win|nt)\b/i.test(osFromInfo) ? 'Windows'
                    : osFromInfo)
                : null;
            return {
                id: device.id,
                name: device.name || 'Unnamed Device',
                macAddress: mac || 'N/A',
                osVersion: device.osVersion ?? osFromInfo ?? 'Unknown',
                deviceType: device.deviceType ?? deviceTypeFromInfo ?? 'Unknown',  // Operating System column
                status: device.status || 'INACTIVE',
                connected: device.connected ?? false,
                connectedAt: device.connectedAt ? new Date(device.connectedAt) : undefined,
                disconnectedAt: device.disconnectedAt ? new Date(device.disconnectedAt) : undefined,
                // Include profileId and config fields for Edit Device modal
                profileId: device.profileId || null,
                kioskLockMode: device.kioskLockMode ?? false,
                exitLockdownPassword: device.exitLockdownPassword || null,
                kioskApplication: device.kioskApplication || null,
                displayResolution: device.displayResolution || null,
                screenOrientation: device.screenOrientation || null,
                brightnessLevel: device.brightnessLevel ?? null,
                audioEnabled: device.audioEnabled ?? null,
                audioVolume: device.audioVolume ?? null,
                timezone: device.timezone || null,
                homeLauncher: device.homeLauncher || null,
                powerManagementSchedule: device.powerManagementSchedule ?? false,
                rebootSchedule: device.rebootSchedule ?? false,
                downloadSchedule: device.downloadSchedule ?? false,
                // Prefer Postgres lastUsedAt (HTTP + MQTT heartbeats) over ClickHouse for Last ping
                // parseAsUtc: ClickHouse returns "2026-03-17 16:18:59.506" (UTC, no Z) which JS otherwise parses as local
                lastSeenAt: (() => {
                    const prisma = device.lastUsedAt || device.lastSeenAt;
                    const ch = deviceInfo?.last_connected_at || deviceInfo?.last_status_at;
                    const raw = prisma || ch;
                    return raw ? parseAsUtc(raw) ?? undefined : undefined;
                })(),
                tags: (device.tags || []).map((tag: any) => ({
                    id: tag.id || tag.tagId,
                    name: tag.name || tag.tagName
                })),
                // ClickHouse returns snake_case: cpu_usage, ram_usage, disk_usage
                cpuUsage: deviceInfo?.cpu_usage ?? deviceInfo?.cpuUsage ?? device.deviceInformation?.cpu_usage ?? null,
                memUsage: deviceInfo?.ram_usage ?? deviceInfo?.memUsage ?? device.deviceInformation?.ram_usage ?? null,
                diskUsage: deviceInfo?.disk_usage ?? deviceInfo?.diskUsage ?? device.deviceInformation?.disk_usage ?? null
            };
        });
    }

    // Initialize from server data
    $: {
        if (data) {
            devices = transformServerData(data);

            // Map server meta format to component format
            const serverMeta = data.meta as any;
            pagination = {
                page: serverMeta?.pagination?.page || serverMeta?.page || 1,
                perPage: serverMeta?.pagination?.per_page || serverMeta?.perPage || 10,
                total: serverMeta?.pagination?.total_records || serverMeta?.total || 0,
                totalPages: serverMeta?.pagination?.total_pages || serverMeta?.totalPages || 0
            };
        }
    }

    // Real-time device connection: init store (so MQTT updates populate it) and merge into table data
    onMount(() => {
        if (browser) initializeDeviceRealtime();
    });
    $: displayData = (() => {
        const store = $deviceRealtimeStore;
        const rows = store
            ? devices.map((row) => {
                const known = store.getDevice(row.id);
                const connected = known !== null ? store.isDeviceConnected(row.id) : row.connected;
                return { ...row, connected };
            })
            : devices;
        // When offline, clear CPU/MEM/DSK (same as Device Details TC-DV-0090)
        return rows.map((row) =>
            !row.connected ? { ...row, cpuUsage: null, memUsage: null, diskUsage: null } : row
        );
    })();

    let pagination: DeviceTablePagination = {
        page: (data?.meta as any)?.pagination?.page || (data?.meta as any)?.page || 1,
        perPage: (data?.meta as any)?.pagination?.per_page || (data?.meta as any)?.perPage || 10,
        total: (data?.meta as any)?.pagination?.total_records || (data?.meta as any)?.total || 0,
        totalPages: (data?.meta as any)?.pagination?.total_pages || (data?.meta as any)?.totalPages || 0
    };

    let sort: DeviceTableSort = {
        field: (data?.meta as any)?.sort?.field || "name",
        order: (data?.meta as any)?.sort?.order || "asc"
    };

    // Count active filters for badge display
    $: activeFilterCount = Object.keys(activeFilters).length;

    // Reload data from server when params change
    async function reloadData() {
        loading = true;
        try {
            // Update URL with new params
            const url = new URL($page.url);
            url.searchParams.set('page', String(pagination.page));
            // server expects per_page
            url.searchParams.set('per_page', String(pagination.perPage));
            if (sort) {
                url.searchParams.set('sort', sort.field);
                url.searchParams.set('order', sort.order);
            }
            if (searchValue) {
                url.searchParams.set('search', searchValue);
            } else {
                url.searchParams.delete('search');
            }

            // Clear known filter params (including per-column filter keys)
            ['types', 'statuses', 'osVersions', 'connected', 'tags', 'deviceType', 'usage'].forEach((k) => url.searchParams.delete(k));
            // Apply filters using server-supported keys (comma-separated)
            // Only set params if values array is non-empty
            Object.entries(activeFilters).forEach(([key, values]) => {
                if (!values || values.length === 0) return;
                url.searchParams.set(key, values.join(','));
            });

            await invalidate('app:userDevices');
            await goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
        } catch (error) {
            console.error("Error reloading data:", error);
        } finally {
            loading = false;
        }
    }

    // Event handlers
    function handleSort(event: CustomEvent<DeviceTableSort>) {
        sort = event.detail;
        pagination.page = 1; // Reset to first page on sort
        reloadData();
    }

    function handlePageChange(event: CustomEvent<number>) {
        pagination = { ...pagination, page: event.detail };
        reloadData();
    }

    function handleFilter(event: CustomEvent<Record<string, string[]>>) {
        activeFilters = event.detail;
        pagination.page = 1; // Reset to first page on filter
        reloadData();
    }

    function handleSelectionChange(event: CustomEvent<DeviceRow[]>) {
        selectedRows = event.detail;
    }

    async function handleView(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        await goto(`/user/iot/devices/${device.id}`);
    }

    async function handleEdit(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        await openEditDeviceModal(device);
    }

    async function openEditDeviceModal(device: DeviceRow) {
        editDevice = device;
        showEditDeviceModal = true;
    }

    function handleEditDeviceSave() {
        toast.success('Device saved successfully!');
        showEditDeviceModal = false;
        editDevice = null;
        invalidate('app:userDevices');
    }

    function handleEditDeviceError(error: string) {
        toast.error( `Unable to save device: ${error}`);
    }

    function handleEditDeviceClose() {
        showEditDeviceModal = false;
        editDevice = null;
    }

    // Open Deactivate/Reactivate confirmation modal
    function handleToggleStatus(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        pendingActionDevice = device;
        showDeactivateModal = true;
    }

    // Confirm Deactivate/Reactivate action
    async function confirmToggleStatus() {
        if (!pendingActionDevice) return;

        actionLoading = true;
        const device = pendingActionDevice;
        const nextStatus = device.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const actionName = device.status === 'ACTIVE' ? 'deactivated' : 'reactivated';

        try {
            const fd = new FormData();
            fd.set('id', device.id);
            fd.set('status', nextStatus);
            const res = await fetch('?/toggleStatus', { method: 'POST', body: fd });

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || res.statusText);
            }

            toast.success( `Device ${actionName} successfully!`);
            await invalidate('app:userDevices');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toast.error( `Unable to ${device.status === 'ACTIVE' ? 'deactivate' : 'reactivate'}. Please try again!`);
            console.error(`Failed to ${actionName}:`, errorMsg);
        } finally {
            actionLoading = false;
            showDeactivateModal = false;
            pendingActionDevice = null;
        }
    }

    async function handleReboot(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        try {
            const res = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'reboot' })
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || res.statusText);
            }

            toast.success( 'Device rebooted successfully!');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toast.error( 'Unable to reboot Device. Please try again!');
            console.error("Failed to reboot:", errorMsg);
        }
    }

    // Open Delete confirmation modal
    function handleDelete(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        pendingActionDevice = device;
        showDeleteModal = true;
    }

    // Confirm Delete action
    async function confirmDelete() {
        if (!pendingActionDevice) return;

        actionLoading = true;
        const device = pendingActionDevice;

        try {
            const fd = new FormData();
            fd.set('id', device.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || res.statusText);
            }

            toast.success( 'Device deleted successfully!');
            await invalidate('app:userDevices');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toast.error( 'Unable to delete device. Please try again!');
            console.error("Failed to delete:", errorMsg);
        } finally {
            actionLoading = false;
            showDeleteModal = false;
            pendingActionDevice = null;
        }
    }

    // Cancel modal actions
    function cancelDeactivateModal() {
        showDeactivateModal = false;
        pendingActionDevice = null;
    }

    function cancelDeleteModal() {
        showDeleteModal = false;
        pendingActionDevice = null;
    }

    function openAddDeviceModal() {
        claimPin = "";
        claimError = null;
        claimLoading = false;
        showAddDeviceModal = true;
    }

    function openFilter() {
        // hydrate selections from activeFilters
        // If no filter is set, show "All" as checked
        filterOsVersions = activeFilters.osVersions?.length ? [...activeFilters.osVersions] : ['__all__'];
        filterConnection = activeFilters.connected?.length
            ? (activeFilters.connected || []).map((v) => (v.toLowerCase() === 'offline' ? 'Offline' : 'Online')) as any
            : ['__all__'];
        filterStatuses = activeFilters.statuses?.length ? (activeFilters.statuses || []) as any : ['__all__'];
        filterTagIds = activeFilters.tags?.length ? [...activeFilters.tags] : ['__all__'];
        showFilterModal = true;
    }

    function applyFilterModal() {
        const next: Record<string, string[]> = {};
        // Use getActualFilterValues to exclude '__all__' from actual filters
        const actualOsVersions = getActualFilterValues(filterOsVersions);
        const actualConnection = getActualFilterValues(filterConnection);
        const actualStatuses = getActualFilterValues(filterStatuses);
        const actualTags = getActualFilterValues(filterTagIds);

        if (actualOsVersions.length) next.osVersions = [...actualOsVersions];
        if (actualConnection.length) next.connected = actualConnection.map((v) => v); // Online/Offline (server transformer)
        if (actualStatuses.length) next.statuses = actualStatuses.map((v) => v);
        if (actualTags.length) next.tags = [...actualTags];
        activeFilters = next;
        pagination.page = 1;
        showFilterModal = false;
        reloadData();
    }

    function clearFilterModal() {
        // Set to ['__all__'] to show "All" as checked
        filterOsVersions = ['__all__'];
        filterConnection = ['__all__'];
        filterStatuses = ['__all__'];
        filterTagIds = ['__all__'];
    }

    function handleDeviceStatusChange(e: CustomEvent<string | string[]>) {
        filterStatuses = normalizeMultiSelect(e.detail, filterStatuses) as any;
    }

    function handleConnectionStatusChange(e: CustomEvent<string | string[]>) {
        filterConnection = normalizeMultiSelect(e.detail, filterConnection) as any;
    }

    function handleOsVersionChange(e: CustomEvent<string | string[]>) {
        filterOsVersions = normalizeMultiSelect(e.detail, filterOsVersions);
    }

    function handleTagChange(e: CustomEvent<string | string[]>) {
        filterTagIds = normalizeMultiSelect(e.detail, filterTagIds);
    }

    async function confirmClaimDevice() {
        claimError = null;
        if (!claimPin || claimPin.length < 6) {
            claimError = "PIN code must be 6 digits";
            return;
        }
        claimLoading = true;
        try {
            const confirmation = await claimDevice(claimPin);
            showAddDeviceModal = false;
            toast.success('Device added successfully!');
            await new Promise((r) => setTimeout(r, 1000));
            await goto(`/user/iot/devices/${confirmation.deviceId}`);
        } catch (e) {
            claimError = e instanceof Error ? e.message : String(e);
            toast.error( 'Unable to add device. Please try again!');
        } finally {
            claimLoading = false;
        }
    }

    // =========================
    // Bulk actions (Figma)
    // =========================
    // Compute bulk actions dynamically based on selected devices' status
    // If all selected devices are INACTIVE, show "Reactivate", otherwise show "Deactivate"
    $: bulkActions = (() => {
        const allInactive = selectedRows.length > 0 && selectedRows.every(row => row.status === 'INACTIVE');
        const deactivateLabel = allInactive ? 'Reactivate' : 'Deactivate';

        return [
            { id: 'assign-tag', label: 'Assign Tag', icon: Tags },
            { id: 'assign-deployment', label: 'Assign Deployment', icon: GitFork },
            { id: 'install-app', label: 'Install App', icon: Server },
            // { id: 'update', label: 'Update', icon: BookUp2 },
            { id: 'deactivate', label: deactivateLabel, destructive: true },
            { id: 'reboot', label: 'Reboot', destructive: true }
        ];
    })();

    let showBulkConfirmModal = false;
    let bulkConfirmAction: 'deactivate' | 'reboot' | null = null;
    let bulkWorking = false;
    let bulkError: string | null = null;

    // Assign Tag Modal state
    let showAssignTagModal = false;
    let assignTagSearch = "";
    let assignTagSelected: string[] = [];
    let assignTagLoading = false;
    let assignTagDropdownOpen = false;
    let assignTagDropdownInteracting = false;
    let assignTagInputContainer: HTMLDivElement;
    let assignTagDropdownPosition = { top: 0, left: 0, width: 0 };

    // Computed: filtered tags for Assign Tag modal
    $: assignTagFilteredOptions = availableTags.filter((t) =>
        t.name.toLowerCase().includes(assignTagSearch.toLowerCase())
    );

    // Update dropdown position
    function updateAssignTagDropdownPosition() {
        if (assignTagInputContainer) {
            const rect = assignTagInputContainer.getBoundingClientRect();
            assignTagDropdownPosition = {
                top: rect.bottom + 4, // 4px = var(--ds-space-1) margin
                left: rect.left,
                width: rect.width
            };
        }
    }

    function openAssignTagModal() {
        assignTagSearch = "";
        assignTagSelected = [];
        assignTagDropdownOpen = false;
        assignTagDropdownInteracting = false;
        showAssignTagModal = true;
    }

    async function handleAssignTagFocus(e: CustomEvent<FocusEvent>) {
        assignTagDropdownOpen = true;
        // Wait for DOM to render then compute position
        await tick();
        updateAssignTagDropdownPosition();
    }

    function handleAssignTagBlur(e: CustomEvent<FocusEvent>) {
        // Delay closing to allow click on options
        setTimeout(() => {
            if (!assignTagDropdownInteracting) {
                assignTagDropdownOpen = false;
            }
        }, 150);
    }

    // Assign Deployment Modal state: select a draft bundle and add selected devices to it
    interface DraftBundleOption {
        id: string;
        name: string;
    }

    let showAssignDeploymentModal = false;
    let assignDeploymentSearch = "";
    let assignDeploymentSelectedBundleId: string | null = null;
    let assignDeploymentLoading = false;
    let availableDraftBundles: DraftBundleOption[] = [];
    let assignDeploymentBundlesLoading = false;

    // Debounced search: when user types in the box, call search API after 300ms
    let assignDeploymentSearchTimeout: ReturnType<typeof setTimeout>;
    function onAssignDeploymentSearchInput() {
        clearTimeout(assignDeploymentSearchTimeout);
        assignDeploymentSearchTimeout = setTimeout(() => {
            loadDraftBundles(assignDeploymentSearch);
        }, 300);
    }

    function isDeploymentBundleSelected(bundleId: string): boolean {
        return assignDeploymentSelectedBundleId === bundleId;
    }

    async function loadDraftBundles(search?: string) {
        assignDeploymentBundlesLoading = true;
        try {
            const params = new URLSearchParams({ status: 'DRAFT' });
            if (search && search.trim()) params.set('search', search.trim());
            const res = await fetch(`/api/v2/bundles?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load bundles');
            const data = await res.json();
            const list = data?.data?.bundles ?? data?.bundles ?? [];
            availableDraftBundles = list.map((b: { id: string; name?: string }) => ({
                id: b.id,
                name: b.name || 'Unnamed deployment'
            }));
        } catch (_e) {
            availableDraftBundles = [];
        } finally {
            assignDeploymentBundlesLoading = false;
        }
    }

    function openAssignDeploymentModal() {
        assignDeploymentSearch = "";
        assignDeploymentSelectedBundleId = null;
        availableDraftBundles = [];
        showAssignDeploymentModal = true;
        loadDraftBundles();
    }

    function selectAssignDeploymentBundle(bundleId: string) {
        assignDeploymentSelectedBundleId = assignDeploymentSelectedBundleId === bundleId ? null : bundleId;
    }

    async function confirmAssignDeployment() {
        if (!assignDeploymentSelectedBundleId || selectedRows.length === 0) return;
        assignDeploymentLoading = true;
        try {
            const deviceIds = selectedRows.map((r) => r.id);
            const res = await fetch(`/api/v2/bundles/${assignDeploymentSelectedBundleId}/devices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds })
            });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result?.success !== false) {
                const added = result?.data?.addedCount ?? deviceIds.length;
                showAssignDeploymentModal = false;
                selectedRows = [];
                toast.success(added === 1 ? 'Device added to deployment.' : `${added} devices added to deployment.`);
                await invalidate('app:userDevices');
            } else {
                toast.error(result?.error?.message || 'Unable to add devices to deployment. Please try again!');
            }
        } catch (e) {
            toast.error( 'Unable to add devices to deployment. Please try again!');
            console.error('Failed to assign deployment:', e);
        } finally {
            assignDeploymentLoading = false;
        }
    }

    // Install App Modal state (Install New App - simple multi-select)
    interface AppOption {
        id: string;
        name: string;
        packageName: string;
    }

    let showInstallAppModal = false;
    let installAppSearch = "";
    let installAppSelected: string[] = [];
    let installAppLoading = false;
    let installAppDropdownOpen = false;
    let installAppDropdownInteracting = false;
    let installAppInputContainer: HTMLDivElement;
    let installAppDropdownPosition = { top: 0, left: 0, width: 0 };

    // App options loaded from API
    let availableApps: AppOption[] = [];
    let availableAppsLoading = false;

    // Computed: filtered apps for Install App modal
    $: installAppFilteredOptions = availableApps.filter((app) =>
        app.name.toLowerCase().includes(installAppSearch.toLowerCase()) ||
        app.packageName.toLowerCase().includes(installAppSearch.toLowerCase())
    );

    // Load apps from API (filter by format when installing to selected devices: Linux → deb, Windows → exe, Android → apk, others → deb)
    async function loadAvailableApps() {
        availableAppsLoading = true;
        try {
            const formats = new Set<string>();
            for (const row of selectedRows) {
                getAppFormatsForDeviceType(row.deviceType).forEach((f) => formats.add(f));
            }
            const formatParam = formats.size > 0 ? `&format=${[...formats].join(',')}` : '';
            const res = await fetch(`/api/user/resources/apps?pageSize=100${formatParam}`);
            if (!res.ok) throw new Error('Failed to load apps');

            const data = await res.json();
            availableApps = (data.items || []).map((item: any) => ({
                id: item.id,
                name: item.name || 'Unknown App',
                packageName: item.packageName || '-'
            }));
        } catch (error) {
            console.error('Failed to load apps:', error);
            availableApps = [];
        } finally {
            availableAppsLoading = false;
        }
    }

    function openInstallAppModal() {
        installAppSearch = "";
        installAppSelected = [];
        installAppDropdownOpen = false;
        installAppDropdownInteracting = false;
        showInstallAppModal = true;
        loadAvailableApps();
    }

    // Update dropdown position
    function updateInstallAppDropdownPosition() {
        if (installAppInputContainer) {
            const rect = installAppInputContainer.getBoundingClientRect();
            installAppDropdownPosition = {
                top: rect.bottom + 4, // 4px = var(--ds-space-1) margin
                left: rect.left,
                width: rect.width
            };
        }
    }

    async function handleInstallAppFocus(e: CustomEvent<FocusEvent>) {
        installAppDropdownOpen = true;
        // Wait for DOM to render then compute position
        await tick();
        updateInstallAppDropdownPosition();
    }

    function handleInstallAppBlur(e: CustomEvent<FocusEvent>) {
        setTimeout(() => {
            if (!installAppDropdownInteracting) {
                installAppDropdownOpen = false;
            }
        }, 150);
    }

    function toggleInstallApp(appId: string) {
        if (installAppSelected.includes(appId)) {
            installAppSelected = installAppSelected.filter(id => id !== appId);
        } else {
            installAppSelected = [...installAppSelected, appId];
        }
        installAppDropdownInteracting = false;
    }

    function removeInstallApp(appId: string) {
        installAppSelected = installAppSelected.filter(id => id !== appId);
    }

    async function confirmInstallApp() {
        if (installAppSelected.length === 0 || selectedRows.length === 0) return;
        installAppLoading = true;

        try {
            // Get selected apps' package names
            const selectedApps = availableApps.filter(app => installAppSelected.includes(app.id));

            // Install apps on each selected device
            const results = await Promise.allSettled(
                selectedRows.flatMap(device =>
                    selectedApps.map(app =>
                        fetch(`/api/devices/${device.id}/actions`, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({
                                action: 'installApp',
                                packageName: app.packageName,
                                resourceId: app.id
                            })
                        })
                    )
                )
            );

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failCount = results.filter(r => r.status === 'rejected').length;

            showInstallAppModal = false;
            selectedRows = [];

            if (failCount === 0) {
                toast.success('Install app command sent to device');
            } else if (successCount > 0) {
                toast.success( `App installation initiated on ${successCount} device(s). ${failCount} failed.`);
            } else {
                toast.error( 'Failed to install app on all devices.');
            }

            await invalidate('app:userDevices');
        } catch (e) {
            toast.error( 'Unable to install New App. Please try again!');
            console.error('Failed to install app:', e);
        } finally {
            installAppLoading = false;
        }
    }

    // Update Firmware Modal state (single select with radio buttons)
    interface FirmwareOption {
        id: string;
        name: string;
        packageName: string;
        version: string;
        size: string;
        createdOn: string;
    }

    let showUpdateFirmwareModal = false;
    let updateFirmwareSearch = "";
    let updateFirmwareSelected: string | null = null;
    let updateFirmwareLoading = false;
    let updateFirmwarePage = 1;
    const updateFirmwarePerPage = 10;

    // Firmware options loaded from API
    let availableFirmwares: FirmwareOption[] = [];
    let availableFirmwaresLoading = false;

    // Computed: filtered firmwares for Update Firmware modal
    $: updateFirmwareFilteredOptions = availableFirmwares.filter((fw) =>
        fw.name.toLowerCase().includes(updateFirmwareSearch.toLowerCase()) ||
        fw.packageName.toLowerCase().includes(updateFirmwareSearch.toLowerCase())
    );

    // Load firmware from API
    async function loadAvailableFirmwares() {
        availableFirmwaresLoading = true;
        try {
            const res = await fetch('/api/user/resources/firmware?pageSize=100');
            if (!res.ok) throw new Error('Failed to load firmware');

            const data = await res.json();
            availableFirmwares = (data.items || []).map((item: any) => ({
                id: item.id,
                name: item.name || 'Unknown Firmware',
                packageName: item.packageName || '-',
                version: item.version || '-',
                size: formatFileSizeForListing(item.size),
                createdOn: formatDateForListing(item.createdAt)
            }));
        } catch (error) {
            console.error('Failed to load firmware:', error);
            availableFirmwares = [];
        } finally {
            availableFirmwaresLoading = false;
        }
    }

    // Helper: Format file size
    function formatFileSizeForListing(bytes: number | null): string {
        if (bytes === null || bytes === undefined) return 'N/A';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    // Helper: Format date
    function formatDateForListing(dateString: string): string {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        const month = d.toLocaleString('en-US', { month: 'short' });
        const day = d.getDate().toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${month} ${day}, ${year} ${hour12}:${minutes} ${ampm}`;
    }

    // Computed: paginated firmwares
    $: updateFirmwareTotalPages = Math.ceil(updateFirmwareFilteredOptions.length / updateFirmwarePerPage);
    $: updateFirmwarePaginatedOptions = updateFirmwareFilteredOptions.slice(
        (updateFirmwarePage - 1) * updateFirmwarePerPage,
        updateFirmwarePage * updateFirmwarePerPage
    );

    function openUpdateFirmwareModal() {
        updateFirmwareSearch = "";
        updateFirmwareSelected = null;
        updateFirmwarePage = 1;
        showUpdateFirmwareModal = true;
        loadAvailableFirmwares();
    }

    function selectFirmware(firmwareId: string) {
        updateFirmwareSelected = firmwareId;
    }

    async function confirmUpdateFirmware() {
        if (!updateFirmwareSelected || selectedRows.length === 0) return;
        updateFirmwareLoading = true;

        try {
            // Push firmware to each selected device
            const results = await Promise.allSettled(
                selectedRows.map(device =>
                    fetch(`/api/devices/${device.id}/actions`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            action: 'pushFile',
                            resourceId: updateFirmwareSelected,
                            destinationPath: '/tmp/firmware_update'
                        })
                    })
                )
            );

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failCount = results.filter(r => r.status === 'rejected').length;

            showUpdateFirmwareModal = false;
            selectedRows = [];

            if (failCount === 0) {
                toast.success('Firmware update command sent to device');
            } else if (successCount > 0) {
                toast.success( `Firmware update initiated on ${successCount} device(s). ${failCount} failed.`);
            } else {
                toast.error( 'Failed to update firmware on all devices.');
            }

            await invalidate('app:userDevices');
        } catch (e) {
            toast.error( 'Unable to update Firmware. Please try again!');
            console.error('Failed to update firmware:', e);
        } finally {
            updateFirmwareLoading = false;
        }
    }

    function toggleAssignTag(tagId: string) {
        if (assignTagSelected.includes(tagId)) {
            assignTagSelected = assignTagSelected.filter(id => id !== tagId);
        } else {
            assignTagSelected = [...assignTagSelected, tagId];
        }
        assignTagDropdownInteracting = false;
    }

    function removeAssignTag(tagId: string) {
        assignTagSelected = assignTagSelected.filter(id => id !== tagId);
    }

    async function confirmAssignTag() {
        if (assignTagSelected.length === 0 || selectedRows.length === 0) return;
        assignTagLoading = true;
        try {
            // Assign tags to all selected devices
            for (const device of selectedRows) {
                const fd = new FormData();
                fd.set('id', device.id);
                fd.set('tagIds', JSON.stringify(assignTagSelected));
                const res = await fetch('?/assignTags', { method: 'POST', body: fd });
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload?.error || res.statusText);
                }
            }
            showAssignTagModal = false;
            selectedRows = [];
            toast.success( 'Tag assigned successfully!');
            await invalidate('app:userDevices');
        } catch (e) {
            toast.error( 'Unable to assign Tag. Please try again!');
            console.error('Failed to assign tags:', e);
        } finally {
            assignTagLoading = false;
        }
    }

    function handleBulkAction(e: CustomEvent<any>) {
        const actionId = e.detail?.id as string;
        if (actionId === 'deactivate' || actionId === 'reboot') {
            bulkConfirmAction = actionId;
            bulkError = null;
            showBulkConfirmModal = true;
        } else if (actionId === 'assign-tag') {
            openAssignTagModal();
        } else if (actionId === 'assign-deployment') {
            openAssignDeploymentModal();
        } else if (actionId === 'install-app') {
            openInstallAppModal();
        } else if (actionId === 'update') {
            openUpdateFirmwareModal();
        }
    }

    async function confirmBulkAction() {
        if (!bulkConfirmAction) return;
        bulkWorking = true;
        bulkError = null;
        const actionType = bulkConfirmAction;
        try {
            for (const row of selectedRows) {
                if (actionType === 'deactivate') {
                    const nextStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                    const fd = new FormData();
                    fd.set('id', row.id);
                    fd.set('status', nextStatus);
                    const res = await fetch('?/toggleStatus', { method: 'POST', body: fd });
                    if (!res.ok) {
                        const payload = await res.json().catch(() => ({}));
                        throw new Error(payload?.error || res.statusText);
                    }
                } else if (actionType === 'reboot') {
                    const res = await fetch(`/api/devices/${row.id}/actions`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ action: 'reboot' })
                    });
                    if (!res.ok) {
                        const payload = await res.json().catch(() => ({}));
                        throw new Error(payload?.error || res.statusText);
                    }
                }
            }
            selectedRows = [];
            showBulkConfirmModal = false;
            await invalidate('app:userDevices');

            // Show success toast based on action type
            if (actionType === 'reboot') {
                toast.success( 'Device rebooted successfully!');
            } else if (actionType === 'deactivate') {
                toast.success( 'Device deactivated successfully!');
            }
        } catch (e) {
            bulkError = e instanceof Error ? e.message : String(e);

            // Show error toast based on action type
            if (actionType === 'reboot') {
                toast.error( 'Unable to reboot Device. Please try again!');
            } else if (actionType === 'deactivate') {
                toast.error( 'Unable to deactivate Device. Please try again!');
            }
        } finally {
            bulkWorking = false;
        }
    }

    // Handle search with debounce (skip first run on mount; only reload when search actually differs from URL)
    let searchTimeout: ReturnType<typeof setTimeout>;
    let searchDebounceHasRunOnce = false;
    $: {
        if (searchValue !== undefined) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (!searchDebounceHasRunOnce) {
                    searchDebounceHasRunOnce = true;
                    return;
                }
                // Only reload if user changed search from current URL (avoids extra load when URL and input are already in sync)
                const urlSearch = typeof window !== 'undefined' ? (new URL(window.location.href).searchParams.get('search') || '') : '';
                if (searchValue === urlSearch) return;
                pagination.page = 1;
                reloadData();
            }, 500);
        }
    }
</script>

<!-- Main wrap: padding 24px, gap 16px -->
<div class="flex flex-col items-start" style="padding: 24px; gap: 16px;">
    <!-- Search & filter wrap: gap 16px, height 48px -->
    <div class="flex flex-row items-center" style="gap: 16px; height: 48px; width: 100%;">
        <!-- Input Field: width 500px, height 48px -->
        <div style="width: 500px; height: 48px;">
            <InputField
                type="search"
                placeholder="Search by Device name, Tag, OS version, MAC Address"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>

        <!-- Spacer: flex-grow: 1 -->
        <div style="flex: 1;"></div>

        <!-- Filter Button: 44x44px, using design tokens with badge -->
        <div style="position: relative;">
            <Button
                variant="outline"
                color="gray"
                size="lg"
                iconOnly={true}
                icon={Filter}
                iconPosition="only"
                on:click={openFilter}
            />
            {#if activeFilterCount > 0}
                <div style="
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    min-width: 20px;
                    height: 20px;
                    background: #D92D20;
                    color: white;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: var(--ds-font-family-primary);
                    font-size: 12px;
                    font-weight: 600;
                    padding: 0 6px;
                    border: 2px solid white;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                ">
                    {activeFilterCount}
                </div>
            {/if}
        </div>

        <!-- Add Device Button: 156px width, height 44px, background var(--ds-color-blue-light-600) -->
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={openAddDeviceModal}
            style="width: 156px; height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Plus size={20} slot="icon-left" />
            Add Device
        </Button>
    </div>

    <!-- Bulk actions bar - under search bar, above table -->
    {#if selectedRows.length > 0}
        <div
            class="w-full flex justify-center z-10"
            style="margin-bottom: 8px;"
        >
            <BulkActionsBar
                selectedCount={selectedRows.length}
                totalCount={pagination.total}
                actions={[...bulkActions]}
                on:action={handleBulkAction}
                on:clearSelection={() => (selectedRows = [])}
            />
        </div>
    {/if}

    <!-- Device Table -->
    <DeviceTable
        data={displayData}
        {pagination}
        {sort}
        {loading}
        detailHref={(row) => `/user/iot/devices/${row.id}`}
        bind:selectedRows
        on:sort={handleSort}
        on:pageChange={handlePageChange}
        on:filter={handleFilter}
        on:selectionChange={handleSelectionChange}
        on:view={handleView}
        on:edit={handleEdit}
        on:toggleStatus={handleToggleStatus}
        on:reboot={handleReboot}
        on:delete={handleDelete}
    />
</div>

<!-- Add Device Modal (Figma) -->
<Modal
    open={showAddDeviceModal}
    title="Add Device"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showAddDeviceModal = false)}
>
    <!-- PIN Code Input -->
    <div class="w-full">
        <InputField
            id="device-pin-input"
            type="text"
            label="Device PIN Code"
            placeholder="000 000"
            bind:value={claimPin}
            maxlength={6}
            required={true}
            state={claimError ? 'error' : 'default'}
            helperText={claimError || undefined}
            align="center"
        />
    </div>

    <!-- Help Info Frame - Frame 34 from Figma (info frame, not Alert component) -->
    <div class="add-device-help-frame">
        <div class="add-device-help-header">
            <Info size={20} class="add-device-help-icon" />
            <span class="add-device-help-title">Need help finding your device PIN?</span>
        </div>
        <ul class="add-device-help-list">
            <li>The PIN is a 6-digit code displayed on your device or terminal during setup</li>
            <li>For camera devices, the PIN may appear on the device's screen</li>
            <li>If you can't find the PIN, try resetting the device</li>
        </ul>
    </div>

    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            on:click={() => (showAddDeviceModal = false)}
            style="height: 44px;"
            disabled={claimLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmClaimDevice}
            disabled={claimLoading || claimPin.length < 6}
            loading={claimLoading}
        >
            Claim Device
        </Button>
    </div>
</Modal>

<!-- Filter Modal (Figma) -->
<Modal
    open={showFilterModal}
    title="Filter"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.05)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showFilterModal = false)}
>
    <!-- Match screenshot: 4 stacked dropdown selects -->
    <div class="w-full" style="max-height: 60vh; overflow-y: auto; overflow-x: hidden;">
        <div class="flex flex-col items-start" style="gap: var(--ds-space-4); width: 100%; padding-right: 8px;">
            <div style="width: 100%; max-width: 518px;">
                <Dropdown
                    label="Device Status"
                    placeholder="Select"
                    multiple={true}
                    maxHeight={200}
                    options={deviceStatusOptions}
                    value={filterStatuses}
                    on:change={handleDeviceStatusChange}
                />
            </div>

            <div style="width: 100%; max-width: 518px;">
                <Dropdown
                    label="Connection Status"
                    placeholder="Select"
                    multiple={true}
                    maxHeight={200}
                    options={connectionStatusOptions}
                    value={filterConnection}
                    on:change={handleConnectionStatusChange}
                />
            </div>

            <div style="width: 100%; max-width: 518px;">
                <Dropdown
                    label="OS Version"
                    placeholder="Select"
                    multiple={true}
                    maxHeight={200}
                    options={osVersionOptions}
                    value={filterOsVersions}
                    on:change={handleOsVersionChange}
                />
            </div>

            <div style="width: 100%; max-width: 518px;">
                <Dropdown
                    label="Tag"
                    placeholder="Select"
                    multiple={true}
                    searchable={true}
                    maxHeight={200}
                    options={tagOptions}
                    value={filterTagIds}
                    on:change={handleTagChange}
                />
            </div>
        </div>
    </div>

    <!-- Footer: Clear All + Apply -->
    <div slot="footer" class="flex items-center justify-end" style="gap: var(--ds-space-4); width: 100%;">
        <Button
            variant="text"
            color="primary"
            size="lg"
            on:click={clearFilterModal}
        >
            Clear All
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={applyFilterModal}
        >
            Apply
        </Button>
    </div>
</Modal>

<!-- Bulk confirm modal -->
<Modal
    open={showBulkConfirmModal}
    title={bulkConfirmAction === 'reboot' ? 'Reboot devices' : 'Deactivate devices'}
    type="error"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    showFooter={true}
    on:close={() => (showBulkConfirmModal = false)}
>
    <div style="font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); color: var(--ds-text-primary);">
        {#if bulkConfirmAction === 'reboot'}
            This will reboot {selectedRows.length} device(s). Continue?
        {:else}
            This will deactivate {selectedRows.length} device(s). Continue?
        {/if}
        {#if bulkError}
            <div style="margin-top: var(--ds-space-2); font-size: var(--ds-text-sm); color: var(--ds-color-error-600);">{bulkError}</div>
        {/if}
    </div>

    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button variant="outline" color="gray" size="lg" style="height: 44px;" on:click={() => (showBulkConfirmModal = false)} disabled={bulkWorking}>
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmBulkAction}
            disabled={bulkWorking}
            loading={bulkWorking}
        >
            Confirm
        </Button>
    </div>
</Modal>

<!-- Deactivate/Reactivate Device Confirmation Modal -->
<Modal
    open={showDeactivateModal}
    title={pendingActionDevice?.status === 'ACTIVE' ? 'Deactivate Device' : 'Reactivate Device'}
    type={pendingActionDevice?.status === 'ACTIVE' ? 'error' : 'info'}
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    showFooter={true}
    on:close={cancelDeactivateModal}
>
    <p style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-md); line-height: var(--ds-leading-md); color: var(--ds-text-primary); margin: 0;">
        Are you sure you want to {pendingActionDevice?.status === 'ACTIVE' ? 'deactivate' : 'reactivate'} this device?
    </p>

    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px;"
            on:click={cancelDeactivateModal}
            disabled={actionLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmToggleStatus}
            disabled={actionLoading}
            loading={actionLoading}
        >
            {pendingActionDevice?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
        </Button>
    </div>
</Modal>

<!-- Delete Device Confirmation Modal -->
<ConfirmModal
    open={showDeleteModal}
    title="Delete Device"
    description="Are you sure you want to delete this device? This action can not be reverse."
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={actionLoading}
    confirmDisabled={actionLoading}
    on:close={cancelDeleteModal}
    on:confirm={confirmDelete}
/>

<!-- Edit Device Modal (Shared Component) -->
<EditDeviceModal
    bind:open={showEditDeviceModal}
    device={editDevice}
    availableTags={availableTags}
    availableProfiles={availableProfiles}
    saveActionUrl="?/updateDevice"
    onSaveSuccess={handleEditDeviceSave}
    onSaveError={handleEditDeviceError}
    on:close={handleEditDeviceClose}
    on:save={async () => {
        await invalidate('app:userDevices');
    }}
/>

<!-- Assign Tag Modal (Figma) -->
<Modal
    open={showAssignTagModal}
    title="Assign Tag"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showAssignTagModal = false)}
>
    <!-- Search Input with Dropdown - uses InputField from design-system -->
    <!-- Container needs position relative and overflow visible so dropdown is not clipped -->
    <div
        class="w-full assign-tag-input-container"
        style="margin-bottom: var(--ds-space-4);"
        bind:this={assignTagInputContainer}
    >
        <InputField
            type="text"
            placeholder="Search and select tag"
            bind:value={assignTagSearch}
            state={assignTagDropdownOpen ? 'focused' : 'default'}
            on:focus={handleAssignTagFocus}
            on:blur={handleAssignTagBlur}
        >
            <svelte:fragment slot="suffix-icon">
                <Search size={22} />
            </svelte:fragment>
        </InputField>

        <!-- Tag Options Dropdown (only show when focused) - uses Checkbox from design-system -->
        <!-- position: fixed so it is not clipped by modal-body overflow -->
        {#if assignTagDropdownOpen}
            <div
                role="listbox"
                tabindex="-1"
                class="assign-tag-dropdown"
                style="top: {assignTagDropdownPosition.top}px; left: {assignTagDropdownPosition.left}px; width: {assignTagDropdownPosition.width}px;"
                on:mouseenter={() => assignTagDropdownInteracting = true}
                on:mouseleave={() => assignTagDropdownInteracting = false}
            >
                {#each assignTagFilteredOptions as tag (tag.id)}
                    <button
                        type="button"
                        class="assign-tag-option"
                        on:mousedown|preventDefault={() => toggleAssignTag(tag.id)}
                    >
                        <span class="assign-tag-checkbox-visual" style="pointer-events: none;">
                            <Checkbox
                                checked={assignTagSelected.includes(tag.id)}
                                size="sm"
                            />
                        </span>
                        <span class="assign-tag-option-label">{tag.name}</span>
                    </button>
                {/each}
                {#if assignTagFilteredOptions.length === 0}
                    <div class="assign-tag-empty">
                        No tags found
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Selected Tags - uses Tag component from design-system -->
    <div class="w-full">
        <p class="assign-tag-selected-label">
            Selected ({assignTagSelected.length} items)
        </p>
        <div class="assign-tag-selected-container">
            {#each assignTagSelected as tagId}
                {@const tag = availableTags.find(t => t.id === tagId)}
                {#if tag}
                    <Tag
                        label={tag.name}
                        size="md"
                        showClose={true}
                        on:remove={() => removeAssignTag(tagId)}
                    />
                {/if}
            {/each}
            {#if assignTagSelected.length === 0}
                <span class="assign-tag-empty-state">No tags selected</span>
            {/if}
        </div>
    </div>

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px; min-width: 100px;"
            on:click={() => (showAssignTagModal = false)}
            disabled={assignTagLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmAssignTag}
            disabled={assignTagLoading || assignTagSelected.length === 0}
            style="height: 44px; min-width: 100px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {assignTagLoading ? 'Assigning…' : 'Assign'}
        </Button>
    </div>
</Modal>

<!-- Assign Deployment Modal: select a draft bundle and add selected devices to it -->
<Modal
    open={showAssignDeploymentModal}
    title="Assign to deployment"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showAssignDeploymentModal = false)}
>
    <p style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085; margin: 0 0 12px 0;">
        Add {selectedRows.length} selected device(s) to a draft deployment. Select one deployment below.
    </p>

    <div class="w-full" style="margin-bottom: var(--ds-space-4);">
        <InputField
            type="text"
            placeholder="Search deployments by name..."
            bind:value={assignDeploymentSearch}
            on:input={onAssignDeploymentSearchInput}
        >
            <svelte:fragment slot="suffix-icon">
                <Search size={22} />
            </svelte:fragment>
        </InputField>
    </div>

    <!-- Draft bundles list (single select) -->
    <div class="w-full" style="max-height: 280px; overflow-y: auto; border: 1px solid #EAECF0; border-radius: 8px;">
        {#if assignDeploymentBundlesLoading}
            <div style="padding: 24px; text-align: center; color: #667085;">Loading draft deployments…</div>
        {:else if availableDraftBundles.length === 0}
            <div style="padding: 24px; text-align: center; color: #667085;">
                {assignDeploymentSearch ? 'No draft deployments match your search.' : 'No draft deployments. Create one from Deployments first.'}
            </div>
        {:else}
            {#each availableDraftBundles as bundle (bundle.id)}
                {@const selected = isDeploymentBundleSelected(bundle.id)}
                <button
                    type="button"
                    class="assign-deployment-option"
                    style="
                        width: 100%;
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        padding: 12px 16px;
                        border: none;
                        border-bottom: 1px solid #EAECF0;
                        background: {selected ? 'rgba(0, 78, 235, 0.06)' : 'transparent'};
                        cursor: pointer;
                        text-align: left;
                        font-family: var(--ds-font-family-primary);
                    "
                    on:click={() => selectAssignDeploymentBundle(bundle.id)}
                >
                    <div style="flex-shrink: 0; margin-top: 2px;">
                        <Checkbox
                            checked={selected}
                            size="sm"
                            disabled={false}
                        />
                    </div>
                    <div class="assign-deployment-option-content" style="flex: 1; min-width: 0;">
                        <span style="font-size: 14px; font-weight: 500; color: #292929;">{bundle.name}</span>
                    </div>
                </button>
            {/each}
        {/if}
    </div>

    {#if assignDeploymentSelectedBundleId}
        {@const sel = availableDraftBundles.find(b => b.id === assignDeploymentSelectedBundleId)}
        {#if sel}
            <p style="font-family: var(--ds-font-family-primary); font-size: 13px; color: #667085; margin: 12px 0 0 0;">
                Selected: <strong style="color: #292929;">{sel.name}</strong> — {selectedRows.length} device(s) will be added.
            </p>
        {/if}
    {/if}

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px; min-width: 100px;"
            on:click={() => (showAssignDeploymentModal = false)}
            disabled={assignDeploymentLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmAssignDeployment}
            disabled={assignDeploymentLoading || !assignDeploymentSelectedBundleId || selectedRows.length === 0}
            style="height: 44px; min-width: 120px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {assignDeploymentLoading ? 'Adding…' : 'Add to deployment'}
        </Button>
    </div>
</Modal>

<!-- Install New App Modal (Figma) -->
<Modal
    open={showInstallAppModal}
    title="Install New App"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showInstallAppModal = false)}
>
    <!-- Search Input with Dropdown - uses InputField from design-system -->
    <!-- Container needs position relative and overflow visible so dropdown is not clipped -->
    <div
        class="w-full install-app-input-container"
        style="margin-bottom: var(--ds-space-4);"
        bind:this={installAppInputContainer}
    >
        <InputField
            type="text"
            placeholder="Search and select app"
            bind:value={installAppSearch}
            state={installAppDropdownOpen ? 'focused' : 'default'}
            on:focus={handleInstallAppFocus}
            on:blur={handleInstallAppBlur}
        >
            <svelte:fragment slot="suffix-icon">
                <Search size={22} />
            </svelte:fragment>
        </InputField>

        <!-- App Options Dropdown (only show when focused) - uses Checkbox from design-system -->
        <!-- position: fixed so it is not clipped by modal-body overflow -->
        {#if installAppDropdownOpen}
            <div
                role="listbox"
                tabindex="-1"
                class="install-app-dropdown"
                style="top: {installAppDropdownPosition.top}px; left: {installAppDropdownPosition.left}px; width: {installAppDropdownPosition.width}px;"
                on:mouseenter={() => installAppDropdownInteracting = true}
                on:mouseleave={() => installAppDropdownInteracting = false}
            >
                {#each installAppFilteredOptions as app (app.id)}
                    {@const isSelected = installAppSelected.includes(app.id)}
                    <button
                        type="button"
                        class="install-app-option"
                        on:mousedown|preventDefault={() => toggleInstallApp(app.id)}
                    >
                        <Checkbox
                            checked={isSelected}
                            size="sm"
                            disabled={false}
                        />
                        <div class="install-app-option-content">
                            <span class="install-app-option-name">{app.name}</span>
                            <span class="install-app-option-package">{app.packageName}</span>
                        </div>
                    </button>
                {/each}
                {#if installAppFilteredOptions.length === 0}
                    <div class="install-app-empty">
                        No apps found
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Selected Apps - uses Tag component from design-system -->
    <div class="w-full">
        <p class="install-app-selected-label">
            Selected ({installAppSelected.length} items)
        </p>
        <div class="install-app-selected-container">
            {#each installAppSelected as appId}
                {@const app = availableApps.find(a => a.id === appId)}
                {#if app}
                    <div class="install-app-selected-item">
                        <div class="install-app-selected-content">
                            <span class="install-app-selected-name">{app.name}</span>
                            <span class="install-app-selected-package">{app.packageName}</span>
                        </div>
                        <Button
                            variant="text"
                            size="sm"
                            icon={X}
                            iconPosition="only"
                            iconSize={16}
                            on:click={() => removeInstallApp(appId)}
                            aria-label="Remove"
                        />
                    </div>
                {/if}
            {/each}
            {#if installAppSelected.length === 0}
                <span class="install-app-empty-state">No apps selected</span>
            {/if}
        </div>
    </div>

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px; min-width: 100px;"
            on:click={() => (showInstallAppModal = false)}
            disabled={installAppLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmInstallApp}
            disabled={installAppLoading || installAppSelected.length === 0}
            style="height: 44px; min-width: 100px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {installAppLoading ? 'Installing…' : 'Confirm'}
        </Button>
    </div>
</Modal>

<!-- Update Firmware Modal (Figma - 880px width) -->
<Modal
    open={showUpdateFirmwareModal}
    title="Update Firmware"
    size="lg"
    overlayBg="rgba(0, 78, 235, 0.05)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showUpdateFirmwareModal = false)}
>
    <!-- Search Input - uses InputField from design-system -->
    <div class="w-full" style="margin-bottom: var(--ds-space-4);">
        <InputField
            type="text"
            placeholder="Search and select firmware"
            bind:value={updateFirmwareSearch}
        >
            <svelte:fragment slot="suffix-icon">
                <Search size={22} />
            </svelte:fragment>
        </InputField>
    </div>

    <!-- Firmware List with Radio Buttons - uses Radio component from design-system -->
    <div class="w-full flex flex-col" style="gap: var(--ds-space-2);">
        {#each updateFirmwarePaginatedOptions as firmware (firmware.id)}
            {@const isSelected = updateFirmwareSelected === firmware.id}
            <button
                type="button"
                class="firmware-list-item"
                class:firmware-list-item-selected={isSelected}
                on:click={() => selectFirmware(firmware.id)}
            >
                <!-- Main Row: Radio + Name/Package + Version + Size -->
                <div class="firmware-list-item-row">
                    <!-- Radio Button - uses Radio component -->
                    <Radio
                        group={updateFirmwareSelected ?? ''}
                        value={firmware.id}
                        size="sm"
                        on:change={(e) => selectFirmware(e.detail)}
                    />

                    <!-- Name + Package Name (flex: 1) -->
                    <div class="firmware-list-item-content">
                        <span class="firmware-list-item-name">{firmware.name}</span>
                        <span class="firmware-list-item-package">{firmware.packageName}</span>
                    </div>

                    <!-- Version Column (fixed width) -->
                    <div class="firmware-list-item-column">
                        <span class="firmware-list-item-label">Version</span>
                        <span class="firmware-list-item-value">{firmware.version}</span>
                    </div>

                    <!-- Size Column (fixed width) -->
                    <div class="firmware-list-item-column">
                        <span class="firmware-list-item-label">Size</span>
                        <span class="firmware-list-item-value">{firmware.size}</span>
                    </div>
                </div>

                <!-- Created On Row -->
                <div class="firmware-list-item-created">
                    <span class="firmware-list-item-created-text">Created On: {firmware.createdOn}</span>
                </div>
            </button>
        {/each}
        {#if updateFirmwarePaginatedOptions.length === 0}
            <div class="firmware-list-empty">
                No firmware found
            </div>
        {/if}
    </div>

    <!-- Pagination - uses Button component from design-system -->
    {#if updateFirmwareFilteredOptions.length > 0}
        <div class="firmware-pagination">
            <span class="firmware-pagination-info">
                {(updateFirmwarePage - 1) * updateFirmwarePerPage + 1} - {Math.min(updateFirmwarePage * updateFirmwarePerPage, updateFirmwareFilteredOptions.length)} of {updateFirmwareFilteredOptions.length}
            </span>
            <div class="firmware-pagination-controls">
                <!-- First Page -->
                <Button
                    variant="text"
                    size="sm"
                    icon={ChevronsLeft}
                    iconPosition="only"
                    iconSize={20}
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = 1}
                    aria-label="First page"
                />
                <!-- Previous Page -->
                <Button
                    variant="text"
                    size="sm"
                    icon={ChevronLeft}
                    iconPosition="only"
                    iconSize={20}
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = Math.max(1, updateFirmwarePage - 1)}
                    aria-label="Previous page"
                />
                <!-- Current Page -->
                <div class="firmware-pagination-current">
                    <span>{updateFirmwarePage}</span>
                </div>
                <!-- Next Page -->
                <Button
                    variant="text"
                    size="sm"
                    icon={ChevronRight}
                    iconPosition="only"
                    iconSize={20}
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = Math.min(updateFirmwareTotalPages, updateFirmwarePage + 1)}
                    aria-label="Next page"
                />
                <!-- Last Page -->
                <Button
                    variant="text"
                    size="sm"
                    icon={ChevronsRight}
                    iconPosition="only"
                    iconSize={20}
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = updateFirmwareTotalPages}
                    aria-label="Last page"
                />
            </div>
        </div>
    {/if}

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px; min-width: 100px; background: #FFFFFF; border: 1px solid #0BA5EC; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
            on:click={() => (showUpdateFirmwareModal = false)}
            disabled={updateFirmwareLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmUpdateFirmware}
            disabled={updateFirmwareLoading || !updateFirmwareSelected}
            style="height: 44px; min-width: 100px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {updateFirmwareLoading ? 'Updating…' : 'Confirm'}
        </Button>
    </div>
</Modal>

<style>
    /* Design System Typography Classes */
    .ds-text-body {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-gray-800);
    }

    .ds-text-body-sm {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
    }

    .ds-text-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-700);
    }

    .ds-text-label-md {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-gray-800);
    }

    .ds-text-supporting {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
    }

    .ds-text-error {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-error-500);
    }

    /* Design System Form Elements */
    .ds-input {
        box-sizing: border-box;
        padding: var(--ds-space-3-5) var(--ds-space-4);
        height: 52px;
        background: var(--ds-color-white);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-gray-800);
        outline: none;
    }

    .ds-input:focus {
        border-color: var(--ds-color-blue-light-600);
    }

    .ds-input-error {
        border-color: var(--ds-color-error-500);
    }

    /* Design System Info Box */
    .ds-info-box {
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-4);
        gap: var(--ds-space-2);
        background: var(--ds-color-gray-50);
        border-radius: var(--ds-radius-lg);
        width: 100%;
    }

    .ds-info-box-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-700);
    }

    .ds-info-box-list {
        margin: 0;
        padding-left: 28px;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }

    /* Design System Config Section */
    .ds-config-section {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--ds-space-4) 0;
        gap: var(--ds-space-4);
        border-bottom: 1px solid var(--ds-border-default);
    }

    .ds-config-section:last-child {
        border-bottom: none;
    }

    .ds-config-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
        margin: 0;
    }

    .ds-config-description {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
        margin: 0;
    }

    /* Design System Slider */
    .ds-slider {
        width: 100%;
        height: 8px;
        background: var(--ds-color-gray-200);
        border-radius: var(--ds-radius-full);
        appearance: none;
        -webkit-appearance: none;
    }

    .ds-slider-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-gray-800);
    }

    .ds-slider-unit {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
    }

    /* Design System Pagination Button */
    .ds-pagination-btn {
        width: 36px;
        height: 36px;
        background: none;
        border: none;
        border-radius: var(--ds-radius-lg);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .ds-pagination-btn:disabled {
        cursor: not-allowed;
    }

    /* Custom slider styles for Configuration tab */
    .config-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: var(--ds-color-white);
        border: 2px solid var(--ds-border-default);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: var(--ds-shadow-sm);
    }

    .config-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: var(--ds-color-white);
        border: 2px solid var(--ds-border-default);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: var(--ds-shadow-sm);
    }

    .config-slider::-webkit-slider-thumb:hover {
        border-color: var(--ds-color-gray-400);
    }

    .config-slider::-moz-range-thumb:hover {
        border-color: var(--ds-color-gray-400);
    }

    /* Assign Tag Modal - Dropdown styles - match Dropdown component from design-system */
    /* position: fixed so it is not clipped by modal-body overflow */
    .assign-tag-dropdown {
        position: fixed;
        /* top, left, width set from JS based on input container */
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        /* Height: enough for multiple items - match Dropdown component */
        max-height: 300px; /* Match Dropdown component default max-height */
        min-height: 200px; /* Min height for ~3-4 items */
        overflow-y: auto;
        overflow-x: hidden;
        /* Z-index above modal so it is not covered */
        z-index: 150; /* Above modal-backdrop (50) and modal-body (0) */
        /* Shadow - match Dropdown component from design-system */
        box-shadow: var(--ds-shadow-lg);
        /* Padding for options container - match Dropdown component */
        padding: var(--ds-space-1);
        display: flex;
        flex-direction: column;
        /* Keep dropdown from being clipped - use fixed positioning */
        margin-top: var(--ds-space-1); /* Small gap between input and dropdown */
    }

    /* Scrollbar styling - match Dropdown component */
    .assign-tag-dropdown::-webkit-scrollbar {
        width: 16px;
    }

    .assign-tag-dropdown::-webkit-scrollbar-track {
        background: var(--ds-bg-secondary);
    }

    .assign-tag-dropdown::-webkit-scrollbar-thumb {
        background: var(--ds-color-neutral-true-200);
        border-radius: var(--ds-radius-lg);
        border: 4px solid var(--ds-bg-secondary);
    }

    .assign-tag-option {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
        padding: var(--ds-space-2) var(--ds-space-4);
        border: none;
        background: transparent;
        border-radius: var(--ds-radius-md);
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s ease;
        /* Match Dropdown component option styling */
        min-height: 54px; /* Match Dropdown .dropdown-option min-height */
    }

    .assign-tag-option:hover {
        background: var(--ds-color-neutral-true-50);
    }

    .assign-tag-option-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
        flex: 1;
        min-width: 0;
    }

    .assign-tag-empty {
        padding: var(--ds-space-3) var(--ds-space-4);
        text-align: center;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
    }

    .assign-tag-selected-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-neutral-true-800);
        margin: 0 0 var(--ds-space-2) 0;
    }

    .assign-tag-selected-container {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
        min-height: 28px;
    }

    .assign-tag-empty-state {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
    }

    /* Assign Tag Modal - Input container so dropdown is not clipped */
    .assign-tag-input-container {
        position: relative;
        /* Ensure container does not clip dropdown */
        overflow: visible;
        /* Stacking context so dropdown can appear above other elements */
        z-index: 10;
    }

    /* Add Device Modal - Help Info Frame (Frame 34 from Figma) */
    /* This is a plain info frame, NOT the Alert component */
    .add-device-help-frame {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: var(--ds-space-3); /* 12px from Figma Frame 34 */
        gap: var(--ds-space-2); /* 8px from Figma Frame 34 */
        width: 100%;
        background: var(--ds-color-neutral-true-50); /* #FAFAFA from Figma */
        border-radius: var(--ds-radius-lg); /* 8px from Figma */
    }

    .add-device-help-header {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: var(--ds-space-2-5); /* 10px from Figma Frame 35 */
        width: 100%;
    }

    .add-device-help-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        color: var(--ds-color-neutral-true-600); /* #525252 from Figma Vector border */
        stroke-width: 2;
    }

    .add-device-help-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-semibold); /* 600 from Figma */
        font-size: var(--ds-text-sm); /* 14px from Figma */
        line-height: var(--ds-leading-sm); /* 20px from Figma */
        color: var(--ds-color-neutral-true-800); /* #292929 from Figma */
        flex: 1;
    }

    .add-device-help-list {
        margin: 0;
        padding-left: var(--ds-space-5); /* 20px from Figma */
        list-style: disc;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm); /* 14px from Figma */
        line-height: var(--ds-leading-sm); /* 20px from Figma */
        color: var(--ds-color-neutral-true-500); /* #737373 from Figma */
        width: 100%;
    }

    .add-device-help-list li {
        margin-bottom: var(--ds-space-1);
    }

    .add-device-help-list li:last-child {
        margin-bottom: 0;
    }

    /* Assign Deployment Modal - Dropdown styles - match Dropdown component from design-system */
    /* position: fixed so it is not clipped by modal-body overflow */
    .assign-deployment-dropdown {
        position: fixed;
        /* top, left, width set from JS based on input container */
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        /* Height: enough for multiple items - match Dropdown component */
        max-height: 300px; /* Match Dropdown component default max-height */
        min-height: 200px; /* Min height for ~3-4 items */
        overflow-y: auto;
        overflow-x: hidden;
        /* Z-index above modal so it is not covered */
        z-index: 150; /* Above modal-backdrop (50) and modal-body (0) */
        /* Shadow - match Dropdown component from design-system */
        box-shadow: var(--ds-shadow-lg);
        /* Padding for options container - match Dropdown component */
        padding: var(--ds-space-1);
        display: flex;
        flex-direction: column;
        /* Keep dropdown from being clipped - use fixed positioning */
        margin-top: var(--ds-space-1); /* Small gap between input and dropdown */
    }

    /* Scrollbar styling - match Dropdown component */
    .assign-deployment-dropdown::-webkit-scrollbar {
        width: 16px;
    }

    .assign-deployment-dropdown::-webkit-scrollbar-track {
        background: var(--ds-bg-secondary);
    }

    .assign-deployment-dropdown::-webkit-scrollbar-thumb {
        background: var(--ds-color-neutral-true-200);
        border-radius: var(--ds-radius-lg);
        border: 4px solid var(--ds-bg-secondary);
    }

    .assign-deployment-option {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
        padding: var(--ds-space-2) var(--ds-space-4);
        border: none;
        background: transparent;
        border-radius: var(--ds-radius-md);
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s ease;
        /* Match Dropdown component option styling */
        min-height: 54px; /* Match Dropdown .dropdown-option min-height */
    }

    .assign-deployment-option:hover {
        background: var(--ds-color-neutral-true-50);
    }

    .assign-deployment-option-content {
        display: flex;
        flex-direction: column;
        gap: 0;
        flex: 1;
        min-width: 0;
    }

    .assign-deployment-option-name {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
    }

    .assign-deployment-option-package {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    .assign-deployment-empty {
        padding: var(--ds-space-3) var(--ds-space-4);
        text-align: center;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
    }

    /* Assign Deployment Modal - Input container so dropdown is not clipped */
    .assign-deployment-input-container {
        position: relative;
        /* Ensure container does not clip dropdown */
        overflow: visible;
        /* Stacking context so dropdown can appear above other elements */
        z-index: 10;
    }

    /* Install App Modal - Dropdown styles - match Dropdown component from design-system */
    /* position: fixed so it is not clipped by modal-body overflow */
    .install-app-dropdown {
        position: fixed;
        /* top, left, width set from JS based on input container */
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        /* Height: enough for multiple items - match Dropdown component */
        max-height: 300px; /* Match Dropdown component default max-height */
        min-height: 200px; /* Min height for ~3-4 items */
        overflow-y: auto;
        overflow-x: hidden;
        /* Z-index above modal so it is not covered */
        z-index: 150; /* Above modal-backdrop (50) and modal-body (0) */
        /* Shadow - match Dropdown component from design-system */
        box-shadow: var(--ds-shadow-lg);
        /* Padding for options container - match Dropdown component */
        padding: var(--ds-space-1);
        display: flex;
        flex-direction: column;
        /* Keep dropdown from being clipped - use fixed positioning */
        margin-top: var(--ds-space-1); /* Small gap between input and dropdown */
    }

    /* Scrollbar styling - match Dropdown component */
    .install-app-dropdown::-webkit-scrollbar {
        width: 16px;
    }

    .install-app-dropdown::-webkit-scrollbar-track {
        background: var(--ds-bg-secondary);
    }

    .install-app-dropdown::-webkit-scrollbar-thumb {
        background: var(--ds-color-neutral-true-200);
        border-radius: var(--ds-radius-lg);
        border: 4px solid var(--ds-bg-secondary);
    }

    .install-app-option {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
        padding: var(--ds-space-2) var(--ds-space-4);
        border: none;
        background: transparent;
        border-radius: var(--ds-radius-md);
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s ease;
        /* Match Dropdown component option styling */
        min-height: 54px; /* Match Dropdown .dropdown-option min-height */
    }

    .install-app-option:hover {
        background: var(--ds-color-neutral-true-50);
    }

    .install-app-option-content {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .install-app-option-name {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
    }

    .install-app-option-package {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    .install-app-empty {
        padding: var(--ds-space-3) var(--ds-space-4);
        text-align: center;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
    }

    .install-app-selected-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-neutral-true-800);
        margin: 0 0 var(--ds-space-2) 0;
    }

    .install-app-selected-container {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .install-app-selected-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ds-space-3) 0;
        border-bottom: 1px solid var(--ds-border-default);
    }

    .install-app-selected-content {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .install-app-selected-name {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-color-neutral-true-800);
    }

    .install-app-selected-package {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    .install-app-empty-state {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
        padding: var(--ds-space-3) 0;
    }

    /* Install App Modal - Input container so dropdown is not clipped */
    .install-app-input-container {
        position: relative;
        /* Ensure container does not clip dropdown */
        overflow: visible;
        /* Stacking context so dropdown can appear above other elements */
        z-index: 10;
    }

    /* Update Firmware Modal - Firmware List styles */
    .firmware-list-item {
        width: 100%;
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-3) var(--ds-space-4);
        border: none;
        background: var(--ds-color-neutral-true-50);
        border-radius: var(--ds-radius-lg);
        cursor: pointer;
        text-align: left;
        gap: var(--ds-space-1);
        transition: opacity 0.15s ease, border-color 0.15s ease;
    }

    .firmware-list-item:hover {
        opacity: 0.9;
    }

    .firmware-list-item-selected {
        border: 2px solid var(--ds-color-blue-light-500);
        background: var(--ds-color-neutral-true-50);
    }

    .firmware-list-item-row {
        display: flex;
        align-items: flex-start;
        width: 100%;
        gap: var(--ds-space-3);
    }

    .firmware-list-item-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        gap: 2px;
    }

    .firmware-list-item-name {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        font-weight: var(--ds-font-medium);
        color: var(--ds-color-neutral-true-800);
    }

    .firmware-list-item-package {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
    }

    .firmware-list-item-column {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        width: 120px;
        padding-left: var(--ds-space-4);
    }

    .firmware-list-item-label {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
    }

    .firmware-list-item-value {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-900);
    }

    .firmware-list-item-created {
        display: flex;
        align-items: center;
        padding-left: 32px;
    }

    .firmware-list-item-created-text {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--ds-color-gray-500);
    }

    .firmware-list-empty {
        padding: var(--ds-space-8) var(--ds-space-4);
        text-align: center;
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
        background: var(--ds-color-neutral-true-50);
        border-radius: var(--ds-radius-md);
    }

    /* Update Firmware Modal - Pagination styles */
    .firmware-pagination {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        width: 100%;
        padding: var(--ds-space-2) 0;
        gap: var(--ds-space-2);
        border-top: 1px solid var(--ds-border-default);
        margin-top: var(--ds-space-4);
    }

    .firmware-pagination-info {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-600);
    }

    .firmware-pagination-controls {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .firmware-pagination-current {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
    }

    .firmware-pagination-current span {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
    }

    /* Edit Device Modal - Password toggle button */
    .password-toggle-button {
        position: absolute;
        right: var(--ds-space-3);
        top: 50%;
        transform: translateY(-50%);
        z-index: 1;
    }

    .password-toggle-button :global(button) {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        width: auto !important;
        height: auto !important;
        color: var(--ds-text-secondary) !important;
    }

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
        color: var(--ds-color-neutral-true-800);
        margin: 0;
    }

    .config-description {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-500);
        margin: 0;
    }

    /* Edit Device Modal - Slider input wrapper */
    .config-slider-input-wrapper {
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
        min-width: 70px;
    }

    .config-slider-input {
        width: 50px;
        padding: var(--ds-space-1-5) var(--ds-space-2);
        border: 1px solid var(--ds-color-neutral-true-300);
        border-radius: var(--ds-radius-md);
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        text-align: center;
        background: var(--ds-color-white);
        color: var(--ds-text-primary);
    }

    .config-slider-unit {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-500);
    }

    /* Edit Device Modal - Launcher preview */
    .config-launcher-preview {
        width: 64px;
        height: 64px;
        background: var(--ds-color-white);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
</style>
