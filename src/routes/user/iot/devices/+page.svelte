<script lang="ts">
    import { DeviceTable, Button, InputField, Modal, Checkbox, BulkActionsBar, Dropdown, Alert, TabGroup, TextareaField, Toggle } from "$lib/design-system/components";
    import type { DeviceRow, DeviceTablePagination, DeviceTableSort } from "$lib/design-system/components/DeviceTable.svelte";
    import type { TabItem } from "$lib/design-system/components/TabGroup.svelte";
    import { goto, invalidate } from "$app/navigation";
    import { page } from "$app/stores";
    import { Search, Filter, Plus, Tag as TagIcon, Workflow, MonitorSmartphone, ArrowUpFromLine, Eye, EyeOff } from "lucide-svelte";
    import { callUserRpc } from "$lib/client/mqtt/userRpc";
    import { waitForClaimConfirmation } from "$lib/client/mqtt/claimFlow";
    import type { PageData } from "./$types";

    // Type for available tags
    interface AvailableTag {
        id: string;
        name: string;
    }

    export let data: PageData;

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
    let editDeviceLoading = false;
    let editDeviceError: string | null = null;
    
    // Edit Device form state - Details tab
    let editDeviceName = "";
    let editDeviceActive = true;
    let editDeviceTags: string[] = [];
    let editDeviceDescription = "";
    
    // Edit Device form state - Configuration tab
    let editActiveTab = "details";
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
    let editPowerManagementSchedule = false;
    let editRebootSchedule = false;
    let editDownloadSchedule = false;

    // Edit Device tabs
    const editDeviceTabs: TabItem[] = [
        { id: 'details', label: 'Details' },
        { id: 'configuration', label: 'Configuration' }
    ];

    // Computed: Tag options for Edit Device modal
    $: editTagOptions = availableTags.map((t) => ({ id: t.id, label: t.name, type: 'checkbox' as const }));

    // =========================
    // Toast/Alert notifications
    // =========================
    type ToastType = 'success' | 'error';
    let toasts: Array<{ id: number; type: ToastType; message: string }> = [];
    let toastIdCounter = 0;

    function showToast(type: ToastType, message: string) {
        const id = ++toastIdCounter;
        toasts = [...toasts, { id, type, message }];
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
        }, 5000);
    }

    function dismissToast(id: number) {
        toasts = toasts.filter(t => t.id !== id);
    }

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

    $: deviceStatusOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        { id: 'ACTIVE', label: 'Active', type: 'checkbox' as const },
        { id: 'INACTIVE', label: 'Deactivated', type: 'checkbox' as const }
    ];

    $: connectionStatusOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        { id: 'Online', label: 'Connected', type: 'checkbox' as const },
        { id: 'Offline', label: 'Disconnected', type: 'checkbox' as const }
    ];

    $: osVersionOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...OS_OPTIONS.map((os) => ({ id: os, label: os, type: 'checkbox' as const }))
    ];

    // Transform server data to DeviceRow format
    function transformServerData(serverData: any): DeviceRow[] {
        if (!serverData?.devices) return [];
        
        return serverData.devices.map((device: any) => {
            const deviceInfo = serverData.deviceInformation?.[device.macAddress || device.lanMac || device.wifiMac];
            
            return {
                id: device.id,
                name: device.name || 'Unnamed Device',
                macAddress: device.macAddress || device.lanMac || device.wifiMac || 'N/A',
                osVersion: device.osVersion || 'Unknown',
                deviceType: device.deviceType || 'Unknown',  // Operating System column
                status: device.status || 'INACTIVE',
                connected: device.connected ?? false,
                connectedAt: device.connectedAt ? new Date(device.connectedAt) : undefined,
                disconnectedAt: device.disconnectedAt ? new Date(device.disconnectedAt) : undefined,
                // Database uses lastUsedAt, UI expects lastSeenAt
                lastSeenAt: device.lastUsedAt ? new Date(device.lastUsedAt) : (device.lastSeenAt ? new Date(device.lastSeenAt) : undefined),
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
            
            // Invalidate and reload
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

    function handleEdit(event: CustomEvent<DeviceRow>) {
        const device = event.detail;
        openEditDeviceModal(device);
    }

    function openEditDeviceModal(device: DeviceRow) {
        editDevice = device;
        editActiveTab = "details";
        editDeviceError = null;
        
        // Populate Details tab
        editDeviceName = device.name || "";
        editDeviceActive = device.status === 'ACTIVE';
        editDeviceTags = device.tags?.map(t => t.id) || [];
        editDeviceDescription = (device as any).description || "";
        
        // Populate Configuration tab (with defaults - actual values would come from device data)
        editAssignedProfile = (device as any).profileId || "";
        editKioskLockMode = (device as any).kioskLockMode || false;
        editExitLockdownPassword = "";
        editShowPassword = false;
        editKioskApplication = (device as any).kioskApplication || "";
        editDisplayResolution = (device as any).displayResolution || "1920x1080";
        editScreenOrientation = (device as any).screenOrientation || "Portrait";
        editBrightnessLevel = (device as any).brightnessLevel ?? 100;
        editAudioEnabled = (device as any).audioEnabled ?? true;
        editAudioVolume = (device as any).audioVolume ?? 100;
        editTimezone = (device as any).timezone || "Asia/Ho_Chi_Minh";
        editHomeLauncher = (device as any).homeLauncher || "";
        editPowerManagementSchedule = (device as any).powerManagementSchedule || false;
        editRebootSchedule = (device as any).rebootSchedule || false;
        editDownloadSchedule = (device as any).downloadSchedule || false;
        
        showEditDeviceModal = true;
    }

    async function saveEditDevice() {
        if (!editDevice) return;
        
        editDeviceLoading = true;
        editDeviceError = null;
        
        try {
            const fd = new FormData();
            fd.set('id', editDevice.id);
            fd.set('name', editDeviceName);
            fd.set('status', editDeviceActive ? 'ACTIVE' : 'INACTIVE');
            fd.set('description', editDeviceDescription);
            fd.set('tags', JSON.stringify(editDeviceTags));
            
            // Configuration fields
            fd.set('profileId', editAssignedProfile);
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
            fd.set('rebootSchedule', String(editRebootSchedule));
            fd.set('downloadSchedule', String(editDownloadSchedule));
            
            const res = await fetch('?/updateDevice', { method: 'POST', body: fd });
            
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || res.statusText);
            }
            
            showToast('success', 'Device saved successfully!');
            showEditDeviceModal = false;
            editDevice = null;
            await invalidate('app:userDevices');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            editDeviceError = errorMsg;
            showToast('error', 'Unable to save device. Please try again!');
        } finally {
            editDeviceLoading = false;
        }
    }

    function closeEditDeviceModal() {
        showEditDeviceModal = false;
        editDevice = null;
        editDeviceError = null;
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
            
            showToast('success', `Device ${actionName} successfully!`);
            await invalidate('app:userDevices');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('error', `Unable to ${device.status === 'ACTIVE' ? 'deactivate' : 'reactivate'}. Please try again!`);
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
            
            showToast('success', 'Device rebooted successfully!');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('error', 'Unable to reboot Device. Please try again!');
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
            
            showToast('success', 'Device deleted successfully!');
            await invalidate('app:userDevices');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            showToast('error', 'Unable to delete device. Please try again!');
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
            const response = await callUserRpc<{ flowId?: string; result: { factoryDeviceId: string } }>(
                'device.claim',
                { pin: claimPin },
                { timeoutMs: 5000 }
            );
            const flowId = response?.flowId;
            if (!flowId) throw new Error('Missing flowId in claim response');

            const confirmation = await waitForClaimConfirmation(flowId, { timeoutMs: 20000 });
            showAddDeviceModal = false;
            showToast('success', 'Device added successfully!');
            // give device time to reconnect with new creds
            await new Promise((r) => setTimeout(r, 1000));
            await goto(`/user/iot/devices/${confirmation.deviceId}`);
        } catch (e) {
            claimError = e instanceof Error ? e.message : String(e);
            showToast('error', 'Unable to add device. Please try again!');
        } finally {
            claimLoading = false;
        }
    }

    // =========================
    // Bulk actions (Figma)
    // =========================
    const bulkActions = [
        { id: 'assign-tag', label: 'Assign Tag', icon: TagIcon },
        { id: 'assign-deployment', label: 'Assign Deployment', icon: Workflow },
          { id: 'install-app', label: 'Install App', icon: MonitorSmartphone },
          { id: 'update', label: 'Update', icon: ArrowUpFromLine },
        { id: 'deactivate', label: 'Deactivate', destructive: true },
        { id: 'reboot', label: 'Reboot', destructive: true }
    ] as const;

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

    // Computed: filtered tags for Assign Tag modal
    $: assignTagFilteredOptions = availableTags.filter((t) => 
        t.name.toLowerCase().includes(assignTagSearch.toLowerCase())
    );

    function openAssignTagModal() {
        assignTagSearch = "";
        assignTagSelected = [];
        assignTagDropdownOpen = false;
        assignTagDropdownInteracting = false;
        showAssignTagModal = true;
    }
    
    function handleAssignTagFocus() {
        assignTagDropdownOpen = true;
    }
    
    function handleAssignTagBlur(e: FocusEvent) {
        // Delay closing to allow click on options
        setTimeout(() => {
            if (!assignTagDropdownInteracting) {
                assignTagDropdownOpen = false;
            }
        }, 150);
    }

    // Assign Deployment Modal state (Add App modal per Figma)
    interface DeploymentAppOption {
        id: string;
        name: string;
        packageName: string;
    }
    
    interface SelectedDeploymentApp {
        id: string;
        autoOpen: boolean;
    }
    
    let showAssignDeploymentModal = false;
    let assignDeploymentSearch = "";
    let assignDeploymentSelectedApps: SelectedDeploymentApp[] = [];
    let assignDeploymentLoading = false;
    let assignDeploymentDropdownOpen = false;
    let assignDeploymentDropdownInteracting = false;

    // Mock app options for Assign Deployment (replace with real data from server)
    const availableDeploymentApps: DeploymentAppOption[] = [
        { id: 'app-1', name: 'MDM Agent', packageName: 'com.datarealities.android' },
        { id: 'app-2', name: 'Shift Management', packageName: 'com.datarealities.android' },
        { id: 'app-3', name: 'Weather App', packageName: 'com.weatherapp.datarealities.com' },
        { id: 'app-4', name: 'Chart App', packageName: 'chartapp.datarealities.com' }
    ];

    // Computed: filtered apps for Assign Deployment modal
    $: assignDeploymentFilteredOptions = availableDeploymentApps.filter((app) => 
        app.name.toLowerCase().includes(assignDeploymentSearch.toLowerCase()) ||
        app.packageName.toLowerCase().includes(assignDeploymentSearch.toLowerCase())
    );
    
    // Check if app is selected for deployment
    function isDeploymentAppSelected(appId: string): boolean {
        return assignDeploymentSelectedApps.some(a => a.id === appId);
    }

    function openAssignDeploymentModal() {
        assignDeploymentSearch = "";
        assignDeploymentSelectedApps = [];
        assignDeploymentDropdownOpen = false;
        assignDeploymentDropdownInteracting = false;
        showAssignDeploymentModal = true;
    }
    
    function handleAssignDeploymentFocus() {
        assignDeploymentDropdownOpen = true;
    }
    
    function handleAssignDeploymentBlur(e: FocusEvent) {
        // Only close if not interacting with dropdown
        setTimeout(() => {
            if (!assignDeploymentDropdownInteracting) {
                assignDeploymentDropdownOpen = false;
            }
        }, 150);
    }

    function toggleAssignDeploymentApp(appId: string) {
        if (isDeploymentAppSelected(appId)) {
            assignDeploymentSelectedApps = assignDeploymentSelectedApps.filter(a => a.id !== appId);
        } else {
            assignDeploymentSelectedApps = [...assignDeploymentSelectedApps, { id: appId, autoOpen: false }];
        }
        // Reset interaction flag
        assignDeploymentDropdownInteracting = false;
    }

    function removeAssignDeploymentApp(appId: string) {
        assignDeploymentSelectedApps = assignDeploymentSelectedApps.filter(a => a.id !== appId);
    }
    
    function toggleDeploymentAutoOpen(appId: string) {
        assignDeploymentSelectedApps = assignDeploymentSelectedApps.map(a => 
            a.id === appId ? { ...a, autoOpen: !a.autoOpen } : a
        );
    }

    async function confirmAssignDeployment() {
        if (assignDeploymentSelectedApps.length === 0 || selectedRows.length === 0) return;
        assignDeploymentLoading = true;
        try {
            // TODO: Implement actual API call to add apps to devices
            // For now, simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            showAssignDeploymentModal = false;
            selectedRows = [];
            showToast('success', 'App added successfully!');
            await invalidate('app:userDevices');
        } catch (e) {
            showToast('error', 'Unable to add App. Please try again!');
            console.error('Failed to add app:', e);
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

    // App options loaded from API
    let availableApps: AppOption[] = [];
    let availableAppsLoading = false;

    // Computed: filtered apps for Install App modal
    $: installAppFilteredOptions = availableApps.filter((app) => 
        app.name.toLowerCase().includes(installAppSearch.toLowerCase()) ||
        app.packageName.toLowerCase().includes(installAppSearch.toLowerCase())
    );

    // Load apps from API
    async function loadAvailableApps() {
        availableAppsLoading = true;
        try {
            const res = await fetch('/api/user/resources/apps?pageSize=100');
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
    
    function handleInstallAppFocus() {
        installAppDropdownOpen = true;
    }
    
    function handleInstallAppBlur(e: FocusEvent) {
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
                showToast('success', 'App installation initiated successfully!');
            } else if (successCount > 0) {
                showToast('success', `App installation initiated on ${successCount} device(s). ${failCount} failed.`);
            } else {
                showToast('error', 'Failed to install app on all devices.');
            }
            
            await invalidate('app:userDevices');
        } catch (e) {
            showToast('error', 'Unable to install New App. Please try again!');
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
                showToast('success', 'Firmware update initiated successfully!');
            } else if (successCount > 0) {
                showToast('success', `Firmware update initiated on ${successCount} device(s). ${failCount} failed.`);
            } else {
                showToast('error', 'Failed to update firmware on all devices.');
            }
            
            await invalidate('app:userDevices');
        } catch (e) {
            showToast('error', 'Unable to update Firmware. Please try again!');
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
            showToast('success', 'Tag assigned successfully!');
            await invalidate('app:userDevices');
        } catch (e) {
            showToast('error', 'Unable to assign Tag. Please try again!');
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
                showToast('success', 'Device rebooted successfully!');
            } else if (actionType === 'deactivate') {
                showToast('success', 'Device deactivated successfully!');
            }
        } catch (e) {
            bulkError = e instanceof Error ? e.message : String(e);
            
            // Show error toast based on action type
            if (actionType === 'reboot') {
                showToast('error', 'Unable to reboot Device. Please try again!');
            } else if (actionType === 'deactivate') {
                showToast('error', 'Unable to deactivate Device. Please try again!');
            }
        } finally {
            bulkWorking = false;
        }
    }

    // Handle search with debounce
    let searchTimeout: ReturnType<typeof setTimeout>;
    $: {
        if (searchValue !== undefined) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
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

        <!-- Filter Button: 44x44px, border #D6D6D6, shadow -->
        <Button 
            variant="outline" 
            color="gray" 
            size="lg"
            iconOnly={true}
            style="width: 44px; height: 44px; border: 1px solid #D6D6D6; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
            on:click={openFilter}
        >
            <Filter size={20} slot="icon" />
        </Button>

        <!-- Add Device Button: 156px width, height 44px, background #0086C9 -->
        <Button 
            variant="filled" 
            color="primary" 
            size="lg" 
            iconLeft={true}
            on:click={openAddDeviceModal}
            style="width: 156px; height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Plus size={20} slot="icon-left" />
            Add Device
        </Button>
    </div>

    <!-- Device Table -->
    <DeviceTable
        data={devices}
        {pagination}
        {sort}
        {loading}
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

    <!-- Bulk actions bar (Figma) - centered at bottom of table area -->
    {#if selectedRows.length > 0}
        <div 
            class="w-full flex justify-center z-10"
            style="margin-top: 24px; margin-bottom: 16px;"
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
    <div class="w-full flex flex-col items-center" style="width: 100%;">
        <label 
            for="device-pin-input"
            class="block text-center mb-2 ds-text-body"
        >
            Device PIN Code <span class="ds-text-error">*</span>
        </label>
        <input
            id="device-pin-input"
            type="text"
            placeholder="000 000"
            bind:value={claimPin}
            maxlength="6"
            class="w-full text-center ds-input"
            class:ds-input-error={claimError}
            on:focus={(e) => e.currentTarget.style.borderColor = 'var(--ds-color-blue-light-600)'}
            on:blur={(e) => e.currentTarget.style.borderColor = claimError ? 'var(--ds-color-error-500)' : 'var(--ds-border-default)'}
        />
        {#if claimError}
            <p class="ds-text-error" style="margin-top: 4px;">
                {claimError}
            </p>
        {/if}
    </div>

    <!-- Help Info Box -->
    <div class="ds-info-box">
        <div class="flex items-start gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0; margin-top: 2px;">
                <circle cx="12" cy="12" r="10" stroke="var(--ds-color-gray-600)" stroke-width="2"/>
                <path d="M12 16V12M12 8H12.01" stroke="var(--ds-color-gray-600)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="ds-info-box-title">
                Need help finding your device PIN?
            </span>
        </div>
        <ul class="ds-info-box-list">
            <li style="margin-bottom: 4px;">The PIN is a 6-digit code displayed on your device or terminal during setup</li>
            <li style="margin-bottom: 4px;">For camera devices, the PIN may appear on the device's screen</li>
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
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {claimLoading ? 'Claiming…' : 'Claim Device'}
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
    <div class="w-full" style="width: 100%;">
        <div class="flex flex-col items-start" style="gap: 16px; width: 100%;">
            <div style="width: 518px;">
                <Dropdown
                    label="Device Status"
                    placeholder="Select"
                    multiple={true}
                    options={deviceStatusOptions}
                    value={filterStatuses}
                    on:change={handleDeviceStatusChange}
                />
            </div>

            <div style="width: 518px;">
                <Dropdown
                    label="Connection Status"
                    placeholder="Select"
                    multiple={true}
                    options={connectionStatusOptions}
                    value={filterConnection}
                    on:change={handleConnectionStatusChange}
                />
            </div>

            <div style="width: 518px;">
                <Dropdown
                    label="OS Version"
                    placeholder="Select"
                    multiple={true}
                    options={osVersionOptions}
                    value={filterOsVersions}
                    on:change={handleOsVersionChange}
                />
            </div>

            <div style="width: 518px;">
                <Dropdown
                    label="Tag"
                    placeholder="Select"
                    multiple={true}
                    searchable={true}
                    maxHeight={260}
                    options={tagOptions}
                    value={filterTagIds}
                    on:change={handleTagChange}
                />
            </div>
        </div>
    </div>

    <!-- Footer: Clear All + Apply -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="text"
            color="primary"
            size="lg"
            style="height: 44px;"
            on:click={clearFilterModal}
        >
            Clear All
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={applyFilterModal}
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05); min-width: 100px;"
        >
            Apply
        </Button>
    </div>
</Modal>

<!-- Bulk confirm modal -->
<Modal
    open={showBulkConfirmModal}
    title={bulkConfirmAction === 'reboot' ? 'Reboot devices' : 'Deactivate devices'}
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    showFooter={true}
    on:close={() => (showBulkConfirmModal = false)}
>
    <div class="text-sm text-[#292929]" style="font-family: var(--ds-font-family-primary);">
        {#if bulkConfirmAction === 'reboot'}
            This will reboot {selectedRows.length} device(s). Continue?
        {:else}
            This will deactivate {selectedRows.length} device(s). Continue?
        {/if}
        {#if bulkError}
            <div class="mt-2 text-sm text-[#B42318]">{bulkError}</div>
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
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {bulkWorking ? 'Working…' : 'Confirm'}
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
    <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 16px; line-height: 24px; color: #292929; margin: 0;">
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
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {#if actionLoading}
                Working…
            {:else}
                {pendingActionDevice?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            {/if}
        </Button>
    </div>
</Modal>

<!-- Delete Device Confirmation Modal -->
<Modal
    open={showDeleteModal}
    title="Delete Device"
    type="error"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    showFooter={true}
    on:close={cancelDeleteModal}
>
    <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 16px; line-height: 24px; color: #292929; margin: 0;">
        Are you sure you want to delete this device? This action can not be reverse.
    </p>

    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            style="height: 44px;"
            on:click={cancelDeleteModal}
            disabled={actionLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={confirmDelete}
            disabled={actionLoading}
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {actionLoading ? 'Deleting…' : 'Delete'}
        </Button>
    </div>
</Modal>

<!-- Edit Device Modal (Figma) -->
<Modal
    open={showEditDeviceModal}
    title="Edit Device"
    size="lg"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={false}
    closeOnEscape={true}
    showFooter={true}
    on:close={closeEditDeviceModal}
>
    <!-- Device Name Row with Active Toggle aligned to input -->
    <div class="w-full" style="margin-bottom: 24px;">
        <label 
            for="edit-device-name"
            style="display: block; font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #344054; margin-bottom: 6px;"
        >
            Device Name
        </label>
        <div class="flex items-center gap-4">
            <div class="flex-1">
                <input
                    id="edit-device-name"
                    type="text"
                    placeholder="Enter device name"
                    bind:value={editDeviceName}
                    style="
                        box-sizing: border-box;
                        width: 100%;
                        padding: 10px 14px;
                        height: 44px;
                        background: #FFFFFF;
                        border: 1px solid {editDeviceError ? '#FDA29B' : '#D0D5DD'};
                        border-radius: 8px;
                        font-family: var(--ds-font-family-primary);
                        font-size: 16px;
                        line-height: 24px;
                        color: #101828;
                        outline: none;
                    "
                    on:focus={(e) => e.currentTarget.style.borderColor = '#0086C9'}
                    on:blur={(e) => e.currentTarget.style.borderColor = editDeviceError ? '#FDA29B' : '#D0D5DD'}
                />
            </div>
            <div class="flex items-center gap-2">
                <Toggle
                    bind:checked={editDeviceActive}
                    size="sm"
                />
                <span style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929;">
                    Active
                </span>
            </div>
        </div>
    </div>

    <!-- Tabs -->
    <div style="margin-bottom: 24px; width: 100%;">
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
        <div class="flex flex-col" style="width: 100%; gap: 24px;">
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
            />
        </div>
    {:else}
        <!-- Configuration Tab -->
        <div class="flex flex-col gap-4" style="width: 100%; max-height: 500px; overflow-y: auto;">
            
            <!-- Assigned Profile Dropdown (standalone) -->
            <Dropdown
                label="Assigned Profile"
                placeholder="Select"
                options={[
                    { id: 'profile1', label: '<Value>', supportingText: '<Value>' },
                    { id: 'profile2', label: '<Value>', supportingText: '<Value>' },
                    { id: 'profile3', label: '<Value>', supportingText: '<Value>' },
                    { id: 'profile4', label: '<Value>', supportingText: '<Value>' }
                ]}
                value={editAssignedProfile}
                on:change={(e) => editAssignedProfile = String(e.detail)}
            />

            <!-- Block 1: Kiosk Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Kiosk Lock Mode -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Kiosk Lock Mode
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable kiosk mode to lock the device interface
                        </p>
                    </div>
                    <Toggle bind:checked={editKioskLockMode} size="sm" />
                </div>

                <!-- Exit Lockdown Password -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Exit Lockdown Password
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Password required to exit kiosk mode
                        </p>
                    </div>
                    <div class="relative" style="width: 200px;">
                        {#if editShowPassword}
                            <input
                                type="text"
                                bind:value={editExitLockdownPassword}
                                placeholder="******"
                                class="w-full"
                                style="
                                    box-sizing: border-box;
                                    padding: 10px 40px 10px 14px;
                                    height: 44px;
                                    background: #FFFFFF;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 8px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    outline: none;
                                "
                            />
                        {:else}
                            <input
                                type="password"
                                bind:value={editExitLockdownPassword}
                                placeholder="******"
                                class="w-full"
                                style="
                                    box-sizing: border-box;
                                    padding: 10px 40px 10px 14px;
                                    height: 44px;
                                    background: #FFFFFF;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 8px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    outline: none;
                                "
                            />
                        {/if}
                        <button
                            type="button"
                            class="absolute right-3 top-1/2 -translate-y-1/2"
                            on:click={() => editShowPassword = !editShowPassword}
                            style="background: none; border: none; cursor: pointer; padding: 0;"
                        >
                            {#if editShowPassword}
                                <EyeOff size={20} color="#737373" />
                            {:else}
                                <Eye size={20} color="#737373" />
                            {/if}
                        </button>
                    </div>
                </div>

                <!-- Kiosk Application -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Kiosk Application
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Application to run in kiosk mode
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="<App Name>"
                            options={[
                                { id: 'app1', label: '<Value>', supportingText: '<Value>' },
                                { id: 'app2', label: '<Value>', supportingText: '<Value>' },
                                { id: 'app3', label: '<Value>', supportingText: '<Value>' },
                                { id: 'app4', label: '<Value>', supportingText: '<Value>' }
                            ]}
                            value={editKioskApplication}
                            on:change={(e) => editKioskApplication = String(e.detail)}
                        />
                    </div>
                </div>
            </div>

            <!-- Block 2: Display Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Display Resolution -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Display Resolution
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Screen resolution for device
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={[
                                { id: '640x480', label: '640x480' },
                                { id: '800x600', label: '800x600' },
                                { id: '1024x768', label: '1024x768' },
                                { id: '1152x864', label: '1152x864' }
                            ]}
                            value={editDisplayResolution}
                            on:change={(e) => editDisplayResolution = String(e.detail)}
                        />
                    </div>
                </div>

                <!-- Screen Orientation -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Screen Orientation
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Screen orientation preference
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={[
                                { id: 'Portrait', label: 'Portrait' },
                                { id: 'Landscape', label: 'Landscape' }
                            ]}
                            value={editScreenOrientation}
                            on:change={(e) => editScreenOrientation = String(e.detail)}
                        />
                    </div>
                </div>

                <!-- Brightness Level -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Brightness Level
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Screen brightness level (0-100%)
                        </p>
                    </div>
                    <div class="flex items-center gap-3" style="width: 280px;">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={editBrightnessLevel}
                            class="config-slider"
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #344054 0%, #344054 {editBrightnessLevel}%, #E5E5E5 {editBrightnessLevel}%, #E5E5E5 100%); border-radius: 4px; outline: none;"
                        />
                        <div class="flex items-center gap-1" style="min-width: 70px;">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={editBrightnessLevel}
                                style="
                                    width: 50px;
                                    padding: 6px 8px;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 6px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    text-align: center;
                                    background: #FFFFFF;
                                "
                            />
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #737373;">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 3: Audio Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Audio -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Audio
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable or disable audio output
                        </p>
                    </div>
                    <Toggle bind:checked={editAudioEnabled} size="sm" />
                </div>

                <!-- Audio Volume -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Audio Volume
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Audio volume level (0-100%)
                        </p>
                    </div>
                    <div class="flex items-center gap-3" style="width: 280px;">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            bind:value={editAudioVolume}
                            class="config-slider"
                            style="flex: 1; height: 8px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #344054 0%, #344054 {editAudioVolume}%, #E5E5E5 {editAudioVolume}%, #E5E5E5 100%); border-radius: 4px; outline: none;"
                        />
                        <div class="flex items-center gap-1" style="min-width: 70px;">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                bind:value={editAudioVolume}
                                style="
                                    width: 50px;
                                    padding: 6px 8px;
                                    border: 1px solid #D6D6D6;
                                    border-radius: 6px;
                                    font-family: var(--ds-font-family-primary);
                                    font-size: 14px;
                                    text-align: center;
                                    background: #FFFFFF;
                                "
                            />
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #737373;">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Block 4: System Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Timezone -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Timezone
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Device timezone settings
                        </p>
                    </div>
                    <div style="width: 200px;">
                        <Dropdown
                            placeholder="Select"
                            options={[
                                { id: 'Asia/Ho_Chi_Minh', label: '<Value>', supportingText: '<Value>' },
                                { id: 'Asia/Bangkok', label: '<Value>', supportingText: '<Value>' },
                                { id: 'Asia/Singapore', label: '<Value>', supportingText: '<Value>' },
                                { id: 'UTC', label: '<Value>', supportingText: '<Value>' }
                            ]}
                            value={editTimezone}
                            on:change={(e) => editTimezone = String(e.detail)}
                        />
                    </div>
                </div>

                <!-- Home/Launcher -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Home/ Launcher
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Default home screen launcher
                        </p>
                    </div>
                    <div style="width: 64px; height: 64px; background: #FFFFFF; border: 1px solid #EAECF0; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        {#if editHomeLauncher}
                            <img src={editHomeLauncher} alt="Launcher" style="width: 100%; height: 100%; object-fit: cover;" />
                        {:else}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="3" width="18" height="18" rx="2" stroke="#98A2B3" stroke-width="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5" fill="#98A2B3"/>
                                <path d="M21 15L16 10L5 21" stroke="#98A2B3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Block 5: Schedule Settings -->
            <div style="background: #F9FAFB; border-radius: 12px; padding: 0;">
                <!-- Power Management Schedule -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Power Management Schedule
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable scheduled power on/off times
                        </p>
                    </div>
                    <Toggle bind:checked={editPowerManagementSchedule} size="sm" />
                </div>

                <!-- Reboot Schedule -->
                <div class="flex items-center justify-between" style="padding: 16px 20px; border-bottom: 1px solid #EAECF0;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Reboot Schedule
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable scheduled device reboots
                        </p>
                    </div>
                    <Toggle bind:checked={editRebootSchedule} size="sm" />
                </div>

                <!-- Download Schedule -->
                <div class="flex items-center justify-between" style="padding: 16px 20px;">
                    <div>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 14px; line-height: 20px; color: #292929; margin: 0;">
                            Download Schedule
                        </p>
                        <p style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; line-height: 20px; color: #737373; margin: 0;">
                            Enable scheduled content downloads
                        </p>
                    </div>
                    <Toggle bind:checked={editDownloadSchedule} size="sm" />
                </div>
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
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {editDeviceLoading ? 'Saving…' : 'Save'}
        </Button>
    </div>
</Modal>

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
    <!-- Search Input with Dropdown -->
    <div class="w-full relative" style="margin-bottom: 16px;">
        <!-- Search Input -->
        <div 
            class="flex items-center"
            style="
                box-sizing: border-box;
                width: 100%;
                height: 48px;
                padding: 12px 14px;
                background: #FEFEFE;
                border: 1px solid {assignTagDropdownOpen ? '#525252' : '#D6D6D6'};
                border-radius: {assignTagDropdownOpen ? '8px 8px 0 0' : '8px'};
                gap: 12px;
                transition: border-color 0.15s ease, border-radius 0.15s ease;
            "
        >
            <input
                type="text"
                placeholder="Search and select tag"
                bind:value={assignTagSearch}
                on:focus={handleAssignTagFocus}
                on:blur={handleAssignTagBlur}
                class="flex-1"
                style="
                    border: none;
                    outline: none;
                    background: transparent;
                    font-family: var(--ds-font-family-primary);
                    font-size: 16px;
                    line-height: 24px;
                    color: #292929;
                "
            />
            <Search size={22} color="#292929" />
        </div>
        
        <!-- Tag Options Dropdown (only show when focused) -->
        {#if assignTagDropdownOpen}
            <div 
                role="listbox"
                tabindex="-1"
                style="
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #FFFFFF;
                    border: 1px solid #D6D6D6;
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                    max-height: 152px;
                    overflow-y: auto;
                    z-index: 10;
                    box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
                "
                on:mouseenter={() => assignTagDropdownInteracting = true}
                on:mouseleave={() => assignTagDropdownInteracting = false}
            >
                {#each assignTagFilteredOptions as tag (tag.id)}
                    {@const isSelected = assignTagSelected.includes(tag.id)}
                    <button
                        type="button"
                        class="w-full flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors"
                        style="
                            padding: 8px 16px;
                            border: none;
                            background: transparent;
                            cursor: pointer;
                            text-align: left;
                        "
                        on:mousedown|preventDefault={() => toggleAssignTag(tag.id)}
                    >
                        <div 
                            class="flex items-center justify-center"
                            style="
                                width: 16px;
                                height: 16px;
                                background: {isSelected ? '#141414' : '#FFFFFF'};
                                border: 1px solid {isSelected ? '#141414' : '#D6D6D6'};
                                border-radius: 4px;
                                flex-shrink: 0;
                            "
                        >
                            {#if isSelected}
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 3L4.5 8.5L2 6" stroke="#FFFFFF" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            {/if}
                        </div>
                        <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #292929;">
                            {tag.name}
                        </span>
                    </button>
                {/each}
                {#if assignTagFilteredOptions.length === 0}
                    <div class="px-4 py-3 text-center" style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085;">
                        No tags found
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Selected Tags -->
    <div class="w-full">
        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 16px; line-height: 24px; color: #292929; margin: 0 0 8px 0;">
            Selected ({assignTagSelected.length} items)
        </p>
        <div class="flex flex-wrap gap-2" style="min-height: 28px;">
            {#each assignTagSelected as tagId}
                {@const tag = availableTags.find(t => t.id === tagId)}
                {#if tag}
                    <div 
                        class="flex items-center gap-1.5"
                        style="
                            box-sizing: border-box;
                            padding: 4px 6px;
                            background: #FFFFFF;
                            border: 1px solid #D6D6D6;
                            border-radius: 6px;
                        "
                    >
                        <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #424242;">
                            {tag.name}
                        </span>
                        <button
                            type="button"
                            on:click={() => removeAssignTag(tagId)}
                            style="padding: 2px; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 3L3 9M3 3L9 9" stroke="#A3A3A3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                {/if}
            {/each}
            {#if assignTagSelected.length === 0}
                <span style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085;">
                    No tags selected
                </span>
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
            style="height: 44px; min-width: 100px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {assignTagLoading ? 'Assigning…' : 'Assign'}
        </Button>
    </div>
</Modal>

<!-- Assign Deployment Modal (Add App - Figma) -->
<Modal
    open={showAssignDeploymentModal}
    title="Add App"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => (showAssignDeploymentModal = false)}
>
    <!-- Search Input with Dropdown -->
    <div class="w-full relative" style="margin-bottom: 16px;">
        <!-- Search Input -->
        <div 
            class="flex items-center"
            style="
                box-sizing: border-box;
                width: 100%;
                height: 48px;
                padding: 12px 14px;
                background: #FEFEFE;
                border: 1px solid {assignDeploymentDropdownOpen ? '#525252' : '#D6D6D6'};
                border-radius: {assignDeploymentDropdownOpen ? '8px 8px 0 0' : '8px'};
                gap: 12px;
                transition: border-color 0.15s ease, border-radius 0.15s ease;
            "
        >
            <input
                type="text"
                placeholder="Search and select app"
                bind:value={assignDeploymentSearch}
                on:focus={handleAssignDeploymentFocus}
                on:blur={handleAssignDeploymentBlur}
                class="flex-1"
                style="
                    border: none;
                    outline: none;
                    background: transparent;
                    font-family: var(--ds-font-family-primary);
                    font-size: 16px;
                    line-height: 24px;
                    color: #292929;
                "
            />
            <Search size={22} color="#292929" />
        </div>
        
        <!-- App Options Dropdown (only show when focused) -->
        {#if assignDeploymentDropdownOpen}
            <div 
                role="listbox"
                tabindex="-1"
                style="
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #FFFFFF;
                    border: 1px solid #D6D6D6;
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                    max-height: 180px;
                    overflow-y: auto;
                    z-index: 10;
                    box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
                "
                on:mouseenter={() => assignDeploymentDropdownInteracting = true}
                on:mouseleave={() => assignDeploymentDropdownInteracting = false}
            >
                {#each assignDeploymentFilteredOptions as app (app.id)}
                    {@const isSelected = assignDeploymentSelectedApps.some(a => a.id === app.id)}
                    <button
                        type="button"
                        class="w-full flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors"
                        style="
                            padding: 8px 16px;
                            border: none;
                            background: transparent;
                            cursor: pointer;
                            text-align: left;
                        "
                        on:mousedown|preventDefault={() => toggleAssignDeploymentApp(app.id)}
                    >
                        <div 
                            class="flex items-center justify-center"
                            style="
                                width: 16px;
                                height: 16px;
                                background: {isSelected ? '#141414' : '#FFFFFF'};
                                border: 1px solid {isSelected ? '#141414' : '#D6D6D6'};
                                border-radius: 4px;
                                flex-shrink: 0;
                            "
                        >
                            {#if isSelected}
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 3L4.5 8.5L2 6" stroke="#FFFFFF" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            {/if}
                        </div>
                        <div class="flex flex-col">
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #292929;">
                                {app.name}
                            </span>
                            <span style="font-family: var(--ds-font-family-primary); font-size: 12px; line-height: 16px; color: #667085;">
                                {app.packageName}
                            </span>
                        </div>
                    </button>
                {/each}
                {#if assignDeploymentFilteredOptions.length === 0}
                    <div class="px-4 py-3 text-center" style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085;">
                        No apps found
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Selected Apps (List format with Auto open toggle) -->
    <div class="w-full">
        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 16px; line-height: 24px; color: #292929; margin: 0 0 8px 0;">
            Selected ({assignDeploymentSelectedApps.length} items)
        </p>
        <div class="flex flex-col" style="gap: 0;">
            {#each assignDeploymentSelectedApps as selectedApp}
                {@const app = availableDeploymentApps.find(a => a.id === selectedApp.id)}
                {#if app}
                    <div 
                        class="flex items-center justify-between"
                        style="
                            padding: 12px 0;
                            border-bottom: 1px solid #EAECF0;
                        "
                    >
                        <div class="flex flex-col">
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; font-weight: 500; color: #292929;">
                                {app.name}
                            </span>
                            <span style="font-family: var(--ds-font-family-primary); font-size: 12px; line-height: 16px; color: #667085;">
                                {app.packageName}
                            </span>
                        </div>
                        <div class="flex items-center gap-3">
                            <!-- Auto open toggle with tooltip -->
                            <div class="flex items-center gap-2" title="Enable to open app automatically after installation">
                                <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085;">
                                    Auto open
                                </span>
                                <button
                                    type="button"
                                    on:click={() => toggleDeploymentAutoOpen(selectedApp.id)}
                                    style="
                                        width: 44px;
                                        height: 24px;
                                        border-radius: 12px;
                                        border: none;
                                        cursor: pointer;
                                        position: relative;
                                        transition: background-color 0.2s ease;
                                        background: {selectedApp.autoOpen ? '#0086C9' : '#E5E5E5'};
                                    "
                                >
                                    <span
                                        style="
                                            position: absolute;
                                            top: 2px;
                                            left: {selectedApp.autoOpen ? '22px' : '2px'};
                                            width: 20px;
                                            height: 20px;
                                            background: #FFFFFF;
                                            border-radius: 50%;
                                            transition: left 0.2s ease;
                                            box-shadow: 0px 1px 3px rgba(16, 24, 40, 0.1);
                                        "
                                    />
                                </button>
                            </div>
                            <!-- Remove button -->
                            <button
                                type="button"
                                on:click={() => removeAssignDeploymentApp(selectedApp.id)}
                                style="padding: 4px; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 4L4 12M4 4L12 12" stroke="#A3A3A3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                {/if}
            {/each}
            {#if assignDeploymentSelectedApps.length === 0}
                <span style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085; padding: 12px 0;">
                    No apps selected
                </span>
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
            disabled={assignDeploymentLoading || assignDeploymentSelectedApps.length === 0}
            style="height: 44px; min-width: 100px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {assignDeploymentLoading ? 'Adding…' : 'Assign'}
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
    <!-- Search Input with Dropdown -->
    <div class="w-full relative" style="margin-bottom: 16px;">
        <!-- Search Input -->
        <div 
            class="flex items-center"
            style="
                box-sizing: border-box;
                width: 100%;
                height: 48px;
                padding: 12px 14px;
                background: #FEFEFE;
                border: 1px solid {installAppDropdownOpen ? '#525252' : '#D6D6D6'};
                border-radius: {installAppDropdownOpen ? '8px 8px 0 0' : '8px'};
                gap: 12px;
                transition: border-color 0.15s ease, border-radius 0.15s ease;
            "
        >
            <input
                type="text"
                placeholder="Search and select app"
                bind:value={installAppSearch}
                on:focus={handleInstallAppFocus}
                on:blur={handleInstallAppBlur}
                class="flex-1"
                style="
                    border: none;
                    outline: none;
                    background: transparent;
                    font-family: var(--ds-font-family-primary);
                    font-size: 16px;
                    line-height: 24px;
                    color: #292929;
                "
            />
            <Search size={22} color="#292929" />
        </div>
        
        <!-- App Options Dropdown (only show when focused) -->
        {#if installAppDropdownOpen}
            <div 
                role="listbox"
                tabindex="-1"
                style="
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #FFFFFF;
                    border: 1px solid #D6D6D6;
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                    max-height: 180px;
                    overflow-y: auto;
                    z-index: 10;
                    box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
                "
                on:mouseenter={() => installAppDropdownInteracting = true}
                on:mouseleave={() => installAppDropdownInteracting = false}
            >
                {#each installAppFilteredOptions as app (app.id)}
                    {@const isSelected = installAppSelected.includes(app.id)}
                    <button
                        type="button"
                        class="w-full flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors"
                        style="
                            padding: 8px 16px;
                            border: none;
                            background: transparent;
                            cursor: pointer;
                            text-align: left;
                        "
                        on:mousedown|preventDefault={() => toggleInstallApp(app.id)}
                    >
                        <div 
                            class="flex items-center justify-center"
                            style="
                                width: 16px;
                                height: 16px;
                                background: {isSelected ? '#141414' : '#FFFFFF'};
                                border: 1px solid {isSelected ? '#141414' : '#D6D6D6'};
                                border-radius: 4px;
                                flex-shrink: 0;
                            "
                        >
                            {#if isSelected}
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 3L4.5 8.5L2 6" stroke="#FFFFFF" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            {/if}
                        </div>
                        <div class="flex flex-col">
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #292929;">
                                {app.name}
                            </span>
                            <span style="font-family: var(--ds-font-family-primary); font-size: 12px; line-height: 16px; color: #667085;">
                                {app.packageName}
                            </span>
                        </div>
                    </button>
                {/each}
                {#if installAppFilteredOptions.length === 0}
                    <div class="px-4 py-3 text-center" style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085;">
                        No apps found
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Selected Apps (Simple list without Auto open toggle) -->
    <div class="w-full">
        <p style="font-family: var(--ds-font-family-primary); font-weight: 500; font-size: 16px; line-height: 24px; color: #292929; margin: 0 0 8px 0;">
            Selected ({installAppSelected.length} items)
        </p>
        <div class="flex flex-col" style="gap: 0;">
            {#each installAppSelected as appId}
                {@const app = availableApps.find(a => a.id === appId)}
                {#if app}
                    <div 
                        class="flex items-center justify-between"
                        style="
                            padding: 12px 0;
                            border-bottom: 1px solid #EAECF0;
                        "
                    >
                        <div class="flex flex-col">
                            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; font-weight: 500; color: #292929;">
                                {app.name}
                            </span>
                            <span style="font-family: var(--ds-font-family-primary); font-size: 12px; line-height: 16px; color: #667085;">
                                {app.packageName}
                            </span>
                        </div>
                        <!-- Remove button -->
                        <button
                            type="button"
                            on:click={() => removeInstallApp(appId)}
                            style="padding: 4px; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 4L4 12M4 4L12 12" stroke="#A3A3A3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                {/if}
            {/each}
            {#if installAppSelected.length === 0}
                <span style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085; padding: 12px 0;">
                    No apps selected
                </span>
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
            style="height: 44px; min-width: 100px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
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
    <!-- Search Input -->
    <div class="w-full" style="margin-bottom: 16px;">
        <div 
            class="flex items-center"
            style="
                box-sizing: border-box;
                width: 100%;
                height: 48px;
                padding: 12px 14px;
                background: #FEFEFE;
                border: 1px solid #D6D6D6;
                border-radius: 8px;
                gap: 12px;
            "
        >
            <input
                type="text"
                placeholder="Search and select firmware"
                bind:value={updateFirmwareSearch}
                class="flex-1"
                style="
                    border: none;
                    outline: none;
                    background: transparent;
                    font-family: var(--ds-font-family-primary);
                    font-size: 16px;
                    line-height: 24px;
                    color: #292929;
                "
            />
            <Search size={22} color="#292929" />
        </div>
    </div>

    <!-- Firmware List with Radio Buttons -->
    <div class="w-full flex flex-col" style="gap: 8px;">
        {#each updateFirmwarePaginatedOptions as firmware (firmware.id)}
            {@const isSelected = updateFirmwareSelected === firmware.id}
            <button
                type="button"
                class="w-full flex flex-col hover:opacity-90 transition-opacity"
                style="
                    padding: 12px 16px;
                    border: {isSelected ? '2px solid #0BA5EC' : 'none'};
                    background: #FAFAFA;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: left;
                    gap: 4px;
                "
                on:click={() => selectFirmware(firmware.id)}
            >
                <!-- Main Row: Radio + Name/Package + Version + Size -->
                <div class="flex items-start w-full">
                    <!-- Radio Button -->
                    <div 
                        class="flex items-center justify-center flex-shrink-0"
                        style="
                            width: 20px;
                            height: 20px;
                            border-radius: 50%;
                            border: 1px solid {isSelected ? '#141414' : '#D6D6D6'};
                            background: #FFFFFF;
                            margin-right: 12px;
                            margin-top: 2px;
                        "
                    >
                        {#if isSelected}
                            <div style="width: 10px; height: 10px; border-radius: 50%; background: #141414;"></div>
                        {/if}
                    </div>
                    
                    <!-- Name + Package Name (flex: 1) -->
                    <div class="flex flex-col" style="flex: 1; min-width: 0; gap: 2px;">
                        <span style="font-family: var(--ds-font-family-primary); font-size: 16px; line-height: 24px; font-weight: 500; color: #292929;">
                            {firmware.name}
                        </span>
                        <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085;">
                            {firmware.packageName}
                        </span>
                    </div>
                    
                    <!-- Version Column (fixed width) -->
                    <div class="flex flex-col flex-shrink-0" style="width: 120px; padding-left: 16px;">
                        <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085;">
                            Version
                        </span>
                        <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #141414;">
                            {firmware.version}
                        </span>
                    </div>
                    
                    <!-- Size Column (fixed width) -->
                    <div class="flex flex-col flex-shrink-0" style="width: 100px; padding-left: 16px;">
                        <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #667085;">
                            Size
                        </span>
                        <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #141414;">
                            {firmware.size}
                        </span>
                    </div>
                </div>
                
                <!-- Created On Row -->
                <div class="flex items-center" style="padding-left: 32px;">
                    <span style="font-family: var(--ds-font-family-primary); font-size: 12px; line-height: 16px; letter-spacing: 0.01em; color: #667085;">
                        Created On: {firmware.createdOn}
                    </span>
                </div>
            </button>
        {/each}
        {#if updateFirmwarePaginatedOptions.length === 0}
            <div class="px-4 py-8 text-center" style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085; background: #FAFAFA; border-radius: 6px;">
                No firmware found
            </div>
        {/if}
    </div>

    <!-- Pagination -->
    {#if updateFirmwareFilteredOptions.length > 0}
        <div 
            class="flex items-center justify-end w-full" 
            style="
                padding: 8px 0;
                gap: 8px;
                border-top: 1px solid #EAECF0;
                margin-top: 16px;
            "
        >
            <span style="font-family: var(--ds-font-family-primary); font-size: 14px; line-height: 20px; color: #525252;">
                {(updateFirmwarePage - 1) * updateFirmwarePerPage + 1} - {Math.min(updateFirmwarePage * updateFirmwarePerPage, updateFirmwareFilteredOptions.length)} of {updateFirmwareFilteredOptions.length}
            </span>
            <div class="flex items-center" style="gap: 2px;">
                <!-- First Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = 1}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage === 1 ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 14L7 10L11 6" stroke="{updateFirmwarePage === 1 ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M15 14L11 10L15 6" stroke="{updateFirmwarePage === 1 ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <!-- Previous Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = Math.max(1, updateFirmwarePage - 1)}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage === 1 ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.5 15L7.5 10L12.5 5" stroke="{updateFirmwarePage === 1 ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <!-- Current Page -->
                <div 
                    class="flex items-center justify-center"
                    style="
                        width: 40px;
                        height: 40px;
                        background: #F9FAFB;
                        border-radius: 8px;
                    "
                >
                    <span style="font-family: var(--ds-font-family-primary); font-size: 14px; font-weight: 500; line-height: 20px; color: #1D2939;">
                        {updateFirmwarePage}
                    </span>
                </div>
                <!-- Next Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = Math.min(updateFirmwareTotalPages, updateFirmwarePage + 1)}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage >= updateFirmwareTotalPages ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.5 15L12.5 10L7.5 5" stroke="{updateFirmwarePage >= updateFirmwareTotalPages ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <!-- Last Page -->
                <button
                    type="button"
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = updateFirmwareTotalPages}
                    class="flex items-center justify-center"
                    style="
                        width: 36px;
                        height: 36px;
                        background: none;
                        border: none;
                        border-radius: 8px;
                        cursor: {updateFirmwarePage >= updateFirmwareTotalPages ? 'not-allowed' : 'pointer'};
                    "
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 14L13 10L9 6" stroke="{updateFirmwarePage >= updateFirmwareTotalPages ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M5 14L9 10L5 6" stroke="{updateFirmwarePage >= updateFirmwareTotalPages ? '#A3A3A3' : '#525252'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
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
            style="height: 44px; min-width: 100px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {updateFirmwareLoading ? 'Updating…' : 'Confirm'}
        </Button>
    </div>
</Modal>

<!-- Toast Notifications -->
{#if toasts.length > 0}
    <div class="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3">
        {#each toasts as toast (toast.id)}
            <Alert
                severity={toast.type}
                variant="filled"
                message={toast.message}
                dismissible={true}
                on:dismiss={() => dismissToast(toast.id)}
            />
        {/each}
    </div>
{/if}

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
</style>
