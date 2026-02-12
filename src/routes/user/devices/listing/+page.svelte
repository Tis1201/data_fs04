<script lang="ts">
    import { tick, onMount } from "svelte";
    import { DeviceTable, Button, InputField, Modal, ConfirmModal, Checkbox, BulkActionsBar, Dropdown, Tag, Radio, TabGroup, DataTable, Badge } from "$lib/design-system/components";
    import { initializeDeviceRealtime, deviceRealtimeStore } from "$lib/stores/deviceRealtimeStore";
    import type { DeviceRow, DeviceTablePagination, DeviceTableSort } from "$lib/design-system/components/DeviceTable.svelte";
    import type { BadgeColor, ColumnDef, PaginationState, SortDirection } from "$lib/design-system/components";
    import { goto, invalidate } from "$app/navigation";
    import { page } from "$app/stores";
    import { Search, Filter, Plus, Tags, GitFork, Server, BookUp2, Eye, EyeOff, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Info, Trash2 } from "lucide-svelte";
    import { callUserRpc } from "$lib/client/mqtt/userRpc";
    import { waitForClaimConfirmation } from "$lib/client/mqtt/claimFlow";
    import type { PageData } from "./$types";
    import EditDeviceModal from "$lib/components/devices/EditDeviceModal.svelte";
    import SensorEditDeviceModal from "$lib/components/ui_components_sveltekit/radar/EditDeviceModal.svelte";
    import { toast } from "$lib/stores/alertToast";
    import { browser } from "$app/environment";
    import type { Sensor } from '@prisma/client';

    // Local SortState type for DataTable
    interface DataTableSortState {
        field: string | null;
        direction: SortDirection;
    }

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
        settings?: string;
    }

    type SensorRow = Sensor & { controller?: { id: string } | null };

    export let data: PageData;
    /** Route params from SvelteKit (avoids "unknown prop 'params'" warning) */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    export const params: Record<string, string> = {};

    // =========================
    // Tab State
    // =========================
    const TABS = [
        { id: 'remote-devices', label: 'Remote Devices' },
        { id: 'sensors', label: 'Sensors' }
    ];
    
    $: activeTab = data.activeTab || 'remote-devices';

    function handleTabChange(event: CustomEvent<string>) {
        const newTab = event.detail;
        const url = new URL($page.url);
        url.searchParams.set('tab', newTab);
        // Reset pagination and search when switching tabs
        url.searchParams.set('page', '1');
        url.searchParams.delete('search');
        url.searchParams.delete('statuses');
        url.searchParams.delete('locations');
        url.searchParams.delete('osVersions');
        url.searchParams.delete('connected');
        url.searchParams.delete('tags');
        goto(url.pathname + url.search, { noScroll: true });
    }

    // =========================
    // Remote Devices State
    // =========================
    let devices: DeviceRow[] = [];
    let selectedRows: DeviceRow[] = [];
    let loading = false;
    let searchValue = "";
    let activeFilters: Record<string, string[]> = {};

    // Modals for Remote Devices
    let showAddDeviceModal = false;
    let showFilterModal = false;
    let claimPin = "";
    let claimLoading = false;
    let claimError: string | null = null;

    let showDeactivateModal = false;
    let showDeleteModal = false;
    let pendingActionDevice: DeviceRow | null = null;
    let actionLoading = false;

    let showEditDeviceModal = false;
    let editDevice: DeviceRow | null = null;

    // Filter modal selections
    let filterOsVersions: string[] = ['__all__'];
    let filterConnection: Array<'Online' | 'Offline' | '__all__'> = ['__all__'];
    let filterStatuses: Array<'ACTIVE' | 'INACTIVE' | '__all__'> = ['__all__'];
    let filterTagIds: string[] = ['__all__'];

    const OS_OPTIONS = ["Android", "Linux", "Windows", "macOS"];

    function normalizeMultiSelect(next: string | string[], prev: string[]): string[] {
        const arr = Array.isArray(next) ? next : (next ? [next] : []);
        if (arr.includes('__all__') && !prev.includes('__all__')) return ['__all__'];
        if (!arr.includes('__all__') && prev.includes('__all__')) {
            if (arr.length === 0) return ['__all__'];
            return arr.filter(v => v !== '__all__');
        }
        if (arr.some(v => v !== '__all__')) return arr.filter(v => v !== '__all__');
        if (arr.length === 0) return ['__all__'];
        return arr;
    }

    function getActualFilterValues(values: string[]): string[] {
        if (values.includes('__all__') || values.length === 0) return [];
        return values;
    }

    $: availableTags = ((data as any)?.availableTags || []) as AvailableTag[];
    $: tagOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...availableTags.map((t) => ({ id: t.id, label: t.name, type: 'checkbox' as const }))
    ];

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
                deviceType: device.deviceType ?? deviceTypeFromInfo ?? 'Unknown',
                status: device.status || 'INACTIVE',
                connected: device.connected ?? false,
                connectedAt: device.connectedAt ? new Date(device.connectedAt) : undefined,
                disconnectedAt: device.disconnectedAt ? new Date(device.disconnectedAt) : undefined,
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
                lastSeenAt: device.lastUsedAt ? new Date(device.lastUsedAt) : (device.lastSeenAt ? new Date(device.lastSeenAt) : undefined),
                tags: (device.tags || []).map((tag: any) => ({
                    id: tag.id || tag.tagId,
                    name: tag.name || tag.tagName
                })),
                cpuUsage: deviceInfo?.cpu_usage ?? deviceInfo?.cpuUsage ?? device.deviceInformation?.cpu_usage ?? null,
                memUsage: deviceInfo?.ram_usage ?? deviceInfo?.memUsage ?? device.deviceInformation?.ram_usage ?? null,
                diskUsage: deviceInfo?.disk_usage ?? deviceInfo?.diskUsage ?? device.deviceInformation?.disk_usage ?? null
            };
        });
    }

    // Initialize from server data
    $: {
        if (data && activeTab === 'remote-devices') {
            devices = transformServerData(data);
            const serverMeta = data.meta as any;
            pagination = {
                page: serverMeta?.pagination?.page || serverMeta?.page || 1,
                perPage: serverMeta?.pagination?.per_page || serverMeta?.perPage || 10,
                total: serverMeta?.pagination?.total_records || serverMeta?.total || 0,
                totalPages: serverMeta?.pagination?.total_pages || serverMeta?.totalPages || 0
            };
        }
    }

    // Real-time device connection
    onMount(() => {
        if (browser) initializeDeviceRealtime();
    });
    
    $: displayData = (() => {
        const store = $deviceRealtimeStore;
        if (!store) return devices;
        return devices.map((row) => {
            const known = store.getDevice(row.id);
            const connected = known !== null ? store.isDeviceConnected(row.id) : row.connected;
            return { ...row, connected };
        });
    })();

    let pagination: DeviceTablePagination = {
        page: 1,
        perPage: 10,
        total: 0,
        totalPages: 0
    };

    let sort: DeviceTableSort = {
        field: "name",
        order: "asc"
    };

    $: activeFilterCount = Object.keys(activeFilters).length;

    // Reload data from server
    async function reloadData() {
        loading = true;
        try {
            const url = new URL($page.url);
            url.searchParams.set('page', String(pagination.page));
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

            ['types', 'statuses', 'osVersions', 'connected', 'tags', 'deviceType', 'usage'].forEach((k) => url.searchParams.delete(k));
            Object.entries(activeFilters).forEach(([key, values]) => {
                if (!values || values.length === 0) return;
                url.searchParams.set(key, values.join(','));
            });

            await invalidate('app:allDevices');
            await goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
        } catch (error) {
            console.error("Error reloading data:", error);
        } finally {
            loading = false;
        }
    }

    // Event handlers for Remote Devices
    function handleSort(event: CustomEvent<DeviceTableSort>) {
        sort = event.detail;
        pagination.page = 1;
        reloadData();
    }

    function handlePageChange(event: CustomEvent<number>) {
        pagination = { ...pagination, page: event.detail };
        reloadData();
    }

    function handleFilter(event: CustomEvent<Record<string, string[]>>) {
        activeFilters = event.detail;
        pagination.page = 1;
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
        invalidate('app:allDevices');
    }

    function handleEditDeviceError(error: string) {
        toast.error(`Unable to save device: ${error}`);
    }

    function handleEditDeviceClose() {
        showEditDeviceModal = false;
        editDevice = null;
    }

    function handleToggleStatus(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        pendingActionDevice = device;
        showDeactivateModal = true;
    }

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

            toast.success(`Device ${actionName} successfully!`);
            await invalidate('app:allDevices');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Unable to ${device.status === 'ACTIVE' ? 'deactivate' : 'reactivate'}. Please try again!`);
        } finally {
            actionLoading = false;
            showDeactivateModal = false;
            pendingActionDevice = null;
        }
    }

    function handleDelete(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        pendingActionDevice = device;
        showDeleteModal = true;
    }

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

            toast.success('Device deleted successfully!');
            await invalidate('app:allDevices');
        } catch (error) {
            toast.error('Unable to delete device. Please try again!');
        } finally {
            actionLoading = false;
            showDeleteModal = false;
            pendingActionDevice = null;
        }
    }

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
        const actualOsVersions = getActualFilterValues(filterOsVersions);
        const actualConnection = getActualFilterValues(filterConnection);
        const actualStatuses = getActualFilterValues(filterStatuses);
        const actualTags = getActualFilterValues(filterTagIds);

        if (actualOsVersions.length) next.osVersions = [...actualOsVersions];
        if (actualConnection.length) next.connected = actualConnection.map((v) => v);
        if (actualStatuses.length) next.statuses = actualStatuses.map((v) => v);
        if (actualTags.length) next.tags = [...actualTags];
        activeFilters = next;
        pagination.page = 1;
        showFilterModal = false;
        reloadData();
    }

    function clearFilterModal() {
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
            const response = await callUserRpc<{ flowId?: string; result: { factoryDeviceId: string } }>(
                'device.claim',
                { pin: claimPin },
                { timeoutMs: 5000 }
            );
            const flowId = response?.flowId;
            if (!flowId) throw new Error('Missing flowId in claim response');

            const confirmation = await waitForClaimConfirmation(flowId, { timeoutMs: 20000 });
            showAddDeviceModal = false;
            toast.success('Device added successfully!');
            await new Promise((r) => setTimeout(r, 1000));
            await goto(`/user/iot/devices/${confirmation.deviceId}`);
        } catch (e) {
            claimError = e instanceof Error ? e.message : String(e);
            toast.error('Unable to add device. Please try again!');
        } finally {
            claimLoading = false;
        }
    }

    // Bulk actions
    $: bulkActions = (() => {
        const allInactive = selectedRows.length > 0 && selectedRows.every(row => row.status === 'INACTIVE');
        const deactivateLabel = allInactive ? 'Reactivate' : 'Deactivate';

        return [
            { id: 'assign-tag', label: 'Assign Tag', icon: Tags },
            { id: 'assign-deployment', label: 'Assign Deployment', icon: GitFork },
            { id: 'install-app', label: 'Install App', icon: Server },
            { id: 'deactivate', label: deactivateLabel, destructive: true },
            { id: 'reboot', label: 'Reboot', destructive: true }
        ];
    })();

    function handleBulkAction(event: CustomEvent<{ id: string }>) {
        const actionId = event.detail.id;
        // TODO: Implement bulk actions
        toast.info(`Bulk action: ${actionId} - Coming soon`);
    }

    function handleClearSelection() {
        selectedRows = [];
    }

    // =========================
    // Sensors State
    // =========================
    $: sensorsData = data.sensorsData;
    $: radarSensors = sensorsData?.radarSensors || [];
    $: sensorsMeta = sensorsData?.meta || { totalItems: 0, itemsPerPage: 10, totalPages: 0, currentPage: 1 };
    $: availableLocations = sensorsData?.availableLocations || [];

    let sensorSearchValue = $page.url.searchParams.get('search') || '';
    let sensorSearchTimeout: ReturnType<typeof setTimeout>;

    // Delete sensor modal
    let sensorToDelete: SensorRow | null = null;
    let showSensorDeleteModal = false;
    let sensorDeleteLoading = false;

    function openSensorDeleteModal(row: SensorRow) {
        sensorToDelete = row;
        showSensorDeleteModal = true;
    }

    function closeSensorDeleteModal() {
        showSensorDeleteModal = false;
        sensorToDelete = null;
    }

    async function confirmDeleteSensor() {
        if (!sensorToDelete) return;
        sensorDeleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', sensorToDelete.id);
            const res = await fetch('?/deleteSensor', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Sensor deleted successfully!');
                closeSensorDeleteModal();
                await invalidate('app:allDevices');
                goto($page.url.pathname + $page.url.search, { noScroll: true });
            } else {
                toast.error(result.message || 'Unable to delete sensor. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to delete sensor. Please try again!');
        } finally {
            sensorDeleteLoading = false;
        }
    }

    // Sensor filter modal
    let showSensorFilterModal = false;
    const SENSOR_STATUS_OPTIONS = [
        { id: 'ACTIVE', label: 'Active' },
        { id: 'INACTIVE', label: 'Inactive' },
        { id: 'MAINTENANCE', label: 'Maintenance' }
    ] as const;
    let sensorFilterStatuses: string[] = $page.url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
    let sensorFilterLocations: string[] = $page.url.searchParams.get('locations')?.split(',').filter(Boolean) || [];

    $: sensorStatusDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...SENSOR_STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label, type: 'checkbox' as const }))
    ];
    $: sensorLocationDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...(availableLocations || []).map((loc: string) => ({ id: loc, label: loc, type: 'checkbox' as const }))
    ];

    function applySensorFilter() {
        const url = new URL($page.url);
        const statuses = sensorFilterStatuses.filter((s) => s !== '__all__');
        const locations = sensorFilterLocations.filter((l) => l !== '__all__');
        if (statuses.length) url.searchParams.set('statuses', statuses.join(','));
        else url.searchParams.delete('statuses');
        if (locations.length) url.searchParams.set('locations', locations.join(','));
        else url.searchParams.delete('locations');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
        showSensorFilterModal = false;
    }

    function clearSensorFilter() {
        sensorFilterStatuses = [];
        sensorFilterLocations = [];
        const url = new URL($page.url);
        url.searchParams.delete('statuses');
        url.searchParams.delete('locations');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
        showSensorFilterModal = false;
    }

    function openSensorFilterModal() {
        sensorFilterStatuses = $page.url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
        sensorFilterLocations = $page.url.searchParams.get('locations')?.split(',').filter(Boolean) || [];
        showSensorFilterModal = true;
    }

    // Add Sensor modal
    let showAddSensorModal = false;

    function openAddSensorModal() {
        // Redirect to the sensor creation page
        goto('/user/controllers/radar/new');
    }

    // Sensor search
    function handleSensorSearch() {
        clearTimeout(sensorSearchTimeout);
        sensorSearchTimeout = setTimeout(() => {
            const url = new URL($page.url);
            if (sensorSearchValue.trim()) {
                url.searchParams.set('search', sensorSearchValue.trim());
            } else {
                url.searchParams.delete('search');
            }
            url.searchParams.set('page', '1');
            goto(url.pathname + url.search, { noScroll: true });
        }, 300);
    }

    // Sensor table columns
    const sensorColumns: ColumnDef<SensorRow>[] = [
        {
            id: 'name',
            header: 'Sensor Name',
            accessor: 'name',
            sortable: true,
            width: '35%'
        },
        {
            id: 'location',
            header: 'Location',
            accessor: (row: SensorRow) => row.location || '-',
            width: '30%'
        },
        {
            id: 'status',
            header: 'Status',
            type: 'badge',
            accessor: (row: SensorRow) => {
                const status = row.status?.toUpperCase();
                if (status === 'ACTIVE') return 'Online';
                if (status === 'INACTIVE') return 'Offline';
                return status || 'Unknown';
            },
            sortable: true,
            width: '15%',
            statusColor: (_value: any, row: SensorRow): BadgeColor => {
                const status = row.status?.toUpperCase();
                if (status === 'ACTIVE') return 'success';
                if (status === 'INACTIVE') return 'gray';
                if (status === 'MAINTENANCE') return 'warning';
                return 'gray';
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            width: '10%',
            align: 'center',
            getMenuActions: (row: SensorRow) => [
                {
                    id: 'edit',
                    label: 'Edit',
                    onClick: () => openSensorEditModal(row)
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    destructive: true,
                    onClick: () => openSensorDeleteModal(row)
                }
            ]
        }
    ];

    // Sensor pagination
    let sensorPagination: PaginationState = {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0
    };

    $: if (sensorsData) {
        sensorPagination = {
            page: sensorsMeta.currentPage,
            pageSize: sensorsMeta.itemsPerPage,
            totalItems: sensorsMeta.totalItems,
            totalPages: sensorsMeta.totalPages
        };
    }

    let sensorSort: DataTableSortState = {
        field: 'createdAt',
        direction: 'desc'
    };

    function handleSensorSort(event: CustomEvent<DataTableSortState>) {
        sensorSort = event.detail;
        const url = new URL($page.url);
        if (sensorSort.field) {
            url.searchParams.set('sort_field', sensorSort.field);
        }
        url.searchParams.set('sort_order', sensorSort.direction || 'desc');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handleSensorPageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handleSensorRowClick(event: CustomEvent<{ row: SensorRow }>) {
        const sensor = event.detail.row;
        if (sensor.controller?.id) {
            goto(`/user/controllers/radar/${sensor.controller.id}`);
        }
    }

    // Edit Sensor Modal
    let showSensorEditModal = false;
    let editSensor: SensorRow | null = null;

    function openSensorEditModal(row: SensorRow) {
        editSensor = row;
        showSensorEditModal = true;
    }

    function closeSensorEditModal() {
        showSensorEditModal = false;
        editSensor = null;
    }

    async function handleSensorEditSave(payload: { name: string; location: string }) {
        if (!editSensor) return;
        try {
            const fd = new FormData();
            fd.set('sensorId', editSensor.id);
            fd.set('name', payload.name);
            fd.set('location', payload.location || '');
            const res = await fetch('?/updateSensor', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Sensor updated successfully!');
                closeSensorEditModal();
                await invalidate('app:allDevices');
            } else {
                toast.error(result.message || 'Unable to update sensor. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to update sensor. Please try again!');
        }
    }
</script>

<div class="all-devices-page">
    <!-- Search and Actions Bar -->
    <div class="toolbar">
        <div class="search-wrapper">
            {#if activeTab === 'remote-devices'}
                <InputField
                    placeholder="Search by Device name, Tag, OS version, MAC Address"
                    bind:value={searchValue}
                    on:input={() => reloadData()}
                    prefixIcon={true}
                >
                    <Search slot="prefix-icon" size={20} />
                </InputField>
            {:else}
                <InputField
                    placeholder="Search by Device name"
                    bind:value={sensorSearchValue}
                    on:input={() => handleSensorSearch()}
                    prefixIcon={true}
                >
                    <Search slot="prefix-icon" size={20} />
                </InputField>
            {/if}
        </div>
        <div class="actions-wrapper">
            <Button
                variant="outline"
                color="gray"
                size="lg"
                icon={Filter}
                iconPosition="only"
                on:click={() => activeTab === 'remote-devices' ? openFilter() : openSensorFilterModal()}
            />
            <Button
                variant="filled"
                color="primary"
                size="lg"
                icon={Plus}
                iconPosition="left"
                on:click={() => activeTab === 'remote-devices' ? openAddDeviceModal() : openAddSensorModal()}
            >
                {activeTab === 'remote-devices' ? 'Add Device' : 'Register Device'}
            </Button>
        </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-wrapper">
        <TabGroup
            tabs={TABS}
            activeTab={activeTab}
            type="underline"
            size="md"
            on:change={handleTabChange}
        />
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'remote-devices'}
        <!-- Remote Devices Table -->
        <div class="table-wrapper">
            <DeviceTable
                data={displayData}
                {pagination}
                {sort}
                {loading}
                selectable={true}
                bind:selectedRows
                on:sort={handleSort}
                on:pageChange={handlePageChange}
                on:filter={handleFilter}
                on:selectionChange={handleSelectionChange}
                on:view={handleView}
                on:edit={handleEdit}
                on:toggleStatus={handleToggleStatus}
                on:delete={handleDelete}
            />
        </div>

        <!-- Bulk Actions Bar -->
        {#if selectedRows.length > 0}
            <BulkActionsBar
                selectedCount={selectedRows.length}
                actions={bulkActions}
                on:action={handleBulkAction}
                on:clear={handleClearSelection}
            />
        {/if}
    {:else}
        <!-- Sensors Table -->
        <div class="table-wrapper">
            <DataTable
                data={radarSensors}
                columns={sensorColumns}
                pagination={sensorPagination}
                sort={sensorSort}
                loading={loading}
                emptyMessage="No sensors found"
                on:sort={handleSensorSort}
                on:pageChange={handleSensorPageChange}
                on:rowClick={handleSensorRowClick}
            />
        </div>
    {/if}
</div>

<!-- Remote Devices Modals -->

<!-- Add Device Modal -->
<Modal
    open={showAddDeviceModal}
    title="Add Device"
    size="sm"
    on:close={() => showAddDeviceModal = false}
>
    <div class="add-device-body">
        <div class="add-device-help-frame">
            <div class="add-device-help-header">
                <span class="add-device-help-icon"><Info size={20} /></span>
                <span class="add-device-help-title">How to find your PIN code</span>
            </div>
            <ul class="add-device-help-list">
                <li>Open the device agent app on your device</li>
                <li>The 6-digit PIN code will be displayed on the screen</li>
                <li>Enter the PIN code below to add the device</li>
            </ul>
        </div>
        <InputField
            label="PIN Code"
            placeholder="Enter 6-digit PIN"
            bind:value={claimPin}
            error={claimError || undefined}
            maxlength={6}
        />
    </div>
    <svelte:fragment slot="footer">
        <Button variant="outline" color="gray" size="lg" on:click={() => showAddDeviceModal = false}>
            Cancel
        </Button>
        <Button variant="filled" color="primary" size="lg" loading={claimLoading} on:click={confirmClaimDevice}>
            Add Device
        </Button>
    </svelte:fragment>
</Modal>

<!-- Filter Modal for Remote Devices -->
<Modal
    open={showFilterModal}
    title="Filter Devices"
    size="sm"
    on:close={() => showFilterModal = false}
>
    <div class="filter-body">
        <Dropdown
            label="Device Status"
            options={deviceStatusOptions}
            value={filterStatuses}
            multiple={true}
            on:change={handleDeviceStatusChange}
        />
        <Dropdown
            label="Connection Status"
            options={connectionStatusOptions}
            value={filterConnection}
            multiple={true}
            on:change={handleConnectionStatusChange}
        />
        <Dropdown
            label="Operating System"
            options={osVersionOptions}
            value={filterOsVersions}
            multiple={true}
            on:change={handleOsVersionChange}
        />
        <Dropdown
            label="Tags"
            options={tagOptions}
            value={filterTagIds}
            multiple={true}
            on:change={handleTagChange}
        />
    </div>
    <svelte:fragment slot="footer">
        <Button variant="text" color="gray" size="lg" on:click={clearFilterModal}>
            Clear All
        </Button>
        <Button variant="filled" color="primary" size="lg" on:click={applyFilterModal}>
            Apply Filter
        </Button>
    </svelte:fragment>
</Modal>

<!-- Deactivate/Reactivate Confirmation Modal -->
<ConfirmModal
    open={showDeactivateModal}
    title={pendingActionDevice?.status === 'ACTIVE' ? 'Deactivate Device' : 'Reactivate Device'}
    description={pendingActionDevice?.status === 'ACTIVE' 
        ? `Are you sure you want to deactivate "${pendingActionDevice?.name}"? The device will no longer be able to connect.`
        : `Are you sure you want to reactivate "${pendingActionDevice?.name}"? The device will be able to connect again.`}
    cancelText="Cancel"
    confirmText={pendingActionDevice?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
    type={pendingActionDevice?.status === 'ACTIVE' ? 'warning' : 'info'}
    confirmLoading={actionLoading}
    on:close={cancelDeactivateModal}
    on:confirm={confirmToggleStatus}
/>

<!-- Delete Device Confirmation Modal -->
<ConfirmModal
    open={showDeleteModal}
    title="Delete Device"
    description={`Are you sure you want to delete "${pendingActionDevice?.name}"? This action cannot be undone.`}
    cancelText="Cancel"
    confirmText="Delete"
    type="error"
    confirmLoading={actionLoading}
    on:close={cancelDeleteModal}
    on:confirm={confirmDelete}
/>

<!-- Edit Device Modal -->
{#if editDevice}
    <EditDeviceModal
        open={showEditDeviceModal}
        device={editDevice}
        availableProfiles={availableProfiles}
        on:save={handleEditDeviceSave}
        on:close={handleEditDeviceClose}
    />
{/if}

<!-- Sensors Modals -->

<!-- Filter Modal for Sensors -->
<Modal
    open={showSensorFilterModal}
    title="Filter Sensors"
    size="sm"
    on:close={() => showSensorFilterModal = false}
>
    <div class="filter-body">
        <Dropdown
            label="Status"
            options={sensorStatusDropdownOptions}
            value={sensorFilterStatuses}
            multiple={true}
            on:change={(e) => sensorFilterStatuses = normalizeMultiSelect(e.detail, sensorFilterStatuses)}
        />
        <Dropdown
            label="Location"
            options={sensorLocationDropdownOptions}
            value={sensorFilterLocations}
            multiple={true}
            on:change={(e) => sensorFilterLocations = normalizeMultiSelect(e.detail, sensorFilterLocations)}
        />
    </div>
    <svelte:fragment slot="footer">
        <Button variant="text" color="gray" size="lg" on:click={clearSensorFilter}>
            Clear All
        </Button>
        <Button variant="filled" color="primary" size="lg" on:click={applySensorFilter}>
            Apply Filter
        </Button>
    </svelte:fragment>
</Modal>

<!-- Delete Sensor Confirmation Modal -->
<ConfirmModal
    open={showSensorDeleteModal}
    title="Delete Sensor"
    description={`Are you sure you want to delete "${sensorToDelete?.name}"? This action cannot be undone.`}
    cancelText="Cancel"
    confirmText="Delete"
    type="error"
    confirmLoading={sensorDeleteLoading}
    on:close={closeSensorDeleteModal}
    on:confirm={confirmDeleteSensor}
/>

<!-- Edit Sensor Modal -->
{#if editSensor}
    <SensorEditDeviceModal
        open={showSensorEditModal}
        sensor={{ 
            id: editSensor.id, 
            name: editSensor.name, 
            location: editSensor.location
        }}
        onSave={handleSensorEditSave}
        onClose={closeSensorEditModal}
    />
{/if}

<style>
    .all-devices-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
        background: var(--ds-bg-secondary);
        padding: var(--ds-space-6);
        gap: var(--ds-space-6);
    }

    .toolbar {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-4);
    }

    .search-wrapper {
        flex: 1;
        max-width: 480px;
    }

    .actions-wrapper {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
    }

    .tabs-wrapper {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
    }

    .table-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    /* Add Device Modal */
    .add-device-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .add-device-help-frame {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: var(--ds-space-3);
        gap: var(--ds-space-2);
        width: 100%;
        background: var(--ds-color-neutral-true-50);
        border-radius: var(--ds-radius-lg);
    }

    .add-device-help-header {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: var(--ds-space-2-5);
        width: 100%;
    }

    .add-device-help-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        color: var(--ds-color-neutral-true-600);
    }

    .add-device-help-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-semibold);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
        flex: 1;
    }

    .add-device-help-list {
        margin: 0;
        padding-left: var(--ds-space-5);
        list-style: disc;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-500);
        width: 100%;
    }

    .add-device-help-list li {
        margin-bottom: var(--ds-space-1);
    }

    .add-device-help-list li:last-child {
        margin-bottom: 0;
    }

    /* Filter Modal */
    .filter-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
</style>
