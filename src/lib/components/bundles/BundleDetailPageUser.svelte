<script lang="ts">
    import { goto } from '$app/navigation';
    import { invalidate } from '$app/navigation';
    import { writable } from 'svelte/store';
    import { toast } from '$lib/stores/alertToast';
    import {
        ArrowLeft,
        Trash2,
        Calendar,
        Settings,
        Settings2,
        Cpu,
        BarChart3,
        Play,
        Copy,
        Pencil,
        Download,
        Plus,
        Upload,
        HardDriveUpload,
        Info,
        X,
        Layers,
        Waves,
        PackageOpen,
        Server,
        GitFork,
        History,
        ChevronDown,
        ChevronLeft,
        ChevronRight,
        Expand,
        Search,
        Tag as TagIcon

    } from 'lucide-svelte';
    import { postV2 } from '$lib/utils/v2ApiHandler';

    // Design System
    import { Button, Badge, Card, TabGroup, Modal, Tag, Tooltip, DataTable } from '$lib/design-system/components';
    import type { ColumnDef } from '$lib/design-system/components';

    // UI Components
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";

    // Local Components
    import BundleAppsComponent from "$lib/components/bundles_ui/bundle_apps/BundleAppsComponent.svelte";
    import BundleDeviceComponent from "$lib/components/bundles_ui/bundle_device/BundleDeviceComponent.svelte";
    import BatchProgressModal from '$lib/components/bundles/BatchProgressModal.svelte';
    import DeviceSelector from '$lib/components/ui_components_sveltekit/device_profiles/DeviceSelector.svelte';

    // Utilities
    import { useBundleDetail } from '$lib/composables/useBundleDetail';
    import {
        getBundleStatusLabel,
        getBundleStatusDisplayLabel,
        getBundleStatusBadgeColor,
        getOSDisplay,
        formatBundleDate,
        formatBundleDateWithTimezone,
        formatBundleEndOn
    } from '$lib/utils/bundleUtils';
    import {
        formatUptime,
        getUsageColor,
        formatDeploymentDate,
        formatActivityLogDate,
        formatInstallDate,
        getDeploymentBadgeColor,
        getActivityLogBadgeColor,
        mapBundleStatus,
        mapActionStatus,
        formatActionDescription
    } from '$lib/utils/deviceDetailsUtils';
    import { formatBytes } from '$lib/utils/format';

    interface Props {
        // Data from server
        bundle: any;
        bundleDevices: any[];
        resources?: any[];
        
        // Configuration
        title: string;
        pageCrumbs: [string, string][];
        context: 'admin' | 'user';
        basePath: string; // "/admin/iot/bundles" or "/user/iot/bundles"
        
        // Optional features
        enableDeviceTracking?: boolean; // Admin only
        enableStopAllWaves?: boolean;    // Admin only
        /** When provided, Edit button calls this instead of navigating to edit page (e.g. open Edit modal) */
        onEditRequested?: () => void;
        /** When provided, Duplicate button calls this (e.g. open confirm modal then duplicate) */
        onDuplicateRequested?: () => void;
    }

    export let bundle: Props['bundle'];
    export let bundleDevices: Props['bundleDevices'];
    export let resources: Props['resources'] = [];
    export let title: Props['title'];
    export let pageCrumbs: Props['pageCrumbs'];
    export let context: Props['context'];
    export let basePath: Props['basePath'];
    export let enableDeviceTracking: Props['enableDeviceTracking'] = false;
    export let enableStopAllWaves: Props['enableStopAllWaves'] = false;
    export let onEditRequested: Props['onEditRequested'] = undefined;
    export let onDuplicateRequested: Props['onDuplicateRequested'] = undefined;

    // Make bundle reactive to server invalidations
    $: bundle = bundle;

    // Selected wave for device progress view
    let selectedWave: any = null;

    // Batches table pagination (design: table with #, Batch Name, Devices, Status, Started On, End On; pagination 1-10 of N)
    const BATCHES_PAGE_SIZE = 10;
    let batchesPage = 1;

    // Delete modal state
    let showDeleteModal = false;
    let deleteLoading = false;

    let publishLoading = false;

    // Devices tab modals
    let showImportCsvModal = false;
    let showViewDeviceModal = false;
    let viewDeviceTarget: any = null;
    /** Full device detail from GET /api/v2/devices/[id]/detail when modal opens (same source as Device Details page). */
    let viewDeviceDetail: any = null;
    let viewDeviceProfile: any = null;
    let viewDeviceDetailLoading = false;
    let viewDeviceActiveTab = 'details';
    let deviceComponentRef: any = null;
    let appsComponentRef: any = null;
    let importCsvFile: File | null = null;
    let importCsvProgress = 0;
    let fileInput: HTMLInputElement | null = null;

    // Assign by tag modal (same pattern as device-profiles)
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
            const res = await fetch(`/api/v2/bundles/${bundle.id}/assign-by-tag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds })
            });
            const data = await res.json().catch(() => ({}));
            const payload = data?.data ?? data;
            if (res.ok && data?.success !== false) {
                const count = payload?.assignedCount ?? 0;
                toast.success(count > 0 ? `Added ${count} device(s) to deployment by tag.` : 'No devices found with selected tags (or all are already in this deployment).');
                closeAssignByTagModal();
                invalidate('app:bundle');
            } else {
                toast.error(data?.error?.message || 'Assign by tag failed. Please try again!');
            }
        } catch {
            toast.error('Assign by tag failed. Please try again!');
        } finally {
            assignByTagLoading = false;
        }
    }

    // Add Device modal (reuse device-profiles DeviceSelector with bundleId)
    let showAddDeviceModal = false;
    let addDeviceLoading = false;
    function closeAddDeviceModal() {
        showAddDeviceModal = false;
    }
    async function onAddDeviceSelect(e: CustomEvent<{ id: string; name: string }[]>) {
        const selected = e.detail || [];
        if (selected.length === 0) return;
        addDeviceLoading = true;
        try {
            const res = await fetch(`/api/v2/bundles/${bundle.id}/devices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds: selected.map((d) => d.id) })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.success !== false) {
                const count = data?.data?.addedCount ?? selected.length;
                toast.success(count === 1 ? 'Device added successfully!' : `${count} devices added successfully!`);
                closeAddDeviceModal();
                invalidate('app:bundle');
            } else {
                toast.error(data?.error?.message || 'Unable to add device(s). Please try again!');
            }
        } catch {
            toast.error('Unable to add device(s). Please try again!');
        } finally {
            addDeviceLoading = false;
        }
    }

    // Stop waves state
    let stoppingWaves = false;

    // Batch Progress modal (opened when clicking Batch Name in Deployment Batches table)
    let showBatchProgressModal = false;
    let batchProgressWave: { id: string; name: string } | null = null;

    /** Load device detail same as Device Details page: device + deviceInformation (ClickHouse metrics). */
    async function loadViewDeviceDetail(deviceId: string) {
        viewDeviceDetailLoading = true;
        viewDeviceDetail = null;
        try {
            const res = await fetch(`/api/v2/devices/${deviceId}/detail`);
            const json = await res.json().catch(() => ({}));
            if (res.ok && json?.data) {
                const { device, deviceInformation, deviceProfile } = json.data;
                // Merge device + deviceInformation so modal shows same data as Device Details (uptime, CPU, MEM, DSK)
                viewDeviceDetail = {
                    ...device,
                    uptimeSeconds: deviceInformation?.system_uptime_seconds ?? null,
                    cpuUsage: deviceInformation?.cpu_usage ?? null,
                    memoryUsage: deviceInformation?.ram_usage ?? null,
                    diskUsage: deviceInformation?.disk_usage ?? null,
                    resolution: deviceInformation?.resolution ?? null,
                    orientation: deviceInformation?.orientation ?? null,
                    timezone: deviceInformation?.timezone ?? null
                };
                viewDeviceProfile = deviceProfile ?? null;
            }
        } catch (_) {
            viewDeviceDetail = null;
        } finally {
            viewDeviceDetailLoading = false;
        }
    }

    function handleViewDevice(event: CustomEvent<{ device: any }>) {
        viewDeviceTarget = event.detail?.device ?? null;
        viewDeviceDetail = null;
        viewDeviceProfile = null;
        viewDeviceActiveTab = 'details';
        viewDeviceApps = [];
        viewDeviceAppsLoaded = false;
        viewDeviceDeployments = [];
        viewDeviceDeploymentsLoaded = false;
        viewDeviceActivityLogs = [];
        viewDeviceActivityLogsLoaded = false;
        showViewDeviceModal = true;
        const deviceId = viewDeviceTarget?.device?.id;
        if (deviceId) loadViewDeviceDetail(deviceId);
    }

    function handleViewDeviceExpand() {
        const deviceId = viewDeviceTarget?.device?.id;
        if (!deviceId) return;
        showViewDeviceModal = false;
        viewDeviceTarget = null;
        viewDeviceDetail = null;
        viewDeviceProfile = null;
        const devicesPath = basePath.replace(/\/bundles.*$/, '') + '/devices';
        goto(`${devicesPath}/${deviceId}`);
    }

    /** Device data for View Device modal: full detail from API when loaded, else row data; profile/tags normalized. */
    $: viewDeviceDisplay = (() => {
        const row = viewDeviceTarget?.device ?? {};
        const api = viewDeviceDetail ?? {};
        const merged = { ...row, ...api };
        // API returns profileAssignment as single object (DeviceProfileAssignment?), not array
        const profileAssignment = api.profileAssignment;
        const profile = profileAssignment?.profile;
        const tagsRaw = merged.tags ?? row.tags ?? [];
        const tags = Array.isArray(tagsRaw) ? tagsRaw : [];
        // Uptime: use API value or compute from connectedAt when device is connected (GET /api/v2/devices does not return uptimeSeconds)
        const uptimeSeconds =
            merged.uptimeSeconds ?? merged.uptime ??
            (merged.connected && merged.connectedAt
                ? Math.floor((Date.now() - new Date(merged.connectedAt).getTime()) / 1000)
                : null);
        return {
            ...merged,
            uptimeSeconds,
            profileName: profile?.name ?? merged.profileName ?? merged.profile?.name,
            profileId: profile?.id ?? merged.profileId ?? merged.profile?.id,
            tags
        };
    })();

    const viewDeviceTabs = [
        { id: 'details', label: 'Details' },
        { id: 'configuration', label: 'Configuration' },
        { id: 'apps', label: 'Installed Apps' },
        { id: 'deployments', label: 'Deployments' },
        { id: 'activity', label: 'Activity Logs' }
    ];

    // Tab data (same APIs as Device Details page)
    let viewDeviceApps: any[] = [];
    let viewDeviceAppsLoading = false;
    let viewDeviceAppsLoaded = false;
    let viewDeviceAppsPage = 1;
    let viewDeviceAppsPageSize = 10;
    let viewDeviceAppsTotalCount = 0;
    let viewDeviceAppsTotalPages = 1;

    let viewDeviceDeployments: any[] = [];
    let viewDeviceDeploymentsLoading = false;
    let viewDeviceDeploymentsLoaded = false;
    let viewDeviceDeploymentsPage = 1;
    let viewDeviceDeploymentsPageSize = 10;
    let viewDeviceDeploymentsTotalCount = 0;
    let viewDeviceDeploymentsTotalPages = 1;

    let viewDeviceActivityLogs: any[] = [];
    let viewDeviceActivityLogsLoading = false;
    let viewDeviceActivityLogsLoaded = false;
    let viewDeviceActivityLogsPage = 1;
    let viewDeviceActivityLogsPageSize = 10;
    let viewDeviceActivityLogsTotalCount = 0;
    let viewDeviceActivityLogsTotalPages = 1;

    const viewDeviceId = () => viewDeviceTarget?.device?.id;

    async function loadViewDeviceApps() {
        const deviceId = viewDeviceId();
        if (!deviceId || viewDeviceAppsLoading) return;
        viewDeviceAppsLoading = true;
        try {
            const params = new URLSearchParams({ page: String(viewDeviceAppsPage), limit: String(viewDeviceAppsPageSize) });
            const res = await fetch(`/api/v2/devices/${deviceId}/apps-with-pins?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load apps');
            const result = await res.json();
            const payload = result?.data ?? result;
            const rawApps = payload.apps ?? payload.items ?? [];
            viewDeviceApps = rawApps.map((a: any) => ({
                ...a,
                app_name: a.app_name ?? a.appName,
                package_name: a.package_name ?? a.packageName,
                app_type: a.app_type ?? a.appType,
                size_bytes: a.size_bytes ?? a.sizeBytes,
                install_date: a.install_date ?? a.installDate,
                last_modified: a.last_modified ?? a.lastModified,
                is_pinned: a.isPinned ?? a.is_pinned ?? false
            }));
            viewDeviceAppsTotalCount = payload.pagination?.total ?? payload.total ?? viewDeviceApps.length;
            viewDeviceAppsTotalPages = payload.pagination?.totalPages ?? payload.totalPages ?? 1;
            viewDeviceAppsLoaded = true;
        } catch (_) {
            viewDeviceApps = [];
            viewDeviceAppsTotalCount = 0;
            viewDeviceAppsTotalPages = 1;
            viewDeviceAppsLoaded = true;
        } finally {
            viewDeviceAppsLoading = false;
        }
    }

    async function loadViewDeviceDeployments() {
        const deviceId = viewDeviceId();
        if (!deviceId || viewDeviceDeploymentsLoading) return;
        viewDeviceDeploymentsLoading = true;
        try {
            const params = new URLSearchParams({ page: String(viewDeviceDeploymentsPage), pageSize: String(viewDeviceDeploymentsPageSize) });
            const res = await fetch(`/api/devices/${deviceId}/deployments?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load deployments');
            const result = await res.json();
            if (result?.success && result?.data?.deployments) {
                viewDeviceDeployments = result.data.deployments.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    version: d.version ?? '1.0.0',
                    startedOn: d.progress?.startedAt ?? d.startedAt ?? null,
                    endedOn: d.progress?.completedAt ?? d.completedAt ?? null,
                    status: mapBundleStatus(d.deviceStatus || d.bundleStatus),
                    bundleDeviceId: d.bundleDeviceId ?? null
                }));
                viewDeviceDeploymentsTotalCount = result.data.pagination?.total ?? viewDeviceDeployments.length;
                viewDeviceDeploymentsTotalPages = result.data.pagination?.totalPages ?? 1;
            } else {
                viewDeviceDeployments = [];
                viewDeviceDeploymentsTotalCount = 0;
                viewDeviceDeploymentsTotalPages = 1;
            }
            viewDeviceDeploymentsLoaded = true;
        } catch (_) {
            viewDeviceDeployments = [];
            viewDeviceDeploymentsTotalCount = 0;
            viewDeviceDeploymentsTotalPages = 1;
            viewDeviceDeploymentsLoaded = true;
        } finally {
            viewDeviceDeploymentsLoading = false;
        }
    }

    async function loadViewDeviceActivityLogs() {
        const deviceId = viewDeviceId();
        if (!deviceId || viewDeviceActivityLogsLoading) return;
        viewDeviceActivityLogsLoading = true;
        try {
            const offset = (viewDeviceActivityLogsPage - 1) * viewDeviceActivityLogsPageSize;
            const res = await fetch(`/api/devices/${deviceId}/action-logs?limit=${viewDeviceActivityLogsPageSize}&offset=${offset}`);
            if (!res.ok) throw new Error('Failed to load activity logs');
            const result = await res.json();
            if (result?.success && result?.data?.logs) {
                viewDeviceActivityLogs = result.data.logs.map((log: any) => ({
                    id: log.id,
                    eventName: formatActivityLogDate(log.initiatedAt),
                    description: formatActionDescription(log.actionType, log.message),
                    status: mapActionStatus(log.status),
                    expanded: false,
                    details: buildViewDeviceActivityDetails(log)
                }));
                viewDeviceActivityLogsTotalCount = result.data.pagination?.total ?? viewDeviceActivityLogs.length;
                viewDeviceActivityLogsTotalPages = Math.max(1, Math.ceil(viewDeviceActivityLogsTotalCount / viewDeviceActivityLogsPageSize));
            } else {
                viewDeviceActivityLogs = [];
                viewDeviceActivityLogsTotalCount = 0;
                viewDeviceActivityLogsTotalPages = 1;
            }
            viewDeviceActivityLogsLoaded = true;
        } catch (_) {
            viewDeviceActivityLogs = [];
            viewDeviceActivityLogsTotalCount = 0;
            viewDeviceActivityLogsTotalPages = 1;
            viewDeviceActivityLogsLoaded = true;
        } finally {
            viewDeviceActivityLogsLoading = false;
        }
    }

    function buildViewDeviceActivityDetails(log: any): Array<{ label: string; newValue?: string }> {
        const details: Array<{ label: string; newValue?: string }> = [];
        if (log.durationMs) details.push({ label: 'Duration:', newValue: `${log.durationMs}ms` });
        if (log.user?.name) details.push({ label: 'Initiated by:', newValue: log.user.name });
        if (log.error) details.push({ label: 'Error:', newValue: log.error });
        return details;
    }

    function getProfileSetting(key: string, defaultValue: string = '-'): string {
        if (!viewDeviceProfile?.settings || !Array.isArray(viewDeviceProfile.settings)) return defaultValue;
        const setting = viewDeviceProfile.settings.find((s: any) => s.key === key);
        if (!setting || setting.value === null || setting.value === undefined || setting.value === '') return defaultValue;
        if (setting.dataType === 'boolean') return (setting.value === 'true' || setting.value === true) ? 'Enable' : 'Disable';
        return String(setting.value);
    }

    function getProfileSettingParsed(key: string, field: 'name' | 'package' | 'value', defaultValue: string = '-'): string {
        const value = getProfileSetting(key, '');
        if (value === '' || value === '-') return defaultValue;
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) return parsed[field] ?? defaultValue;
        } catch {
            if (field === 'value') return value;
        }
        return defaultValue;
    }

    // Load tab data when tab becomes active (same as Device Details page)
    $: if (viewDeviceActiveTab === 'apps' && viewDeviceId() && !viewDeviceAppsLoaded && !viewDeviceAppsLoading) loadViewDeviceApps();
    $: if (viewDeviceActiveTab === 'deployments' && viewDeviceId() && !viewDeviceDeploymentsLoaded && !viewDeviceDeploymentsLoading) loadViewDeviceDeployments();
    $: if (viewDeviceActiveTab === 'activity' && viewDeviceId() && !viewDeviceActivityLogsLoaded && !viewDeviceActivityLogsLoading) loadViewDeviceActivityLogs();

    const viewDeviceAppsColumns: ColumnDef<any>[] = [
        { id: 'app', header: 'App', type: 'textWithSupporting', accessor: 'app_name', supportingField: 'package_name', minWidth: '200px', sortable: false },
        { id: 'app_type', header: 'Type', type: 'text', accessor: 'app_type', width: '100px', sortable: false },
        { id: 'version', header: 'Version', type: 'text', accessor: 'version', width: '80px', sortable: false },
        { id: 'size', header: 'Size', type: 'text', accessor: (row: any) => formatBytes(row.size_bytes), width: '80px', sortable: false },
        { id: 'installed', header: 'Installed On', type: 'text', accessor: (row: any) => formatInstallDate(row.install_date || row.last_modified), width: '120px', sortable: false }
    ];

    const viewDeviceDeploymentColumns: ColumnDef<any>[] = [
        { id: 'name', header: 'Deployment Name', type: 'text', accessor: 'name', minWidth: '200px', sortable: false },
        { id: 'version', header: 'Version', type: 'text', accessor: 'version', width: '80px', sortable: false },
        { id: 'startedOn', header: 'Started On', type: 'text', accessor: (row: any) => formatDeploymentDate(row.startedOn), width: '160px', sortable: false },
        { id: 'endedOn', header: 'Ended On', type: 'text', accessor: (row: any) => formatDeploymentDate(row.endedOn), width: '160px', sortable: false },
        { id: 'status', header: 'Status', type: 'status', accessor: 'status', statusColor: (_v: any, row: any) => getDeploymentBadgeColor(row.status), width: '120px', sortable: false }
    ];

    function toggleViewDeviceActivityExpansion(logId: string) {
        viewDeviceActivityLogs = viewDeviceActivityLogs.map((log) =>
            log.id === logId ? { ...log, expanded: !log.expanded } : log
        );
    }

    function handleCsvFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input?.files?.[0];
        if (file && /\.(csv|xls|xlsx)$/i.test(file.name)) {
            importCsvFile = file;
            importCsvProgress = 100;
        }
        input.value = '';
    }

    function handleCsvDrop(e: DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file && /\.(csv|xls|xlsx)$/i.test(file.name)) {
            importCsvFile = file;
            importCsvProgress = 100;
        }
    }

    function formatImportCsvFileSize(bytes?: number): string {
        if (bytes == null) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    }

    function downloadImportCsvTemplate() {
        const headers = ['macId', 'name'];
        const sample = ['AA:BB:CC:DD:EE:FF', 'My Device'];
        const csv = [headers.join(','), sample.join(',')].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'deployment_devices_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function handleImportCsv() {
        if (!importCsvFile) return;
        try {
            // TODO: call API to import devices from CSV
            toast.success('Device imported successfully!');
            showImportCsvModal = false;
            importCsvFile = null;
            importCsvProgress = 0;
            await invalidate('app:bundle');
        } catch {
            toast.error('Unable to import Device. Please try again!');
        }
    }

    // Setup composable
    const {
        showAppSelector,
        addingApp,
        activeTab,
        appsCount,
        wavesCount,
        onlineDevicesCount,
        offlineDevicesCount,
        totalDevicesCount,
        derivedWaves,
        deviceProgressReloadToken,
        handleDeleteBundle,
        handleStopAllWaves,
        updateComputedCounts,
        updateDerivedWaves,
        setupMQTTSubscriptions
    } = useBundleDetail({
        bundleId: bundle.id,
        context,
        bundle: { 
            get: () => bundle, 
            set: (v) => bundle = v 
        },
        bundleDevices: { 
            get: () => bundleDevices 
        },
        selectedWave: { 
            get: () => selectedWave, 
            set: (v) => selectedWave = v 
        },
        enableDeviceTracking,
        enableStopAllWaves
    });

    // Reactive updates when bundle changes
    $: if (bundle?.id) {
        updateComputedCounts();
        updateDerivedWaves();
        setupMQTTSubscriptions();
    }

    function openDeleteModal() {
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
    }

    async function handleDeleteConfirm() {
        deleteLoading = true;
        try {
            await handleDeleteBundle();
            toast.success('Deployment deleted successfully.');
            closeDeleteModal();
            await invalidate('app:bundle');
            goto(basePath);
        } catch (error) {
            toast.error("Unable to delete deployment. Please try again.");
            console.error(error);
        } finally {
            deleteLoading = false;
        }
    }

    // Design: no breadcrumbs; page title + subtitle in header
    $: bundleActivePeriodDays = bundle && (bundle as Record<string, number | undefined>).activePeriodDays;

    async function handlePublish() {
        if (bundle?.status !== 'DRAFT') return;
        publishLoading = true;
        try {
            const apiPath = `/api/v2/bundles/${bundle.id}/publish`;
            await postV2(apiPath, {});
            toast.success('Deployment published successfully!');
            await invalidate('app:bundle');
        } catch (e) {
            toast.error('Failed to publish deployment. Please try again.');
        } finally {
            publishLoading = false;
        }
    }

    async function handleDuplicate() {
        try {
            const apiPath = `/api/v2/bundles/${bundle.id}/duplicate`;
            const response = await postV2(apiPath, {});
            toast.success('Bundle duplicated successfully');
            if (response?.id) {
                goto(`${basePath}/${response.id}`);
            }
            setTimeout(() => window.location.reload(), 100);
        } catch (e) {
            toast.error('Failed to duplicate bundle');
        }
    }

    // Action buttons configuration
    $: actionButtons = [
        {
            label: "Back",
            icon: ArrowLeft,
            onClick: () => goto(basePath),
            variant: "outline" as const
        },
        {
            label: "Edit",
            icon: Settings,
            onClick: () => {
                if (bundle.status !== 'DRAFT') return;
                goto(`${basePath}/${bundle.id}/edit`);
            },
            variant: bundle.status === 'DRAFT' ? 'default' as const : 'outline' as const,
            disabled: bundle.status !== 'DRAFT',
            title: bundle.status !== 'DRAFT' ? 'Not editable: bundle already published' : undefined
        },
        {
            label: "Publish",
            icon: Play,
            onClick: handlePublish,
            variant: "outline" as const,
            disabled: bundle.status !== 'DRAFT',
            title: bundle.status !== 'DRAFT' ? 'Cannot publish: bundle already published' : undefined
        },
        {
            label: "Duplicate",
            icon: Copy,
            onClick: handleDuplicate,
            variant: "outline" as const,
            title: "Create a copy of this bundle with same apps and devices"
        },
        {
            label: "Delete",
            icon: Trash2,
            onClick: openDeleteModal,
            variant: "destructive" as const
        }
    ];

    $: tabItems = [
        { id: 'devices', label: 'Devices', badge: null, disabled: false },
        { id: 'apps', label: 'Apps', badge: null, disabled: false },
        { id: 'batches', label: 'Batches', badge: $wavesCount > 0 ? $wavesCount : null, disabled: false }
    ];
    
    // Handle stop all waves from DeploymentStatusCard
    async function handleStopAllWavesFromCard() {
        if (!enableStopAllWaves || !handleStopAllWaves) return;
        stoppingWaves = true;
        try {
            await handleStopAllWaves();
            await invalidate('app:bundle');
        } catch (error) {
            console.error('Failed to stop waves:', error);
        } finally {
            stoppingWaves = false;
        }
    }
    
    // Handle view waves - switch to Batches tab
    function handleViewWaves() {
        activeTab.set('batches');
    }

    function escapeHtml(s: string): string {
        if (!s) return '';
        const div = typeof document !== 'undefined' ? document.createElement('div') : null;
        if (!div) return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        div.textContent = s;
        return div.innerHTML;
    }

    type BatchStatusColor = 'gray' | 'error' | 'warning' | 'success' | 'rose';
    function getBatchStatusColor(status: string): BatchStatusColor {
        const map: Record<string, BatchStatusColor> = {
            COMPLETED: 'success',
            IN_PROGRESS: 'warning',
            PENDING: 'gray',
            FAILED: 'error',
            ROLLED_BACK: 'warning',
            CANCELLED: 'rose'
        };
        return map[status] ?? 'gray';
    }
    function getBatchStatusLabel(status: string): string {
        const map: Record<string, string> = {
            COMPLETED: 'Completed',
            IN_PROGRESS: 'In Progress',
            PENDING: 'Pending',
            FAILED: 'Failed',
            ROLLED_BACK: 'Rolled Back',
            CANCELLED: 'Cancelled'
        };
        return map[status] ?? status;
    }

    $: batchesTotal = $derivedWaves.length;
    $: batchesTotalPages = Math.max(1, Math.ceil(batchesTotal / BATCHES_PAGE_SIZE));
    $: batchesPagination = {
        page: batchesPage,
        pageSize: BATCHES_PAGE_SIZE,
        totalItems: batchesTotal,
        totalPages: batchesTotalPages
    };
    $: batchesTableData = $derivedWaves
        .slice((batchesPage - 1) * BATCHES_PAGE_SIZE, batchesPage * BATCHES_PAGE_SIZE)
        .map((row, i) => ({ ...row, _displayIndex: (batchesPage - 1) * BATCHES_PAGE_SIZE + i + 1 }));

    const batchesTableColumns: ColumnDef<any>[] = [
        {
            id: '_displayIndex',
            header: '#',
            accessor: '_displayIndex',
            type: 'custom',
            render: (value: number) => String(value).padStart(2, '0'),
            sortable: false,
            width: '48px'
        },
        {
            id: 'name',
            header: 'Batch Name',
            accessor: 'name',
            type: 'custom',
            render: (_, row) => `<a href="javascript:void(0)" class="batches-batch-name-link">${escapeHtml(row.name || '')}</a>`,
            sortable: false
        },
        {
            id: 'devices',
            header: 'Devices',
            accessor: (row) => row.devicesTotal ?? 0,
            type: 'text',
            sortable: false,
            align: 'right'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row) => getBatchStatusLabel(row.status),
            type: 'badge',
            sortable: false,
            statusColor: (_value, row) => getBatchStatusColor(row.status),
            showDot: () => true
        },
        {
            id: 'startTime',
            header: 'Started On',
            accessor: 'startTime',
            type: 'datetime',
            sortable: false
        },
        {
            id: 'endTime',
            header: 'End On',
            accessor: 'endTime',
            type: 'datetime',
            sortable: false
        }
    ];

    function handleBatchesPageChange(e: CustomEvent<number>) {
        const page = e.detail;
        if (page >= 1 && page <= batchesTotalPages) batchesPage = page;
    }

    function handleBatchesRowClick(e: CustomEvent<{ row: any }>) {
        const wave = e.detail?.row;
        if (wave) {
            selectedWave = wave;
            batchProgressWave = { id: wave.id, name: wave.name };
            showBatchProgressModal = true;
        }
    }

    // Edit Bundle button: show when Draft | Scheduled | Failed | Stopped
    $: showDeploymentDeviceActions = ['DRAFT', 'SCHEDULED', 'FAILED', 'STOPPED'].includes((bundle?.status || '').toUpperCase());
    // Add Device and Import CSV only when status is Draft
    $: canAddOrImportDevices = (bundle?.status || '').toUpperCase() === 'DRAFT';
</script>

<div class="bundle-detail-page">
    <!-- Header: Edit + Publish when Draft | Scheduled | Failed | Stopped; Duplicate always -->
    {#if showDeploymentDeviceActions || onDuplicateRequested}
        <div class="detail-header">
            <div class="detail-actions">
                {#if showDeploymentDeviceActions}
                    <Button
                        variant="filled"
                        color="primary"
                        size="md"
                        icon={Pencil}
                        iconSize={18}
                        on:click={() => onEditRequested ? onEditRequested() : goto(`${basePath}/${bundle.id}/edit`)}
                    >
                        Edit Bundle
                    </Button>
                    <Button
                        variant="outline"
                        color="neutral"
                        size="md"
                        icon={Play}
                        iconSize={18}
                        disabled={bundle?.status !== 'DRAFT' || publishLoading}
                        loading={publishLoading}
                        title={bundle?.status !== 'DRAFT' ? 'Cannot publish: deployment already published' : undefined}
                        on:click={handlePublish}
                    >
                        Publish
                    </Button>
                {/if}
                {#if onDuplicateRequested}
                    <Button
                        variant="outline"
                        color="neutral"
                        size="md"
                        icon={Copy}
                        iconSize={18}
                        on:click={onDuplicateRequested}
                    >
                        Duplicate
                    </Button>
                {/if}
            </div>
        </div>
    {/if}

    <div class="detail-content">
        <!-- 1. Deployment Overview Card (Figma: section wrap + header with info + details + footer audit) -->
        <Card showHeader={true} padding="none" radius="2xl" fullWidth={true}>
            <svelte:fragment slot="header">
                <div class="overview-card-header">
                    <div class="overview-header-icon" aria-hidden="true">
                        <Info size={20} />
                    </div>
                    <div class="overview-header-content">
                        <h3 class="overview-card-title">Deployment Overview</h3>
                        <p class="overview-card-subtitle">Key information about this deployment</p>
                    </div>
                </div>
            </svelte:fragment>
            <div class="overview-details-wrap">
                <!-- Row 1: Deployment Name, Status, Target OS, Version -->
                <div class="overview-field">
                    <p class="overview-label">Deployment Name</p>
                    <p class="overview-value">{bundle.name || 'Unnamed Bundle'}</p>
                </div>
                <div class="overview-field">
                    <p class="overview-label">Status</p>
                    <Badge label={getBundleStatusDisplayLabel(bundle.status, bundle)} color={getBundleStatusBadgeColor(bundle.status, bundle)} showDot={true} size="md" interactive={false} />
                </div>
                <div class="overview-field">
                    <p class="overview-label">Target OS</p>
                    <p class="overview-value">{getOSDisplay(bundle.os)}</p>
                </div>
                <div class="overview-field">
                    <p class="overview-label">Version</p>
                    <p class="overview-value">{bundle.version || 'N/A'}</p>
                </div>
                <!-- Row 2: Batch Size, Start on Date & Time, End on Date & Time, (empty) -->
                <div class="overview-field">
                    <p class="overview-label">Batch Size</p>
                    <p class="overview-value">{bundle.waveSize ?? '—'}</p>
                </div>
                <div class="overview-field">
                    <p class="overview-label">Start on Date & Time</p>
                    <p class="overview-value">{bundle.scheduledAt ? formatBundleDate(bundle.scheduledAt) : '—'}</p>
                </div>
                <div class="overview-field">
                    <p class="overview-label">End on Date & Time</p>
                    <p class="overview-value">{formatBundleEndOn(bundle.scheduledAt, bundleActivePeriodDays)}</p>
                </div>
                <div class="overview-field-empty" aria-hidden="true"></div>
                <!-- Row 3: Description (full width) -->
                <div class="overview-field overview-field-full-width">
                    <p class="overview-label">Description</p>
                    <p class="overview-value">{bundle.description || '—'}</p>
                </div>
                <!-- Row 4: Reboot Device, Force Update, (empty), (empty) -->
                <div class="overview-field">
                    <p class="overview-label">Reboot Device</p>
                    <p class="overview-value">{bundle.reboot ? 'Enable' : 'Disable'}</p>
                </div>
                <div class="overview-field">
                    <p class="overview-label">Force Update</p>
                    <p class="overview-value">{bundle.forceUpdate ? 'Enable' : 'Disable'}</p>
                </div>
                <div class="overview-field-empty" aria-hidden="true"></div>
                <div class="overview-field-empty" aria-hidden="true"></div>
                <!-- Divider + Audit -->
                <div class="overview-divider"></div>
                <div class="overview-audit">
                    <p class="overview-audit-line">Created by {bundle.createdByUser?.name ?? '—'} at {bundle.createdAt ? formatBundleDate(bundle.createdAt) : '—'}</p>
                    <p class="overview-audit-line">Last updated by {bundle.updatedByUser?.name ?? '—'} at {bundle.updatedAt ? formatBundleDate(bundle.updatedAt) : '—'}</p>
                </div>
            </div>
        </Card>

        <!-- 2. Tabs: Devices | Apps | Batches (design) -->
        <div class="tabs-section">
            <TabGroup
                tabs={tabItems}
                activeTab={$activeTab}
                type="underline-filled"
                size="md"
                fullWidth={true}
                on:change={(e) => activeTab.set(e.detail)}
            />
            <div class="tabs-content">
                {#if $activeTab === 'devices'}
                    <Card showHeader={true} padding="md" radius="2xl" variant="default">
                        <svelte:fragment slot="header">
                            <div class="deployment-device-card-header">
                                <div class="deployment-device-card-title-row">
                                    <div class="deployment-device-card-icon" aria-hidden="true">
                                        <HardDriveUpload size={20} />
                                    </div>
                                    <div class="deployment-device-card-title-block">
                                        <h3 class="deployment-device-card-title">Deployment Device</h3>
                                        <p class="deployment-device-card-subtitle">Devices targeted by this deployment</p>
                                    </div>
                                </div>
                                <div class="deployment-device-card-actions">
                                    <Button
                                        variant="outline"
                                        color="primary"
                                        size="md"
                                        icon={Download}
                                        iconSize={18}
                                        disabled={!canAddOrImportDevices}
                                        title={!canAddOrImportDevices ? 'Only editable when deployment is in Draft' : undefined}
                                        on:click={() => canAddOrImportDevices && (showImportCsvModal = true)}
                                    >
                                        Import CSV
                                    </Button>
                                    <Button
                                        variant="outline"
                                        color="primary"
                                        size="md"
                                        icon={TagIcon}
                                        iconSize={18}
                                        disabled={!canAddOrImportDevices}
                                        title={!canAddOrImportDevices ? 'Only editable when deployment is in Draft' : undefined}
                                        on:click={() => canAddOrImportDevices && openAssignByTagModal()}
                                    >
                                        Assign by tag
                                    </Button>
                                    <Button
                                        variant="filled"
                                        color="primary"
                                        size="md"
                                        icon={Plus}
                                        iconSize={18}
                                        disabled={!canAddOrImportDevices}
                                        title={!canAddOrImportDevices ? 'Only editable when deployment is in Draft' : undefined}
                                        on:click={() => canAddOrImportDevices && (showAddDeviceModal = true)}
                                    >
                                        Add Device
                                    </Button>
                                </div>
                            </div>
                        </svelte:fragment>
                        <BundleDeviceComponent
                            bind:this={deviceComponentRef}
                            bundleId={bundle.id}
                            devices={bundleDevices || []}
                            loading={false}
                            apiPrefix={context === 'admin' ? '/api/admin' : '/api/user'}
                            deviceLinkPrefix={context === 'admin' ? '/admin/iot/devices' : '/user/iot/devices'}
                            hideHeaderAddButton={true}
                            showActionsColumn={canAddOrImportDevices}
                            on:viewDevice={handleViewDevice}
                        />
                    </Card>
                {:else if $activeTab === 'apps'}
                    <Card showHeader={true} padding="md" radius="2xl" variant="default">
                        <svelte:fragment slot="header">
                            <div class="deployment-apps-card-header">
                                <div class="deployment-apps-card-title-row">
                                    <div class="deployment-apps-card-icon" aria-hidden="true">
                                        <Layers size={20} />
                                    </div>
                                    <div class="deployment-apps-card-title-block">
                                        <h3 class="deployment-apps-card-title">Deployment Apps</h3>
                                        <p class="deployment-apps-card-subtitle">Manage apps included in this deployment.</p>
                                    </div>
                                </div>
                                <div class="deployment-apps-card-actions">
                                    {#if showDeploymentDeviceActions}
                                        <Button
                                            variant="filled"
                                            color="primary"
                                            size="md"
                                            icon={Plus}
                                            iconSize={18}
                                            on:click={() => appsComponentRef?.openAddDialog?.()}
                                            disabled={bundle.status !== 'DRAFT'}
                                            title={bundle.status !== 'DRAFT' ? 'Not editable: bundle already published' : undefined}
                                        >
                                            Add App
                                        </Button>
                                    {/if}
                                </div>
                            </div>
                        </svelte:fragment>
                        <BundleAppsComponent
                            bind:this={appsComponentRef}
                            bundleId={bundle.id}
                            apps={bundle.apps}
                            apiPrefix={context === 'admin' ? '/api/admin' : '/api/user'}
                            resourceLinkPrefix={context === 'admin' ? '/admin/iot/resources' : '/user/iot/resources'}
                            hideHeader={true}
                            showActionsColumn={canAddOrImportDevices}
                        />
                    </Card>
                {:else if $activeTab === 'batches'}
                    <!-- datas: row of 5 stat cards (Figma: flex row, gap 16px, height 88px; each wrap: padding 16px, gap 10px, border-radius 12px) -->
                    <div class="batches-datas">
                        <div class="batches-datas-wrap">
                            <div class="batches-datas-inner">
                                <span class="batches-datas-label">Total Batches</span>
                                <span class="batches-datas-value">{$derivedWaves.length.toString().padStart(2, '0')}</span>
                            </div>
                        </div>
                        <div class="batches-datas-wrap">
                            <div class="batches-datas-inner">
                                <span class="batches-datas-label">Batches Completed</span>
                                <span class="batches-datas-value">{$derivedWaves.filter(w => w.status === 'COMPLETED').length.toString().padStart(2, '0')}</span>
                            </div>
                        </div>
                        <div class="batches-datas-wrap">
                            <div class="batches-datas-inner">
                                <span class="batches-datas-label">Batches In-Progress</span>
                                <span class="batches-datas-value">{$derivedWaves.filter(w => w.status === 'IN_PROGRESS').length.toString().padStart(2, '0')}</span>
                            </div>
                        </div>
                        <div class="batches-datas-wrap">
                            <div class="batches-datas-inner">
                                <span class="batches-datas-label">Batches Failed</span>
                                <span class="batches-datas-value">{$derivedWaves.filter(w => w.status === 'FAILED').length.toString().padStart(2, '0')}</span>
                            </div>
                        </div>
                        <div class="batches-datas-wrap">
                            <div class="batches-datas-inner">
                                <span class="batches-datas-label">Batches Canceled</span>
                                <span class="batches-datas-value">{$derivedWaves.filter(w => w.status === 'CANCELLED').length.toString().padStart(2, '0')}</span>
                            </div>
                        </div>
                    </div>
                    <!-- Frame 34: Deployment Batches card (header: waves icon, title, info, subtitle; empty: package-open icon, "No Data Available.") -->
                    <Card showHeader={true} padding="md" radius="2xl" variant="default">
                        <svelte:fragment slot="header">
                            <div class="deployment-batches-card-header">
                                <div class="deployment-batches-card-title-row">
                                    <div class="deployment-batches-card-icon" aria-hidden="true">
                                        <Waves size={20} />
                                    </div>
                                    <div class="deployment-batches-card-title-block">
                                        <div class="deployment-batches-card-title-wrap">
                                            <h3 class="deployment-batches-card-title">Deployment Batches</h3>
                                            <Tooltip
                                                text="Batches are created automatically when a deployment is published and cannot be modified afterward."
                                                supportingText="Each batch represents a group of devices that will receive the updates. All batches have completed or been stopped. No further deployment actions are available."
                                                position="top"
                                                maxWidth={360}
                                                portal={true}
                                            >
                                                <span class="deployment-batches-info-icon" aria-hidden="true"><Info size={20} /></span>
                                            </Tooltip>
                                        </div>
                                        <p class="deployment-batches-card-subtitle">Manage deployment batches</p>
                                    </div>
                                </div>
                            </div>
                        </svelte:fragment>
                        {#if $wavesCount === 0}
                            <div class="empty-batches">
                                <span class="empty-batches-icon" aria-hidden="true"><PackageOpen size={72} /></span>
                                <p class="empty-batches-text">No Data Available.</p>
                            </div>
                        {:else}
                            <div class="batches-table-wrap">
                                <DataTable
                                    data={batchesTableData}
                                    columns={batchesTableColumns}
                                    keyField="id"
                                    paginated={batchesTotal > BATCHES_PAGE_SIZE}
                                    pagination={batchesPagination}
                                    selectable={false}
                                    hoverable={true}
                                    bordered={false}
                                    cellBorders={true}
                                    emptyMessage="No batches"
                                    on:pageChange={handleBatchesPageChange}
                                    on:rowClick={handleBatchesRowClick}
                                />
                            </div>
                        {/if}
                    </Card>
                {/if}
            </div>
        </div>
    </div>
</div>

<!-- Batch Progress modal (opened when clicking Batch Name in Deployment Batches table) -->
<BatchProgressModal
    bind:open={showBatchProgressModal}
    bundleId={bundle?.id ?? ''}
    wave={batchProgressWave}
    apiPrefix={context === 'admin' ? '/api/admin' : '/api/user'}
    reloadToken={$deviceProgressReloadToken}
    on:close={() => { batchProgressWave = null; }}
/>

<!-- Import CSV modal (Devices tab) - design: title, CSV Template + close in header; Upload File *; drag-drop zone; file selected = name + size + progress + X; Cancel / Import -->
<Modal
    open={showImportCsvModal}
    title="Import CSV"
    type="default"
    size="xl"
    cancelText="Cancel"
    confirmText="Import"
    confirmDisabled={!importCsvFile}
    on:close={() => { showImportCsvModal = false; importCsvFile = null; importCsvProgress = 0; }}
    on:confirm={handleImportCsv}
>
    <svelte:fragment slot="header-actions">
        <Button variant="outline" color="primary" size="md" icon={Download} iconSize={20} on:click={downloadImportCsvTemplate}>
            CSV Template
        </Button>
    </svelte:fragment>
    <div class="import-csv-body">
        {#if !importCsvFile}
            <p class="import-csv-label">Upload File <span class="import-csv-required" aria-hidden="true">*</span></p>
        {/if}
        <div
            class="upload-zone"
            class:has-file={!!importCsvFile}
            role="button"
            tabindex="0"
            on:click={() => fileInput?.click()}
            on:keydown={(e) => e.key === 'Enter' && fileInput?.click()}
            on:drop={handleCsvDrop}
            on:dragover|preventDefault
        >
            {#if importCsvFile}
                <div class="upload-zone-file">
                    <div class="upload-zone-file-row" role="presentation" on:click|stopPropagation>
                        <div class="upload-zone-file-info">
                            <span class="file-name">{importCsvFile.name}</span>
                            <span class="file-size">{formatImportCsvFileSize(importCsvFile.size)}</span>
                        </div>
                        <div class="upload-zone-remove-wrap">
                            <Button
                                variant="text"
                                color="primary"
                                size="sm"
                                icon={X}
                                iconPosition="only"
                                iconSize={20}
                                aria-label="Remove file"
                                on:click={() => { importCsvFile = null; importCsvProgress = 0; }}
                            />
                        </div>
                    </div>
                    <div class="upload-zone-progress">
                        <div class="upload-zone-progress-bar" style="width: {importCsvProgress}%;"></div>
                    </div>
                </div>
            {:else}
                <div class="upload-zone-empty">
                    <div class="upload-zone-icon upload-zone-icon-blue" aria-hidden="true">
                        <Upload size={24} />
                    </div>
                    <p class="upload-placeholder">Drag and drop your file here or <span class="upload-browse">Browse files</span></p>
                </div>
            {/if}
        </div>
        <input bind:this={fileInput} type="file" accept=".csv,.xls,.xlsx" class="sr-only" on:change={handleCsvFileSelect} />
        {#if !importCsvFile}
            <p class="upload-hint">Maximum file size 1 GB, acceptable file types: csv, xls, xlsx</p>
        {/if}
    </div>
</Modal>

<!-- Assign by tag modal (same pattern as device-profiles: search tags, selected chips, Add) -->
<Modal
    open={showAssignByTagModal}
    title="Assign by tag"
    size="md"
    showFooter={true}
    confirmText="Add"
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

<!-- Add Device modal (reuse device-profiles DeviceSelector – table, search, pagination, select) -->
<DeviceSelector
    open={showAddDeviceModal}
    bundleId={bundle.id}
    apiPrefix="/api/v2"
    title="Add Device"
    confirmLabel="Add"
    existingDeviceIds={bundleDevices.map(bd => bd.deviceId)}
    on:close={closeAddDeviceModal}
    on:select={onAddDeviceSelect}
/>

<!-- View Details modal (Design: "By clicking View Device action > open modal View Details; similar data as Device Details page; expand icon > open Device Details full page"). -->
<Modal
    open={showViewDeviceModal}
    title="View Details"
    type="default"
    size="xl"
    showFooter={false}
    on:close={() => { showViewDeviceModal = false; viewDeviceTarget = null; viewDeviceDetail = null; viewDeviceProfile = null; }}
>
    <svelte:fragment slot="footer">
        <div class="view-device-modal-footer">
            <Button
                variant="filled"
                color="primary"
                size="lg"
                on:click={() => { showViewDeviceModal = false; viewDeviceTarget = null; viewDeviceDetail = null; viewDeviceProfile = null; }}
            >
                Close
            </Button>
        </div>
    </svelte:fragment>
    <div slot="header-actions">
        {#if viewDeviceTarget}
            <div role="presentation" on:click|stopPropagation>
                <Button
                    variant="text"
                    color="gray"
                    size="sm"
                    icon={Expand}
                    iconPosition="only"
                    iconSize={20}
                    aria-label="Open full Device Details page"
                    on:click={handleViewDeviceExpand}
                />
            </div>
        {/if}
    </div>
    {#if viewDeviceTarget}
        {@const dev = viewDeviceDisplay}
        {@const uptimeSec = dev.uptimeSeconds ?? dev.uptime ?? null}
        {@const cpuPct = dev.cpuUsage ?? dev.cpu ?? null}
        {@const memPct = dev.memoryUsage ?? dev.mem ?? null}
        {@const dskPct = dev.diskUsage ?? dev.dsk ?? null}
        <div class="view-device-body">
            {#if viewDeviceDetailLoading}
                <p class="view-device-loading">Loading device details…</p>
            {:else}
            <div class="view-device-metrics">
                <div class="view-device-metric">
                    <span class="view-device-metric-label">Device Uptime</span>
                    <span class="view-device-metric-value view-device-metric-uptime">{formatUptime(uptimeSec)}</span>
                </div>
                <div class="view-device-metric">
                    <span class="view-device-metric-label">CPU</span>
                    <span class="view-device-metric-value" style="color: {getUsageColor(cpuPct)}">{cpuPct != null ? `${cpuPct} %` : '—'}</span>
                </div>
                <div class="view-device-metric">
                    <span class="view-device-metric-label">MEM</span>
                    <span class="view-device-metric-value" style="color: {getUsageColor(memPct)}">{memPct != null ? `${memPct} %` : '—'}</span>
                </div>
                <div class="view-device-metric">
                    <span class="view-device-metric-label">DSK</span>
                    <span class="view-device-metric-value" style="color: {getUsageColor(dskPct)}">{dskPct != null ? `${dskPct} %` : '—'}</span>
                </div>
            </div>
            <TabGroup
                tabs={viewDeviceTabs}
                activeTab={viewDeviceActiveTab}
                type="underline-filled"
                size="md"
                on:change={(e) => { viewDeviceActiveTab = e.detail ?? 'details'; }}
            />
            {#if viewDeviceActiveTab === 'details'}
                <div class="view-device-details-grid">
                    <Card showHeader={true} padding="none" radius="2xl" fullWidth={true}>
                        <svelte:fragment slot="header">
                            <div class="view-device-card-header">
                                <div class="view-device-card-icon" aria-hidden="true"><Info size={20} /></div>
                                <div class="view-device-card-heading">
                                    <h4 class="view-device-card-title">Device Information</h4>
                                    <p class="view-device-card-subtitle">General details and identification information.</p>
                                </div>
                            </div>
                        </svelte:fragment>
                        <div class="view-device-card-body">
                            <div class="view-device-row">
                                <span class="view-device-label">Device State</span>
                                <Badge label={dev.connected ? 'Active' : 'Inactive'} color={dev.connected ? 'success' : 'gray'} variant="filled" size="sm" showDot={true} />
                            </div>
                            <div class="view-device-row">
                                <span class="view-device-label">Device Name</span>
                                <span class="view-device-value">{dev.name ?? '—'}</span>
                            </div>
                            <div class="view-device-row">
                                <span class="view-device-label">Assigned Profile</span>
                                {#if dev.profileName && dev.profileId}
                                    <a href="{basePath.replace(/\/bundles.*$/, '')}/device-profiles/{dev.profileId}" class="view-device-link">{dev.profileName}</a>
                                {:else if dev.profileName}
                                    <span class="view-device-value">{dev.profileName}</span>
                                {:else}
                                    <span class="view-device-value">None</span>
                                {/if}
                            </div>
                            <div class="view-device-row view-device-description">
                                <span class="view-device-label">Description</span>
                                <p class="view-device-desc-text">{dev.description ?? 'No description provided.'}</p>
                            </div>
                            {#if dev.tags && dev.tags.length > 0}
                                <div class="view-device-tags">
                                    {#each dev.tags as tag}
                                        <Tag label={typeof tag === 'string' ? tag : (tag?.name ?? tag)} size="sm" />
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </Card>
                    <Card showHeader={true} padding="none" radius="2xl" fullWidth={true}>
                        <svelte:fragment slot="header">
                            <div class="view-device-card-header">
                                <div class="view-device-card-icon" aria-hidden="true"><Cpu size={20} /></div>
                                <div class="view-device-card-heading">
                                    <h4 class="view-device-card-title">Technical Details</h4>
                                    <p class="view-device-card-subtitle">Hardware, OS and firmware information.</p>
                                </div>
                            </div>
                        </svelte:fragment>
                        <div class="view-device-card-body">
                            <div class="view-device-row">
                                <span class="view-device-label">OS Version</span>
                                <span class="view-device-value">{dev.osVersion ?? dev.os_version ?? 'N/A'}</span>
                            </div>
                            <div class="view-device-row">
                                <span class="view-device-label">Firmware</span>
                                <span class="view-device-value">{dev.firmwareVersion ?? dev.firmware ?? 'N/A'}</span>
                            </div>
                            <div class="view-device-row">
                                <span class="view-device-label">Model</span>
                                <span class="view-device-value">{dev.model ?? 'N/A'}</span>
                            </div>
                            <div class="view-device-row">
                                <span class="view-device-label">Operating System</span>
                                <span class="view-device-value">{dev.deviceType ?? dev.os ?? 'N/A'}</span>
                            </div>
                            <div class="view-device-row">
                                <span class="view-device-label">Manufacturer</span>
                                <span class="view-device-value">{dev.manufacturer ?? '—'}</span>
                            </div>
                            <div class="view-device-row">
                                <span class="view-device-label">Hardware ID</span>
                                <span class="view-device-value">{dev.hardwareId ?? '—'}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            {:else if viewDeviceActiveTab === 'configuration'}
                <Card showHeader={true} padding="none" radius="2xl" fullWidth={true}>
                    <svelte:fragment slot="header">
                        <div class="view-device-card-header">
                            <div class="view-device-card-icon" aria-hidden="true"><Settings2 size={20} /></div>
                            <div class="view-device-card-heading">
                                <h4 class="view-device-card-title">Device Configuration</h4>
                                <p class="view-device-card-subtitle">Configuration setup of this device (same as Device Details).</p>
                            </div>
                        </div>
                    </svelte:fragment>
                    <div class="view-device-card-body">
                        {#if viewDeviceProfile}
                            <!-- Same layout as Device Details: config-table-wrap > config-row > label-cell (cell-title + cell-desc) + value-cell (cell-value) -->
                            <div class="view-device-config-wrap">
                                <!-- Kiosk Settings Section -->
                                <div class="config-table-wrap">
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Kiosk Lock Mode</span>
                                                <span class="cell-desc">Enable kiosk mode to lock the device interface</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSetting('kiosk_lock_mode', 'Disable')}</span>
                                        </div>
                                    </div>
                                    <div class="config-row last">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Kiosk Application</span>
                                                <span class="cell-desc">Application to run in kiosk mode</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <div class="cell-content">
                                                {#if true}
                                                    {@const kioskName = getProfileSettingParsed('kiosk_application', 'name', '-')}
                                                    {@const kioskPkg = getProfileSettingParsed('kiosk_application', 'package', '-')}
                                                    <span class="cell-value">{kioskName}</span>
                                                    {#if kioskPkg && kioskPkg !== '-'}
                                                        <span class="cell-desc">{kioskPkg}</span>
                                                    {/if}
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <!-- Display Settings Section -->
                                <div class="config-table-wrap">
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Display Resolution</span>
                                                <span class="cell-desc">Screen resolution for device</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSetting('display_resolution', dev.resolution ?? '—')}</span>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Screen Orientation</span>
                                                <span class="cell-desc">Screen orientation preference</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSetting('screen_orientation', dev.orientation ?? '—')}</span>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Brightness Level</span>
                                                <span class="cell-desc">Screen brightness level (0-100%)</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSetting('brightness_level', '—')}{getProfileSetting('brightness_level', '') ? '%' : ''}</span>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Audio</span>
                                                <span class="cell-desc">Enable or disable audio output</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSetting('enable_audio', '—')}</span>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Audio Volume</span>
                                                <span class="cell-desc">Audio volume level (0-100%)</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSetting('volume_level', '—')}{getProfileSetting('volume_level', '') ? '%' : ''}</span>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Timezone</span>
                                                <span class="cell-desc">Device timezone settings</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSetting('timezone', dev.timezone ?? '—')}</span>
                                        </div>
                                    </div>
                                    <div class="config-row last">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Home/ Launcher</span>
                                                <span class="cell-desc">Default home screen launcher</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{getProfileSettingParsed('home_launcher', 'value', '—')}</span>
                                        </div>
                                    </div>
                                </div>
                                <!-- Schedule Settings Section -->
                                <div class="config-table-wrap">
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Power Management Schedule</span>
                                                <span class="cell-desc">Enable scheduled power on/off times</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{viewDeviceProfile?.powerScheduleEnabled ? 'Enable' : 'Disable'}</span>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Reboot Schedule</span>
                                                <span class="cell-desc">Enable scheduled device reboots</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{viewDeviceProfile?.rebootScheduleEnabled ? 'Enable' : 'Disable'}</span>
                                        </div>
                                    </div>
                                    <div class="config-row last">
                                        <div class="config-cell label-cell">
                                            <div class="cell-content">
                                                <span class="cell-title">Download Schedule</span>
                                                <span class="cell-desc">Enable scheduled content downloads</span>
                                            </div>
                                        </div>
                                        <div class="config-cell value-cell">
                                            <span class="cell-value">{viewDeviceProfile?.downloadScheduleEnabled ? 'Enable' : 'Disable'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <p class="view-device-tab-placeholder">No profile assigned. Open full Device Details to edit.</p>
                        {/if}
                    </div>
                </Card>
            {:else if viewDeviceActiveTab === 'apps'}
                <Card showHeader={true} padding="none" radius="2xl" fullWidth={true}>
                    <svelte:fragment slot="header">
                        <div class="view-device-card-header">
                            <div class="view-device-card-icon" aria-hidden="true"><Server size={20} /></div>
                            <div class="view-device-card-heading">
                                <h4 class="view-device-card-title">Installed Apps</h4>
                                <p class="view-device-card-subtitle">List of installed apps (same as Device Details).</p>
                            </div>
                        </div>
                    </svelte:fragment>
                    <div class="view-device-card-body">
                        {#if viewDeviceAppsLoading}
                            <p class="view-device-loading">Loading apps…</p>
                        {:else if viewDeviceApps.length === 0}
                            <p class="view-device-tab-placeholder">No apps installed on this device.</p>
                        {:else}
                            <DataTable
                                columns={viewDeviceAppsColumns}
                                data={viewDeviceApps}
                                keyField="package_name"
                                sortable={false}
                                paginated={true}
                                pagination={{ page: viewDeviceAppsPage, pageSize: viewDeviceAppsPageSize, totalItems: viewDeviceAppsTotalCount, totalPages: viewDeviceAppsTotalPages }}
                                on:pageChange={(e) => { viewDeviceAppsPage = e.detail; loadViewDeviceApps(); }}
                                loading={viewDeviceAppsLoading}
                                emptyMessage="No apps installed"
                                compact={true}
                                bordered={false}
                                cellBorders={false}
                            />
                        {/if}
                    </div>
                </Card>
            {:else if viewDeviceActiveTab === 'deployments'}
                <Card showHeader={true} padding="none" radius="2xl" fullWidth={true}>
                    <svelte:fragment slot="header">
                        <div class="view-device-card-header">
                            <div class="view-device-card-icon" aria-hidden="true"><GitFork size={20} /></div>
                            <div class="view-device-card-heading">
                                <h4 class="view-device-card-title">Bulk Deployments</h4>
                                <p class="view-device-card-subtitle">Deployments for this device (same as Device Details).</p>
                            </div>
                        </div>
                    </svelte:fragment>
                    <div class="view-device-card-body">
                        {#if viewDeviceDeploymentsLoading}
                            <p class="view-device-loading">Loading deployments…</p>
                        {:else if viewDeviceDeployments.length === 0}
                            <p class="view-device-tab-placeholder">No deployments found for this device.</p>
                        {:else}
                            <DataTable
                                columns={viewDeviceDeploymentColumns}
                                data={viewDeviceDeployments}
                                keyField="id"
                                sortable={false}
                                paginated={true}
                                pagination={{ page: viewDeviceDeploymentsPage, pageSize: viewDeviceDeploymentsPageSize, totalItems: viewDeviceDeploymentsTotalCount, totalPages: viewDeviceDeploymentsTotalPages }}
                                on:pageChange={(e) => { viewDeviceDeploymentsPage = e.detail; loadViewDeviceDeployments(); }}
                                loading={viewDeviceDeploymentsLoading}
                                emptyMessage="No deployments"
                                compact={true}
                                bordered={false}
                                cellBorders={false}
                            />
                        {/if}
                    </div>
                </Card>
            {:else if viewDeviceActiveTab === 'activity'}
                <Card showHeader={true} padding="none" radius="2xl" fullWidth={true}>
                    <svelte:fragment slot="header">
                        <div class="view-device-card-header">
                            <div class="view-device-card-icon" aria-hidden="true"><History size={20} /></div>
                            <div class="view-device-card-heading">
                                <h4 class="view-device-card-title">Activity Logs</h4>
                                <p class="view-device-card-subtitle">History of actions performed on this device (same as Device Details).</p>
                            </div>
                        </div>
                    </svelte:fragment>
                    <div class="view-device-card-body">
                        {#if viewDeviceActivityLogsLoading}
                            <p class="view-device-loading">Loading activity logs…</p>
                        {:else if viewDeviceActivityLogs.length === 0}
                            <p class="view-device-tab-placeholder">No activity logs found.</p>
                        {:else}
                            <!-- Activity Logs: same table layout as Device Detail page (Date & Time, Action Type, Status) -->
                            <div class="view-device-activity-table-wrap">
                                <div class="view-device-activity-table-header">
                                    <div class="view-device-activity-header-cell view-device-activity-col-expand">
                                        <ChevronRight size={20} class="view-device-activity-header-icon" aria-hidden="true" />
                                    </div>
                                    <div class="view-device-activity-header-cell view-device-activity-col-event">
                                        <span class="view-device-activity-header-text">Date & Time</span>
                                    </div>
                                    <div class="view-device-activity-header-cell view-device-activity-col-description">
                                        <span class="view-device-activity-header-text">Action Type</span>
                                    </div>
                                    <div class="view-device-activity-header-cell view-device-activity-col-status">
                                        <span class="view-device-activity-header-text">Status</span>
                                    </div>
                                </div>
                                {#each viewDeviceActivityLogs as log (log.id)}
                                    <div class="view-device-activity-row" class:expanded={log.expanded}>
                                        <div class="view-device-activity-cell view-device-activity-col-expand">
                                            <Button variant="text" color="gray" size="sm" icon={log.expanded ? ChevronDown : ChevronRight} iconPosition="only" disabled={!log.details?.length} on:click={() => toggleViewDeviceActivityExpansion(log.id)} />
                                        </div>
                                        <div class="view-device-activity-cell view-device-activity-col-event">
                                            <span class="view-device-activity-event-name">{log.eventName}</span>
                                        </div>
                                        <div class="view-device-activity-cell view-device-activity-col-description">
                                            <span class="view-device-activity-description-text">{log.description}</span>
                                        </div>
                                        <div class="view-device-activity-cell view-device-activity-col-status">
                                            <Badge label={log.status} color={getActivityLogBadgeColor(log.status)} variant="filled" size="sm" showDot={true} interactive={false} />
                                        </div>
                                    </div>
                                    {#if log.expanded && log.details?.length}
                                        <div class="view-device-activity-details-row">
                                            <div class="view-device-activity-details-spacer"></div>
                                            <div class="view-device-activity-details-divider">
                                                <div class="view-device-activity-divider-line"></div>
                                            </div>
                                            <div class="view-device-activity-details-content">
                                                {#each log.details as d}
                                                    <div class="view-device-activity-detail-item"><span class="view-device-activity-detail-label">{d.label}</span> <span class="view-device-value">{d.newValue ?? '—'}</span></div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                            <div class="view-device-activity-pagination">
                                <span class="view-device-activity-pagination-details">{((viewDeviceActivityLogsPage - 1) * viewDeviceActivityLogsPageSize) + 1} - {Math.min(viewDeviceActivityLogsPage * viewDeviceActivityLogsPageSize, viewDeviceActivityLogsTotalCount)} of {viewDeviceActivityLogsTotalCount}</span>
                                <div class="view-device-activity-pagination-controls">
                                    <Button variant="ghost" color="gray" size="sm" icon={ChevronLeft} iconPosition="only" disabled={viewDeviceActivityLogsPage <= 1} on:click={() => { viewDeviceActivityLogsPage = Math.max(1, viewDeviceActivityLogsPage - 1); loadViewDeviceActivityLogs(); }} />
                                    <div class="view-device-activity-page-number">{viewDeviceActivityLogsPage}</div>
                                    <Button variant="ghost" color="gray" size="sm" icon={ChevronRight} iconPosition="only" disabled={viewDeviceActivityLogsPage >= viewDeviceActivityLogsTotalPages} on:click={() => { viewDeviceActivityLogsPage = Math.min(viewDeviceActivityLogsTotalPages, viewDeviceActivityLogsPage + 1); loadViewDeviceActivityLogs(); }} />
                                </div>
                            </div>
                        {/if}
                    </div>
                </Card>
            {:else}
                <p class="view-device-tab-placeholder">Content for {viewDeviceTabs.find(t => t.id === viewDeviceActiveTab)?.label ?? viewDeviceActiveTab} — open full Device Details page for more.</p>
            {/if}
            {/if}
        </div>
    {/if}
</Modal>

<Modal
    open={showDeleteModal}
    title="Delete Deployment"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={handleDeleteConfirm}
>
    <p class="delete-confirm-text">Are you sure you want to delete this deployment? This action cannot be undone.</p>
</Modal>

<style>
    .bundle-detail-page {
        padding: var(--ds-space-6);
        font-family: var(--ds-font-family-primary);
    }
    
    .detail-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: var(--ds-space-4);
        margin-bottom: var(--ds-space-6);
    }

    .detail-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-2);
    }
    
    .detail-content {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-6);
    }
    
    /* Deployment Overview Card (Figma: design tokens) */
    .overview-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-space-4);
        gap: var(--ds-space-2);
        border-bottom: 1px solid var(--ds-color-neutral-true-200);
        box-sizing: border-box;
    }

    .overview-header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
        color: var(--ds-color-neutral-true-400);
        flex-shrink: 0;
    }

    .overview-header-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .overview-card-title {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-lg);
        font-weight: var(--ds-font-medium);
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }

    .overview-card-subtitle {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-gray-600);
        margin: 0;
    }

    .overview-details-wrap {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        padding: var(--ds-space-4);
        gap: var(--ds-space-4) var(--ds-space-6);
        box-sizing: border-box;
    }

    .overview-field {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ds-space-1);
        min-width: 0;
    }

    .overview-field-full-width {
        grid-column: 1 / -1;
    }

    .overview-field-empty {
        min-width: 0;
    }

    .overview-label {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }

    .overview-value {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-md);
        font-weight: var(--ds-font-medium);
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }

    .overview-muted {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }

    .overview-divider {
        grid-column: 1 / -1;
        width: 100%;
        height: 0;
        border-top: 1px solid var(--ds-color-neutral-true-200);
    }

    .overview-audit {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ds-space-1);
    }

    .overview-audit-line {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-xs);
        font-weight: var(--ds-font-regular);
        line-height: 16px;
        letter-spacing: 0.01em;
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }

    /* Deployment Device card header (Figma: padding 8px 0, gap 8px; icon 20px, title 18px medium #141414, subtitle 14px #475467) */
    .deployment-device-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        width: 100%;
        padding: var(--ds-space-2) 0;
        box-sizing: border-box;
    }
    .deployment-device-card-title-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        min-width: 0;
        flex: 1;
    }
    .deployment-device-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-color-neutral-true-400);
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
        box-sizing: border-box;
    }
    .deployment-device-card-title-block {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .deployment-device-card-title {
        font-family: var(--ds-font-family-primary);
        font-size: 18px;
        font-weight: 500;
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }
    .deployment-device-card-subtitle {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-text-secondary);
        margin: 0;
    }
    .deployment-device-card-actions {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        flex-shrink: 0;
    }

    /* Deployment Apps card header (Figma Frame 34: padding 8px 0, gap 8px; icon 44x44 radius 8px; title 18px medium #141414; subtitle 14px #475467; Add App button) */
    .deployment-apps-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        width: 100%;
        padding: var(--ds-space-2) 0;
        box-sizing: border-box;
    }
    .deployment-apps-card-title-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        min-width: 0;
        flex: 1;
    }
    .deployment-apps-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-color-neutral-true-400);
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
        box-sizing: border-box;
    }
    .deployment-apps-card-title-block {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .deployment-apps-card-title {
        font-family: var(--ds-font-family-primary);
        font-size: 18px;
        font-weight: 500;
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }
    .deployment-apps-card-subtitle {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-text-secondary);
        margin: 0;
    }
    .deployment-apps-card-actions {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        flex-shrink: 0;
    }

    @media (max-width: 768px) {
        .overview-details-wrap {
            grid-template-columns: 1fr;
        }
        .overview-field-full-width {
            grid-column: 1;
        }
    }
    
    /* Device Status */
    
    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ds-color-gray-400);
        flex-shrink: 0;
    }
    
    .status-dot.online {
        background: var(--ds-color-success-500);
    }
    
    /* Overview Section */
    .overview-section {
        margin-top: var(--ds-space-4);
        padding-top: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-default);
    }
    
    .scheduled-row {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }
    
    .scheduled-row :global(svg) {
        width: 16px;
        height: 16px;
        color: var(--ds-text-secondary);
        flex-shrink: 0;
    }
    
    .scheduled-tz {
        margin-left: var(--ds-space-6);
        margin-top: var(--ds-space-2);
    }
    
    .font-mono {
        font-family: ui-monospace, monospace;
    }
    
    /* Tabs Section */
    .tabs-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
    
    .tabs-content {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4); /* 16px per design between sections (e.g. batches-datas and Deployment Batches card) */
    }
    
    /* Empty State */
    .empty-waves {
        padding: var(--ds-space-8);
        text-align: center;
        color: var(--ds-text-secondary);
    }
    
    .empty-waves :global(svg) {
        width: 48px;
        height: 48px;
        margin: 0 auto var(--ds-space-4);
        opacity: 0.5;
        color: var(--ds-text-tertiary);
    }
    
    .empty-title {
        font-size: var(--ds-text-lg);
        font-weight: var(--ds-font-medium);
        margin-bottom: var(--ds-space-2);
        color: var(--ds-text-primary);
    }
    
    .empty-desc {
        font-size: var(--ds-text-sm);
        margin: 0;
    }
    
    .delete-confirm-text {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }

    .audit-section {
        margin-top: var(--ds-space-4);
    }

    .audit-line {
        font-size: var(--ds-text-sm);
        margin: var(--ds-space-1) 0 0 0;
    }

    /* Batches datas row (Figma: flex row, gap 16px, height 88px; each wrap: padding 16px, gap 10px, border-radius 12px, label 14px #525252, value 20px 600 #141414) */
    .batches-datas {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-4);
        padding: 0;
        height: 88px;
        flex: none;
        align-self: stretch;
    }

    .batches-datas-wrap {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: var(--ds-space-4);
        gap: 10px;
        flex: 1;
        min-width: 0;
        height: 88px;
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-color-neutral-true-200);
        border-radius: 12px;
    }

    .batches-datas-inner {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 4px;
        width: 100%;
    }

    .batches-datas-label {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }

    .batches-datas-value {
        font-family: var(--ds-font-family-primary);
        font-weight: 600;
        font-size: 20px;
        line-height: 28px;
        letter-spacing: 0.0025em;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }

    /* Deployment Batches card header (Figma: waves icon 44x44, title 18px medium, info icon, subtitle 14px #475467) */
    .deployment-batches-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        width: 100%;
        padding: var(--ds-space-2) 0;
        box-sizing: border-box;
    }

    .deployment-batches-card-title-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        min-width: 0;
        flex: 1;
    }

    .deployment-batches-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-color-neutral-true-400);
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
        box-sizing: border-box;
    }

    .deployment-batches-card-title-block {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .deployment-batches-card-title-wrap {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 10px;
    }

    .deployment-batches-card-title {
        font-family: var(--ds-font-family-primary);
        font-size: 18px;
        font-weight: 500;
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }

    .deployment-batches-info-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-color-primary-600);
        flex-shrink: 0;
    }

    .deployment-batches-card-subtitle {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-text-secondary);
        margin: 0;
    }

    /* Empty Batches state (Figma: package-open 72x72, "No Data Available." 12px italic #A3A3A3) */
    .empty-batches {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 0;
        gap: var(--ds-space-4);
    }

    .empty-batches-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        color: var(--ds-color-neutral-true-300);
    }

    .empty-batches-text {
        font-family: var(--ds-font-family-primary);
        font-size: 12px;
        font-weight: var(--ds-font-regular);
        font-style: italic;
        line-height: 16px;
        letter-spacing: 0.01em;
        text-align: center;
        color: var(--ds-color-neutral-true-400);
        margin: 0;
    }

    /* Deployment Batches table (design: header #F9FAFB, no vertical borders; Batch Name = blue link) */
    .batches-table-wrap {
        font-family: var(--ds-font-family-primary);
    }
    .batches-table-wrap :global(thead th) {
        background: var(--ds-bg-secondary);
    }
    .batches-table-wrap :global(.batches-batch-name-link) {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-color-blue-light-600);
        text-decoration: none;
    }
    .batches-table-wrap :global(.batches-batch-name-link:hover) {
        text-decoration: underline;
    }

    /* Assign by tag modal – search + selected chips (same as device-profiles) */
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

    /* Import CSV modal body – full width; Figma: padding 16px, gap 16px (modal body provides padding) */
    .import-csv-body {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
        width: 100%;
        min-width: 0;
    }

    /* Label: 14px regular #525252; asterisk: 12px #D92D20 */
    .import-csv-label {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }
    .import-csv-required {
        font-size: var(--ds-text-xs);
        font-weight: var(--ds-font-regular);
        line-height: 16px;
        letter-spacing: 0.01em;
        color: var(--ds-color-error-600);
    }

    /* Drag & drop area – Figma: 1px dashed #0086C9, 8px radius, 16px padding, 8px gap, min-height 100px */
    .upload-zone {
        box-sizing: border-box;
        border: 1px dashed var(--ds-color-blue-light-600);
        border-radius: var(--ds-radius-lg);
        padding: var(--ds-space-4);
        text-align: center;
        cursor: pointer;
        min-height: 100px;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        background: var(--ds-color-white);
        transition: border-color 0.2s, background 0.2s;
    }

    .upload-zone.has-file {
        border: none;
        justify-content: flex-start;
        align-items: flex-start;
        text-align: left;
        min-height: 88px;
    }

    .upload-zone:hover {
        border-color: var(--ds-color-blue-light-500);
        background: var(--ds-bg-secondary);
    }

    .upload-zone.has-file:hover {
        border: none;
    }

    .upload-zone-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--ds-space-2);
        width: 100%;
    }

    /* Icon wrapper – Figma: 40x40, #F0F9FF, border-radius 100px, padding 8px */
    .upload-zone-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-full);
        flex-shrink: 0;
    }

    .upload-zone-icon-blue {
        background: var(--ds-color-blue-light-50);
        color: var(--ds-color-blue-light-600);
    }

    /* "Drag and drop your file here or" – 14px medium #424242 */
    .upload-placeholder {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        line-height: 20px;
        color: var(--ds-color-neutral-true-700);
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 4px;
    }

    /* "Browse files" – 14px medium #0086C9 */
    .upload-browse {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        line-height: 20px;
        color: var(--ds-color-blue-light-600);
        cursor: pointer;
    }

    /* File selected state – Figma: row 36px (name + size + remove), progress bar below */
    .upload-zone-file {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        align-items: flex-start;
        text-align: left;
    }

    .upload-zone-file-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        width: 100%;
        min-height: 36px;
    }

    .upload-zone-file-info {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        min-width: 0;
        flex: 1;
    }

    /* File name – Figma: 14px regular #292929 (Neutral True/800) */
    .file-name {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-800);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Size – Figma: 14px regular #737373 (Neutral True/500) */
    .file-size {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-500);
        flex: 1;
        min-width: 0;
        text-align: right;
    }

    /* Progress track – full width below file row; 6px height for visibility */
    .upload-zone-progress {
        width: 100%;
        height: 6px;
        background: var(--ds-color-progress-bg);
        border-radius: var(--ds-radius-sm);
        overflow: hidden;
    }

    /* Progress bar – success green when complete */
    .upload-zone-progress-bar {
        height: 100%;
        min-width: 2px;
        background: var(--ds-color-progress-success);
        border-radius: var(--ds-radius-sm);
        transition: width 0.2s ease;
    }

    /* Remove button – Figma: 36x36, icon blue (primary) */
    .upload-zone-remove-wrap {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .upload-zone-remove-wrap :global(button),
    .upload-zone-remove-wrap :global(button svg) {
        color: var(--ds-color-blue-light-600);
    }
    .upload-zone-remove-wrap :global(button:hover) {
        background: var(--ds-color-blue-light-50);
    }
    .upload-zone-remove-wrap :global(button) {
        width: 36px;
        height: 36px;
        min-width: 36px;
        min-height: 36px;
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-lg);
    }
    .upload-zone-remove-wrap :global(svg) {
        color: var(--ds-color-blue-light-700);
    }

    /* Sub-caption – Figma: 14px regular #737373 */
    .upload-hint {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-500);
        margin: 0;
    }

    /* View Device body: Figma body 798px, padding 16px, gap 16px */
    .view-device-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        width: 100%;
    }

    /* details wrap (Figma): row, padding 16px, gap 16px, height 94px, align-items center */
    .view-device-metrics {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 16px;
        width: 100%;
        min-height: 94px;
        flex: none;
        align-self: stretch;
        flex-grow: 0;
        z-index: 0;
    }

    /* Text Display (each metric): column, gap 6px, flex-grow 1, ~192px (Figma) */
    .view-device-metric {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 6px;
        flex: 1 1 0;
        min-width: 0;
    }

    /* Base/Sub-Title: Label row height 24px (Figma) */
    .view-device-metric-label {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: var(--ds-font-regular);
        font-size: 14px;
        line-height: 20px;
        display: flex;
        align-items: center;
        color: var(--ds-color-neutral-true-600);
        min-height: 24px;
    }

    /* Value: Heading/H2 26px/32px, letter-spacing -0.005em (Figma) */
    .view-device-metric-value {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: 600;
        font-size: 26px;
        line-height: 32px;
        display: flex;
        align-items: center;
        letter-spacing: -0.005em;
        color: var(--ds-text-primary);
    }

    /* Device Uptime value: Purple 3/700 #6941C6 (Figma) */
    .view-device-metric-uptime {
        color: var(--ds-color-purple-700);
    }

    .view-device-modal-footer {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    /* section wrap: border 1px E5E5E5, border-radius 16px (Figma) */
    .view-device-details-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--ds-space-4);
        width: 100%;
    }

    /* section header: padding 16px, gap 8px, border-bottom E5E5E5 (Figma) */
    .view-device-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-4);
        border-bottom: 1px solid var(--ds-color-neutral-true-200);
    }

    .view-device-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
        color: var(--ds-color-neutral-true-400);
        flex-shrink: 0;
    }

    .view-device-card-heading {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .view-device-card-title {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-lg);
        font-weight: var(--ds-font-medium);
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        margin: 0;
    }

    /* Supporting text: Body/14px/14-Regular, Gray/600 #475467 (Figma) */
    .view-device-card-subtitle {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-gray-600);
        margin: 0;
    }

    .view-device-card-body {
        padding: var(--ds-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
    }

    /* Text Display: row, justify-content space-between for label + value (Figma) */
    .view-device-row {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: var(--ds-space-4);
    }

    .view-device-row.view-device-description {
        flex-direction: column;
        align-items: flex-start;
    }

    .view-device-row.view-device-description .view-device-desc-text {
        margin: 0;
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-color-neutral-true-900);
        line-height: 1.5;
    }

    /* Label: Body/14px/14-Regular, Neutral True/600 (Figma) */
    .view-device-label {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        line-height: 20px;
        color: var(--ds-color-neutral-true-600);
    }

    /* Value: Body/16px/16-Medium, Neutral True/900 or link (Figma) */
    .view-device-value {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-md);
        font-weight: var(--ds-font-medium);
        line-height: 24px;
        color: var(--ds-color-neutral-true-900);
        text-align: right;
    }

    .view-device-link {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-blue-light-600);
        text-decoration: none;
    }

    .view-device-link:hover {
        text-decoration: underline;
    }

    .view-device-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
    }

    .view-device-tab-placeholder {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-tertiary);
        padding: var(--ds-space-4);
        margin: 0;
    }

    .view-device-loading {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-tertiary);
        padding: var(--ds-space-4);
        margin: 0;
    }

    /* Configuration tab: same layout as Device Details (config-table-wrap, config-row, label-cell + value-cell) */
    .view-device-config-wrap {
        width: 100%;
    }
    .view-device-config-wrap .config-table-wrap {
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
    .view-device-config-wrap .config-table-wrap:last-child {
        margin-bottom: 0;
    }
    .view-device-config-wrap .config-table-wrap .config-row.last .config-cell:first-child {
        border-bottom-left-radius: var(--ds-radius-lg);
    }
    .view-device-config-wrap .config-table-wrap .config-row.last .config-cell:last-child {
        border-bottom-right-radius: var(--ds-radius-lg);
    }
    .view-device-config-wrap .config-row {
        display: grid;
        grid-template-columns: minmax(180px, 1fr) minmax(120px, 320px);
        align-items: stretch;
        padding: 0;
        width: 100%;
        min-height: 56px;
    }
    .view-device-config-wrap .config-row:not(.last) .config-cell {
        border-bottom: 1px solid var(--ds-border-default);
    }
    .view-device-config-wrap .config-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-4);
        min-height: 56px;
        overflow: hidden;
    }
    .view-device-config-wrap .config-cell.label-cell {
        min-width: 0;
    }
    .view-device-config-wrap .config-cell.value-cell {
        min-width: 0;
        align-items: center;
    }
    .view-device-config-wrap .config-cell .cell-content {
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
    .view-device-config-wrap .config-cell .cell-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }
    .view-device-config-wrap .config-cell .cell-desc {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-tertiary);
    }
    .view-device-config-wrap .config-cell .cell-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    /* Activity Logs table (same layout as Device Detail page) */
    .view-device-activity-table-wrap {
        display: flex;
        flex-direction: column;
        background: var(--ds-color-white);
        border-radius: var(--ds-radius-lg);
        overflow: hidden;
    }
    .view-device-activity-table-header {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        background: var(--ds-color-neutral-true-100, #F5F5F5);
        border-bottom: 1px solid var(--ds-border-default);
    }
    .view-device-activity-header-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-space-3) var(--ds-card-padding-md);
        gap: var(--ds-space-3);
        height: 52px;
        min-height: 52px;
    }
    /* Align expand column: center icon/button so chevrons line up vertically */
    .view-device-activity-header-cell.view-device-activity-col-expand {
        justify-content: center;
        padding-left: 0;
        padding-right: 0;
    }
    .view-device-activity-header-cell .view-device-activity-header-text {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600, #475467);
    }
    .view-device-activity-header-icon {
        color: var(--ds-color-gray-600, #525252);
    }
    .view-device-activity-col-expand {
        width: 60px;
        flex-shrink: 0;
    }
    .view-device-activity-cell.view-device-activity-col-expand {
        justify-content: center;
        padding-left: 0;
        padding-right: 0;
    }
    .view-device-activity-col-event {
        width: 240px;
        flex-shrink: 0;
    }
    .view-device-activity-col-description {
        flex: 1;
        min-width: 0;
    }
    .view-device-activity-col-status {
        width: 150px;
        flex-shrink: 0;
    }
    .view-device-activity-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        background: var(--ds-color-white);
        border-bottom: 1px solid var(--ds-border-default);
    }
    .view-device-activity-table-wrap .view-device-activity-row:last-child {
        border-bottom: none;
    }
    .view-device-activity-table-wrap .view-device-activity-row:last-child .view-device-activity-cell:first-child {
        border-bottom-left-radius: var(--ds-radius-lg);
    }
    .view-device-activity-table-wrap .view-device-activity-row:last-child .view-device-activity-cell:last-child {
        border-bottom-right-radius: var(--ds-radius-lg);
    }
    .view-device-activity-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-4);
        min-height: 52px;
    }
    .view-device-activity-event-name {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }
    .view-device-activity-description-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }
    .view-device-activity-details-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        background: var(--ds-color-white);
        border-bottom: 1px solid var(--ds-border-default);
        min-height: 60px;
    }
    .view-device-activity-details-spacer {
        width: 60px;
        flex-shrink: 0;
        display: flex;
        justify-content: center;
    }
    .view-device-activity-details-divider {
        display: flex;
        flex-direction: column;
        justify-content: stretch;
        align-items: center;
        width: 20px;
        flex-shrink: 0;
        padding: 0;
    }
    .view-device-activity-divider-line {
        width: 1px;
        background: var(--ds-color-neutral-true-200, #E5E5E5);
        flex: 1;
        min-height: 100%;
    }
    .view-device-activity-details-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 16px 16px 16px 12px;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }
    .view-device-activity-detail-item {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 8px;
        flex-wrap: wrap;
    }
    .view-device-activity-detail-item .view-device-activity-detail-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }
    .view-device-activity-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: var(--ds-space-2) var(--ds-space-6);
        gap: var(--ds-space-2);
        border-top: 1px solid var(--ds-border-default);
    }
    .view-device-activity-pagination-details {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }
    .view-device-activity-pagination-controls {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-1);
    }
    .view-device-activity-page-number {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
        .bundle-detail-page {
            padding: var(--ds-space-4);
        }
        
        .detail-header {
            flex-direction: column;
            align-items: stretch;
        }
        
        .detail-actions {
            justify-content: flex-start;
        }
    }
    
    @media (max-width: 480px) {
        .detail-actions {
            flex-direction: column;
            align-items: stretch;
        }
        
        .detail-actions :global(button) {
            width: 100%;
        }
    }

    @media (max-width: 1024px) {
        .batches-datas {
            flex-wrap: wrap;
            height: auto;
            min-height: 88px;
        }
        .batches-datas-wrap {
            flex: 1 1 calc(33.333% - var(--ds-space-4));
            min-width: 180px;
        }
    }

    @media (max-width: 640px) {
        .batches-datas-wrap {
            flex: 1 1 100%;
            min-width: 0;
        }
    }
</style>

