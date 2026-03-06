<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { writable } from "svelte/store";
    import type { PageData } from "./$types";
    import { page } from "$app/stores";
    import { goto, invalidate, invalidateAll } from "$app/navigation";
    import { enhance } from "$app/forms";
    import { TabGroup, Button, Badge, Tag, Modal, ConfirmModal, InputField, Card, ActionMenu, Checkbox, DataTable, Alert } from "$lib/design-system/components";
    import type { ColumnDef, PaginationState } from "$lib/design-system/components";
    import type { TabItem } from "$lib/design-system/components/TabGroup.svelte";
    import EditDeviceModal from "$lib/components/devices/EditDeviceModal.svelte";
    import ScreenshotModal from "$lib/components/ui_components_sveltekit/devices/ScreenshotModal.svelte";
    import ConfirmationDialog from "$lib/components/ui_components_sveltekit/dialog/ConfirmationDialog.svelte";
    import { callUserRpc } from "$lib/client/mqtt/userRpc";
    import { waitForScreenshotResult } from "$lib/client/mqtt/screenshotFlow";
    import { ActionLogSyncManager } from "$lib/client/sync/ActionLogSyncManager";
    import { subscribeActionLogUpdates } from "$lib/client/mqtt/handlers/data/actionLogHandler";
    import { mqttClient } from "$lib/client/mqtt/mqttClient";
    import { createModalHandler } from "$lib/client/mqtt/handlers/ui/modalHandler";
    import AppPickerModal from "$lib/components/shared/AppPickerModal.svelte";
    import type { AppPickerItem } from "$lib/components/shared/AppPickerModal.svelte";
    import { initializeDeviceRealtime, deviceRealtimeStore } from "$lib/stores/deviceRealtimeStore";
    import { browser } from "$app/environment";
    import { createProgressBarHandler } from "$lib/client/mqtt/handlers/ui/progressBarHandler";
    import { toast } from "$lib/stores/alertToast";
    import { isRefreshAction } from "$lib/constants/device";
    import {
        formatDeploymentDate,
        formatActivityLogDate,
        formatInstallDate,
        formatLastSeen,
        formatUptime,
        formatFileSize,
        getDeploymentBadgeColor,
        getActivityLogBadgeColor,
        getAppTypeBadgeColor,
        getUsageColor,
        mapBundleStatus,
        mapActionStatus,
        formatActionDescription
    } from "$lib/utils/deviceDetailsUtils";
    import { formatBytes } from "$lib/utils/format";
    import {
        PenLine,
        RefreshCw,
        Camera,
        Airplay,
        Terminal as TerminalIcon,
        Upload,
        Download,
        BookUp2,
        Power,
        ScanFace,
        Info,
        Wifi,
        Cpu,
        Shield,
        Settings2,
        History,
        Package,
        PackageOpen,
        Link2,
        Pin,
        MoreVertical,
        RotateCcw,
        Settings,
        Trash2,
        Plus,
        ChevronLeft,
        ChevronRight,
        ChevronsLeft,
        ChevronsRight,
        ChevronDown,
        ArrowRight,
        Server,
        GitFork,
        Search,
        X
    } from "lucide-svelte";


    export let data: PageData;

    // Apps state
    interface DeviceApp {
        device_id: string;
        account_id: string;
        app_name: string;
        package_name: string;
        version: string;
        app_type: 'System' | 'Normal' | 'User' | string;
        last_modified: string;
        install_date: string;
        size_bytes: number;
        is_pinned?: boolean;
        is_system_app: boolean;
    }

    let apps: DeviceApp[] = [];
    let appsLoading = false;
    let appsLoaded = false; // Track if apps have been loaded
    let appsError: string | null = null;
    let appsTotalCount = 0;
    let appsCurrentPage = 1;
    let appsPageSize = 10;
    let appsTotalPages = 1;
    let appsSearchTerm = '';

    // Alert notifications (design-system Alert instead of toast)
    type AlertSeverity = 'info' | 'success' | 'warning' | 'error';
    let alerts: Array<{ id: number; severity: AlertSeverity; message: string }> = [];
    let alertIdCounter = 0;
    function addAlert(severity: AlertSeverity, message: string) {
        const id = ++alertIdCounter;
        alerts = [...alerts, { id, severity, message }];
        setTimeout(() => { alerts = alerts.filter((a) => a.id !== id); }, 5000);
    }
    function dismissAlert(id: number) {
        alerts = alerts.filter((a) => a.id !== id);
    }

    // Deployments state
    type DeploymentStatus = 'Draft' | 'Scheduled' | 'In Progress' | 'Completed' | 'Failed' | 'Stopped' | 'Cancelled';

    interface Deployment {
        id: string;
        name: string;
        version: string;
        startedOn: string | null;
        endedOn: string | null;
        status: DeploymentStatus;
        /** BundleDevice id, required for Remove (unassign device from bundle) */
        bundleDeviceId?: string | null;
    }

    let deployments: Deployment[] = [];
    let deploymentsLoading = false;
    let deploymentsLoaded = false;
    let deploymentsTotalCount = 0;
    let deploymentsCurrentPage = 1;
    let deploymentsPageSize = 10;
    let deploymentsTotalPages = 1;

    // Get allowed actions based on deployment status
    function getDeploymentActions(status: DeploymentStatus): { label: string; action: string; color?: string }[] {
        switch (status) {
            case 'Draft':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Scheduled':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'In Progress':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Completed':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Failed':
                return [
                    { label: 'Retry', action: 'retry' },
                    { label: 'View', action: 'view' },
                    { label: 'Delete', action: 'delete', color: '#B42318' }
                ];
            case 'Stopped':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            case 'Cancelled':
                return [
                    { label: 'View', action: 'view' },
                    { label: 'Remove', action: 'remove', color: '#B42318' }
                ];
            default:
                return [{ label: 'View', action: 'view' }];
        }
    }

    // Handle deployment action (View = go to bundle detail; Remove/Delete = unassign device from bundle)
    async function handleDeploymentAction(deployment: Deployment, action: string) {
        switch (action) {
            case 'view':
                goto(`/user/iot/bundles/${deployment.id}`);
                break;
            case 'remove':
            case 'delete':
                if (!confirm(`Remove this device from deployment "${deployment.name}"? The device will no longer receive this deployment.`)) return;
                if (!deployment.bundleDeviceId) {
                    addAlert('error', 'Cannot remove: deployment link not found.');
                    return;
                }
                try {
                    const res = await fetch(`/api/v2/bundles/${deployment.id}/devices/${deployment.bundleDeviceId}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err?.error?.message || res.statusText);
                    }
                    addAlert('success', `Device removed from "${deployment.name}"`);
                    deploymentsLoaded = false;
                    loadDeployments();
                } catch (e: any) {
                    addAlert('error', e?.message || 'Failed to remove device from deployment');
                }
                break;
            case 'retry':
                addAlert('info', `Retry deployment: ${deployment.name}`);
                // TODO: Retry deployment (if API exists)
                break;
            default:
                addAlert('info', `Action ${action} on ${deployment.name}`);
        }
    }

    // Load deployments from API
    async function loadDeployments() {
        if (!device?.id || deploymentsLoading) return;

        try {
            deploymentsLoading = true;

            const params = new URLSearchParams({
                page: String(deploymentsCurrentPage),
                pageSize: String(deploymentsPageSize)
            });

            const res = await fetch(`/api/devices/${device.id}/deployments?${params.toString()}`);

            if (!res.ok) throw new Error(`Failed to load deployments: ${res.statusText}`);

            const result = await res.json();

            if (result.success && result.data?.deployments) {
                // Transform API response to Deployment format (API returns startedAt/completedAt and bundleDeviceId)
                deployments = result.data.deployments.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    version: d.version ?? '1.0.0',
                    startedOn: d.progress?.startedAt ?? d.startedAt ?? d.startedOn ?? null,
                    endedOn: d.progress?.completedAt ?? d.completedAt ?? d.endedOn ?? d.endedAt ?? null,
                    status: mapBundleStatus(d.deviceStatus || d.bundleStatus),
                    bundleDeviceId: d.bundleDeviceId ?? null,
                    appsCount: d.apps?.length || 0,
                    createdAt: d.createdAt,
                    scheduledAt: d.scheduledAt
                }));

                deploymentsTotalCount = result.data.pagination?.total || deployments.length;
                deploymentsTotalPages = result.data.pagination?.totalPages || Math.ceil(deploymentsTotalCount / deploymentsPageSize);
            } else {
                deployments = [];
                deploymentsTotalCount = 0;
                deploymentsTotalPages = 1;
            }

            deploymentsLoaded = true;
        } catch (e) {
            console.error('Failed to load deployments:', e);
            deployments = [];
            deploymentsTotalCount = 0;
            deploymentsTotalPages = 1;
            deploymentsLoaded = true;
        } finally {
            deploymentsLoading = false;
        }
    }

    // Get deployment action menu items
    function getDeploymentMenuItems(deployment: Deployment): Array<{ id: string; label: string; icon?: any; destructive?: boolean }> {
        const actions = getDeploymentActions(deployment.status);
        return actions.map(action => ({
            id: action.action,
            label: action.label,
            destructive: action.color === '#B42318'
        }));
    }

    // DataTable columns for Deployments (design-system DataTable) - all data columns sortable; moreMenu (Action) non-sortable
    $: deploymentColumns = [
        { id: 'name', header: 'Deployment Name', type: 'text', accessor: 'name', minWidth: '400px' },
        { id: 'version', header: 'Version', type: 'text', accessor: 'version', width: '100px' },
        { id: 'startedOn', header: 'Started On', type: 'text', accessor: (row: Deployment) => formatDeploymentDate(row.startedOn), width: '200px' },
        { id: 'endedOn', header: 'Ended On', type: 'text', accessor: (row: Deployment) => formatDeploymentDate(row.endedOn), width: '200px' },
        { id: 'status', header: 'Status', type: 'status', accessor: 'status', statusColor: (_v: any, row: Deployment) => getDeploymentBadgeColor(row.status), width: '140px' },
        { id: 'action', header: 'Action', type: 'moreMenu', align: 'right', width: '85px', getMenuActions: (d: Deployment) => getDeploymentActions(d.status).map(a => ({ id: a.action, label: a.label, color: a.color === '#B42318' ? 'danger' : undefined, href: a.action === 'view' ? `/user/iot/bundles/${d.id}` : undefined, onClick: (row: Deployment) => handleDeploymentAction(row, a.action) })) }
    ] as ColumnDef<Deployment>[];

    // Load deployments when tab changes
    $: if (activeTab === 'deployments' && device?.id && !deploymentsLoaded && !deploymentsLoading) {
        loadDeployments();
    }

    // Activity Logs state
    type ActivityLogStatus = 'Success' | 'In Progress' | 'Failed' | 'Warning';

    interface ActivityLogDetail {
        label: string;
        oldValue?: string;
        newValue: string;
        tags?: string[]; // For tag-type values
    }

    interface ActivityLog {
        id: string;
        eventName: string;
        description: string;
        status: ActivityLogStatus;
        timestamp: string;
        expanded?: boolean;
        details?: ActivityLogDetail[];
    }

    let activityLogs: ActivityLog[] = [];
    let activityLogsLoading = false;
    let activityLogsLoaded = false;
    let activityLogsTotalCount = 0;
    let activityLogsCurrentPage = 1;
    let activityLogsPageSize = 10;
    let activityLogsTotalPages = 1;

    let downloadLogsLoading = false;
    let pendingLogDownloadId: string | null = null;
    let pendingLogDownloadTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // Toggle activity log expansion
    function toggleActivityLogExpansion(logId: string) {
        activityLogs = activityLogs.map(log =>
            log.id === logId ? { ...log, expanded: !log.expanded } : log
        );
    }

    // Load activity logs from API
    async function loadActivityLogs() {
        if (!device?.id || activityLogsLoading) return;

        try {
            activityLogsLoading = true;

            const offset = (activityLogsCurrentPage - 1) * activityLogsPageSize;
            const res = await fetch(`/api/devices/${device.id}/action-logs?limit=${activityLogsPageSize}&offset=${offset}`);

            if (!res.ok) throw new Error(`Failed to load activity logs: ${res.statusText}`);

            const result = await res.json();

            if (result.success && result.data?.logs) {
                // Transform API response to ActivityLog format
                activityLogs = result.data.logs.map((log: any) => ({
                    id: log.id,
                    eventName: formatActivityLogDate(log.initiatedAt),
                    description: formatActionDescription(log.actionType, log.message),
                    status: mapActionStatus(log.status),
                    timestamp: log.initiatedAt,
                    expanded: false,
                    details: buildActivityLogDetails(log)
                }));

                // Get total count for pagination
                const countRes = await fetch(`/api/devices/${device.id}/action-logs?limit=1&offset=0`);
                if (countRes.ok) {
                    const countResult = await countRes.json();
                    // Estimate total based on whether we got full page
                    activityLogsTotalCount = activityLogs.length < activityLogsPageSize
                        ? offset + activityLogs.length
                        : Math.max(offset + activityLogsPageSize * 2, 100); // Estimate
                }
                activityLogsTotalPages = Math.max(1, Math.ceil(activityLogsTotalCount / activityLogsPageSize));
            } else {
                activityLogs = [];
                activityLogsTotalCount = 0;
                activityLogsTotalPages = 1;
            }

            activityLogsLoaded = true;
        } catch (e) {
            console.error('Failed to load activity logs:', e);
            activityLogs = [];
            activityLogsTotalCount = 0;
            activityLogsTotalPages = 1;
            activityLogsLoaded = true;
        } finally {
            activityLogsLoading = false;
        }
    }

    // Build activity log details from API response
    function buildActivityLogDetails(log: any): Array<{ label: string; oldValue?: string; newValue?: string; tags?: string[] }> {
        const details: Array<{ label: string; oldValue?: string; newValue?: string; tags?: string[] }> = [];

        if (log.durationMs) {
            details.push({ label: 'Duration:', newValue: `${log.durationMs}ms` });
        }

        if (log.user?.name) {
            details.push({ label: 'Initiated by:', newValue: log.user.name });
        }

        if (log.error) {
            details.push({ label: 'Error:', newValue: log.error });
        }

        return details;
    }

    // Load activity logs when tab changes
    $: if (activeTab === 'activity' && device?.id && !activityLogsLoaded && !activityLogsLoading) {
        loadActivityLogs();
    }

    // Download logs: request device to upload logs to GCS. Wait for device:getLogsStatus MQTT; fallback to limited poll if not received.
    async function handleDownloadLogs() {
        if (!device?.id || downloadLogsLoading) return;
        downloadLogsLoading = true;
        addAlert('info', 'Requesting logs from device...');
        try {
            const res = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getLogs', format: 'zip' })
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                const msg = result?.error?.message || `Request failed: ${res.statusText}`;
                addAlert('error', msg);
                downloadLogsLoading = false;
                return;
            }
            const logId = result?.data?.operationId;
            if (!logId) {
                addAlert('error', 'No operation ID returned');
                downloadLogsLoading = false;
                return;
            }
            pendingLogDownloadId = logId;
            pendingLogDownloadTimeoutId = setTimeout(() => {
                if (pendingLogDownloadId === logId) {
                    pendingLogDownloadId = null;
                    pendingLogDownloadTimeoutId = null;
                    addAlert('error', 'Logs download timed out. The device may be offline or still uploading.');
                    downloadLogsLoading = false;
                }
            }, 120000);
            // Fallback: if MQTT never arrives, poll after 8s (max 6 calls over ~35s)
            const pollFallback = async () => {
                await new Promise((r) => setTimeout(r, 8000));
                for (let i = 0; i < 6 && pendingLogDownloadId === logId && device?.id; i++) {
                    await new Promise((r) => setTimeout(r, 5000));
                    if (pendingLogDownloadId !== logId) return;
                    const urlRes = await fetch(`/api/v2/devices/${device.id}/pull-file-download-url?logId=${encodeURIComponent(logId)}`);
                    if (urlRes.ok) {
                        const urlResult = await urlRes.json();
                        const downloadUrl = urlResult?.data?.downloadUrl;
                        if (downloadUrl && pendingLogDownloadId === logId) {
                            clearPendingLogDownload('done');
                            await fetchAndDownloadLogs(logId);
                            return;
                        }
                    }
                }
                if (pendingLogDownloadId === logId) {
                    clearPendingLogDownload('failed', 'Logs download unavailable. The device may have failed to upload.');
                    loadActivityLogs();
                }
            };
            pollFallback();
        } catch (e) {
            addAlert('error', e instanceof Error ? e.message : 'Failed to download logs');
            downloadLogsLoading = false;
        }
    }

    function clearPendingLogDownload(reason: 'failed' | 'timeout' | 'done', message?: string) {
        if (pendingLogDownloadTimeoutId) {
            clearTimeout(pendingLogDownloadTimeoutId);
            pendingLogDownloadTimeoutId = null;
        }
        pendingLogDownloadId = null;
        if (reason === 'failed' || reason === 'timeout' || reason === 'done') {
            downloadLogsLoading = false;
            if (reason === 'failed' && message) addAlert('error', message);
        }
    }

    async function fetchAndDownloadLogs(logId: string) {
        if (!device?.id) return;
        try {
            const urlRes = await fetch(`/api/v2/devices/${device.id}/pull-file-download-url?logId=${encodeURIComponent(logId)}`);
            if (urlRes.ok) {
                const urlResult = await urlRes.json();
                const downloadUrl = urlResult?.data?.downloadUrl;
                const fileName = urlResult?.data?.fileName || `logs_${logId}.zip`;
                if (downloadUrl) {
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = fileName;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    addAlert('success', 'Logs download started.');
                    loadActivityLogs();
                } else {
                    addAlert('error', 'No download URL in response.');
                }
            } else {
                addAlert('error', `Failed to get download URL: ${urlRes.statusText}`);
            }
        } catch (e) {
            addAlert('error', e instanceof Error ? e.message : 'Failed to download logs');
        } finally {
            downloadLogsLoading = false;
        }
    }

    // Load apps data
    async function loadApps() {
        if (!device?.id || appsLoading) return;

        try {
            appsLoading = true;
            appsError = null;

            const params = new URLSearchParams({
                page: String(appsCurrentPage),
                limit: String(appsPageSize)
            });
            if (appsSearchTerm) params.set('search', appsSearchTerm);
            const res = await fetch(`/api/v2/devices/${device.id}/apps-with-pins?${params.toString()}`);
            if (!res.ok) throw new Error(`Failed to load apps: ${res.statusText}`);
            const result = await res.json();
            if (!result?.success) throw new Error(result?.error || 'Failed to load apps');
            const payload = result.data ?? result;
            const rawApps = payload.apps ?? payload.items ?? [];
            // Normalize for DataTable pin column (pinField: 'is_pinned') and API field names
            apps = rawApps.map((a: any) => ({
                ...a,
                app_name: a.app_name ?? a.appName,
                package_name: a.package_name ?? a.packageName,
                app_type: a.app_type ?? a.appType,
                size_bytes: a.size_bytes ?? a.sizeBytes,
                install_date: a.install_date ?? a.installDate,
                last_modified: a.last_modified ?? a.lastModified,
                is_pinned: a.isPinned ?? a.is_pinned ?? false
            }));
            appsTotalCount = payload.pagination?.total ?? payload.total ?? apps.length;
            appsTotalPages = payload.pagination?.totalPages ?? payload.totalPages ?? 1;
            if (payload.pagination?.page != null) appsCurrentPage = payload.pagination.page;
            else if (payload.page != null) appsCurrentPage = payload.page;
            appsLoaded = true;
        } catch (e) {
            console.error('Failed to load apps:', e);
            appsError = e instanceof Error ? e.message : 'Failed to load apps';
            apps = [];
            appsTotalCount = 0;
            appsTotalPages = 1;
            appsLoaded = true;
        } finally {
            appsLoading = false;
        }
    }

    // Toggle pin app
    async function togglePinApp(app: DeviceApp) {
        try {
            const res = await fetch(`/api/v2/devices/${device.id}/apps/${app.package_name}/pin`, {
                method: app.is_pinned ? 'DELETE' : 'POST'
            });
            if (!res.ok) throw new Error('Failed to toggle pin');

            // Update local state
            apps = apps.map(a =>
                a.package_name === app.package_name
                    ? { ...a, is_pinned: !a.is_pinned }
                    : a
            );
            addAlert('success', app.is_pinned ? 'App unpinned' : 'App pinned');
        } catch (e) {
            addAlert('error', `Failed to toggle pin: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    }

    // App actions
    async function handleRestartApp(app: DeviceApp) {
        try {
            addAlert('info', `Restarting app... ${app.app_name}`);

            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.app.restart', {
                deviceId: device?.id,
                packageName: app.package_name
            }, { timeoutMs: 180000 }); // 3 minutes

            addAlert('success', result.message || `App restart initiated! ${app.app_name}`);
        } catch (error) {
            console.error('Restart app failed:', error);
            addAlert('error', error instanceof Error ? error.message : 'Unable to restart app. Please try again!');
        }
    }

    async function handleAppSettings(app: DeviceApp) {
        try {
            addAlert('info', `Opening app settings... ${app.app_name}`);

            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.app.config', {
                deviceId: device?.id,
                packageName: app.package_name
            }, { timeoutMs: 180000 }); // 3 minutes

            addAlert('success', result.message || `App settings opened! ${app.app_name}`);
        } catch (error) {
            console.error('App settings failed:', error);
            addAlert('error', error instanceof Error ? error.message : 'Unable to open app settings. Please try again!');
        }
    }

    function handleUninstallApp(app: DeviceApp) {
        if (app.is_system_app) {
            addAlert('error', 'Cannot uninstall system app');
            return;
        }
        uninstallAppTarget = app;
        showUninstallAppConfirm = true;
    }

    async function confirmUninstallApp() {
        if (!uninstallAppTarget) return;
        const app = uninstallAppTarget;
        uninstallAppTarget = null;
        showUninstallAppConfirm = false;
        try {
            pendingUninstallPackageName = app.package_name;
            addAlert('info', `Uninstalling app... ${app.app_name}`);
            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.app.uninstall', {
                deviceId: device?.id,
                packageName: app.package_name
            }, { timeoutMs: 300000 }); // 5 minutes
            addAlert('success', result.message || `App uninstall initiated! ${app.app_name}`);
            // Don't reload here - MQTT success handler will optimistically remove the app + debounced reload
        } catch (error) {
            console.error('Uninstall app failed:', error);
            pendingUninstallPackageName = null;
            addAlert('error', error instanceof Error ? error.message : 'Unable to uninstall app. Please try again!');
        }
    }

    // Get app action menu items
    function getAppMenuItems(app: DeviceApp): Array<{ id: string; label: string; icon?: any; destructive?: boolean; disabled?: boolean }> {
        return [
            { id: 'restart', label: 'Restart App', icon: RotateCcw },
            { id: 'settings', label: 'App Settings', icon: Settings },
            { id: 'uninstall', label: 'Uninstall App', icon: Trash2, destructive: true, disabled: app.is_system_app }
        ];
    }

    // DataTable columns for Installed Apps (design-system DataTable) - pin/moreMenu non-sortable by convention
    $: appsColumns = [
        { id: 'pin', header: '', type: 'pin', pinField: 'is_pinned', /* onPin: (row: DeviceApp, _newVal: boolean) => togglePinApp(row), */ width: '48px' },
        { id: 'app', header: 'App', type: 'textWithSupporting', accessor: 'app_name', supportingField: 'package_name', minWidth: '200px' },
        { id: 'app_type', header: 'Type', type: 'text', accessor: 'app_type', width: '100px' },
        { id: 'version', header: 'Version', type: 'text', accessor: 'version', width: '80px' },
        { id: 'size', header: 'Size', type: 'text', accessor: (row: DeviceApp) => formatBytes(row.size_bytes), width: '80px' },
        { id: 'installed', header: 'Installed On', type: 'text', accessor: (row: DeviceApp) => formatInstallDate(row.install_date || row.last_modified), width: '120px' },
        { id: 'actions', header: 'Actions', type: 'moreMenu', align: 'right', width: '80px', getMenuActions: (row: DeviceApp) => [
            { id: 'restart', label: 'Restart App', onClick: (r: DeviceApp) => handleRestartApp(r) },
            { id: 'settings', label: 'App Settings', onClick: (r: DeviceApp) => handleAppSettings(r) },
            { id: 'uninstall', label: 'Uninstall App', color: 'danger', onClick: (r: DeviceApp) => handleUninstallApp(r), disabled: () => row.is_system_app }
        ] }
    ] as ColumnDef<DeviceApp>[];

    // Load apps when tab changes to apps (only once)
    $: if (activeTab === 'apps' && device?.id && !appsLoaded && !appsLoading) {
        loadApps();
    }

    // =========================
    // Install New App Modal (same UX as Bulk Actions -> Install new App)
    // =========================
    // Install New App Modal (uses shared AppPickerModal component)
    let showInstallAppModal = false;
    let installAppLoading = false;

    // Package names currently on device (for "Already on device" badge)
    $: installedPackageNames = new Set((apps || []).map((a: DeviceApp) => (a.package_name || '').trim()).filter(Boolean));

    function openInstallAppModal() {
        showInstallAppModal = true;
        // Use existing apps list for "Already on device" — reload only after install/uninstall response (MQTT handler)
    }

    async function handleInstallAppConfirm(e: CustomEvent<{ selected: string[]; apps: AppPickerItem[] }>) {
        const { selected, apps: selectedApps } = e.detail;
        if (selected.length === 0 || !device?.id) return;
        installAppLoading = true;
        try {
            const results = await Promise.allSettled(
                selectedApps.map(app =>
                    callUserRpc('device.app.install', {
                        deviceId: device.id,
                        packageName: app.packageName,
                        resourceId: app.id
                    }, { timeoutMs: 60000 })
                )
            );
            const failCount = results.filter(r => r.status === 'rejected').length;
            showInstallAppModal = false;
            if (failCount === 0) {
                addAlert('success', 'App installation initiated successfully!');
                // App list will reload when we receive device:statusUpdate success (MQTT handler, debounced)
            } else {
                addAlert('error', 'Some app installations failed. Please try again.');
            }
        } catch (e) {
            addAlert('error', 'Unable to install app. Please try again!');
            console.error('Install app failed:', e);
        } finally {
            installAppLoading = false;
        }
    }

    // =========================
    // Edit Device Modal
    // =========================
    let showEditDeviceModal = false;

    // Screenshot modal (same flow as admin: MQTT RPC device.screenshot)
    let screenshotOpen = false;
    let screenshotData: string | null = null;
    let screenshotFormat = 'jpeg';

    // Reboot confirmation dialog
    let showRebootConfirm = false;

    // Generate API Key confirmation dialog
    let showGenerateKeyConfirm = false;

    // Uninstall App confirmation dialog
    let showUninstallAppConfirm = false;
    let uninstallAppTarget: DeviceApp | null = null;
    let pendingUninstallPackageName: string | null = null;
    let reloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Available tags from server
    $: availableTags = data.availableTags || [];

    // Available profiles from server
    $: availableProfiles = ((data as any).availableProfiles || []) as Array<{ id: string; name: string; description?: string }>;

    // =========================
    // Pull File Modal
    // =========================
    let showPullFileModal = false;
    let pullFileSourcePath = "";
    let pullFileLoading = false;

    // =========================
    // Push File Modal
    // =========================
    let showPushFileModal = false;
    let pushFileDestinationPath = "";
    let pushFileSearchTerm = "";
    let pushFileLoading = false;
    let pushFileProgress = 0;
    let pushFileStatusMessage = "";
    let pushFileResources: Array<{
        id: string;
        name: string;
        packageName: string | null;
        version: string | null;
        size: number | null;
        createdAt: string;
    }> = [];
    let pushFileResourcesLoading = false;
    let pushFileSelectedResourceId: string | null = null;
    let pushFileTotalCount = 0;
    let pushFileCurrentPage = 1;
    let pushFilePageSize = 10;
    let pushFileTotalPages = 1;

    // =========================
    // Update Firmware Modal (matching listing page style)
    // =========================
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
    let updateFirmwareOptions: FirmwareOption[] = [];
    let updateFirmwareOptionsLoading = false;

    // Computed: filtered firmwares for Update Firmware modal
    $: updateFirmwareFilteredOptions = updateFirmwareOptions.filter((fw) =>
        fw.name.toLowerCase().includes(updateFirmwareSearch.toLowerCase()) ||
        fw.packageName.toLowerCase().includes(updateFirmwareSearch.toLowerCase())
    );

    // Computed: paginated firmwares
    $: updateFirmwareTotalPages = Math.max(1, Math.ceil(updateFirmwareFilteredOptions.length / updateFirmwarePerPage));
    $: updateFirmwarePaginatedOptions = updateFirmwareFilteredOptions.slice(
        (updateFirmwarePage - 1) * updateFirmwarePerPage,
        updateFirmwarePage * updateFirmwarePerPage
    );

    // Make device reactive to server invalidations
    // Use both data prop and $page.data to ensure reactivity
    let device = data.device;
    $: device = $page.data?.device || data.device;

    // Device profile - reactive to ensure Configuration tab updates when profile changes
    // Use both data prop and $page.data to ensure reactivity after invalidate
    $: deviceProfile = $page.data?.deviceProfile || data.deviceProfile;

    // Device information from ClickHouse (loaded on server)
    // Will be null if ClickHouse is not configured or no data available
    $: deviceInfo = $page.data?.deviceInformation || data.deviceInformation;

    // Auto-refresh device info every 30 seconds to get latest metrics
    let healthRefreshInterval: ReturnType<typeof setInterval> | null = null;
    let actionLogSyncManager: ActionLogSyncManager | null = null;
    let mqttUnsubscribes: (() => void)[] = [];

    onMount(() => {
        if (browser) initializeDeviceRealtime();
        // Refresh device detail and (when on Apps tab) installed apps every 30s when online (heartbeat interval)
        // so Device Health metrics (CPU, MEM, DSK from ClickHouse) update promptly
        healthRefreshInterval = setInterval(() => {
            invalidate('app:device');
            if (activeTab === 'apps') loadApps();
        }, 30000);

        // Set up real-time action log sync
        if (device?.id) {
            try {
                actionLogSyncManager = new ActionLogSyncManager(
                    device.id,
                    () => {
                        // Get current logs in ActionLog format
                        return activityLogs.map(log => ({
                            id: log.id,
                            deviceId: device.id,
                            actionType: log.description || 'unknown',
                            status: log.status as any,
                            progress: null,
                            initiatedBy: 'user',
                            initiatedAt: log.timestamp,
                            completedAt: null,
                            durationMs: null,
                            message: log.description || '',
                            user: null
                        }));
                    },
                    (logs) => {
                        // Update activity logs from synced action logs
                        console.log('[UserDevicePage] ActionLogSyncManager updating logs:', logs.length);
                        activityLogs = logs.map(log => ({
                            id: log.id,
                            eventName: formatActivityLogDate(log.initiatedAt),
                            description: formatActionDescription(log.actionType, log.message),
                            status: mapActionStatus(log.status),
                            timestamp: log.initiatedAt,
                            expanded: false,
                            details: buildActivityLogDetails(log)
                        }));
                        activityLogsTotalCount = logs.length;
                        activityLogsTotalPages = Math.max(1, Math.ceil(activityLogsTotalCount / activityLogsPageSize));
                    }
                );
                console.log('[UserDevicePage] ActionLogSyncManager initialized for device:', device.id);
            } catch (error) {
                console.error('[UserDevicePage] Failed to initialize ActionLogSyncManager:', error);
            }

            // Add direct MQTT handler for action log updates (same as admin)
            // This handles device:statusUpdate notifications directly for real-time updates
            try {
                const actionStatus = writable({ action: '', status: '', message: '' });
                const unsubActionLogs = subscribeActionLogUpdates(
                    device.id,
                    () => {
                        // Convert ActivityLog format to ActionLog format for subscribeActionLogUpdates
                        return activityLogs.map(log => ({
                            id: log.id,
                            deviceId: device.id,
                            actionType: log.description || 'unknown',
                            status: log.status as any,
                            progress: null,
                            initiatedBy: 'user',
                            initiatedAt: log.timestamp,
                            completedAt: null,
                            durationMs: null,
                            message: log.description || '',
                            user: null
                        }));
                    },
                    (logs) => {
                        // Update activity logs from action logs
                        activityLogs = logs.map(log => ({
                            id: log.id,
                            eventName: formatActivityLogDate(log.initiatedAt),
                            description: formatActionDescription(log.actionType, log.message),
                            status: mapActionStatus(log.status),
                            timestamp: log.initiatedAt,
                            expanded: false,
                            details: buildActivityLogDetails(log)
                        }));
                        activityLogsTotalCount = logs.length;
                        activityLogsTotalPages = Math.max(1, Math.ceil(activityLogsTotalCount / activityLogsPageSize));
                    },
                    actionStatus,
                    (logId) => clearPendingLogDownload('done'),
                    (logId, message) => clearPendingLogDownload('failed', message),
                    (status, message) => status === 'failed' && addAlert('error', message)
                );
                mqttUnsubscribes.push(unsubActionLogs);
                console.log('[UserDevicePage] subscribeActionLogUpdates initialized for device:', device.id);
            } catch (error) {
                console.error('[UserDevicePage] Failed to initialize subscribeActionLogUpdates:', error);
            }

            // Set up MQTT handlers for real-time modal and progress updates
            try {
                const modalHandler = createModalHandler({
                    deviceId: device.id,
                    showPullFileModal: {
                        get: () => showPullFileModal,
                        set: (val: boolean) => { showPullFileModal = val; }
                    },
                    showPushFileModal: {
                        get: () => showPushFileModal,
                        set: (val: boolean) => { showPushFileModal = val; }
                    },
                    showInstallAppModal: {
                        get: () => showInstallAppModal,
                        set: (val: boolean) => { showInstallAppModal = val; }
                    },
                    isLoading: {
                        get: () => installAppLoading,
                        set: (val: boolean) => { installAppLoading = val; }
                    }
                });

                const progressHandler = createProgressBarHandler({
                    deviceId: device.id,
                    pushFileProgress: {
                        get: () => pushFileProgress,
                        set: (val: number) => { pushFileProgress = val; }
                    },
                    pushFileStatusMessage: {
                        get: () => pushFileStatusMessage,
                        set: (val: string) => { pushFileStatusMessage = val; }
                    }
                });

                // Wrap handlers with logging and refresh apps list on install/uninstall success
                const loggingModalHandler = (payload: any) => {
                    modalHandler(payload);
                    const isSuccess = payload?.status === 'success' || payload?.status === 'complete';

                    // Optimistically remove uninstalled app from local list (instant UI update)
                    const isUninstall = payload?.action === 'uninstall_app' || payload?.action === 'uninstall';
                    if (isSuccess && isUninstall && pendingUninstallPackageName) {
                        apps = apps.filter(a => a.package_name !== pendingUninstallPackageName);
                        appsTotalCount = apps.length;
                        pendingUninstallPackageName = null;
                    }

                    // Uninstall: we already updated the list optimistically above — skip debounced reload to avoid second re-render
                    const isUninstallSuccess = isSuccess && isUninstall;
                    const shouldReload =
                        isSuccess &&
                        !isUninstallSuccess &&
                        (isRefreshAction(payload?.action) ||
                            (typeof payload?.message === 'string' &&
                                payload.message.includes('Installation') &&
                                payload.message.includes('succeeded')));
                    if (shouldReload) {
                        const action = payload?.action ?? 'unknown';
                        const hadTimer = !!reloadDebounceTimer;
                        if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
                        console.log('[Reload] schedule', { action, at: new Date().toISOString(), hadTimer });
                        reloadDebounceTimer = setTimeout(() => {
                            reloadDebounceTimer = null;
                            console.log('[Reload] before loadApps', {
                                action,
                                at: new Date().toISOString(),
                                reason: 'device:statusUpdate success (debounced 3s)'
                            });
                            loadApps();
                            const appOnlyActions = ['install_app', 'installApp', 'restart_app', 'restartApp'];
                            if (!appOnlyActions.includes(action)) {
                                invalidate('app:device');
                            }
                        }, 3000);
                    }
                };

                const loggingProgressHandler = (payload: any) => {
                    progressHandler(payload);
                };

                const statusUnsub = mqttClient.onNotification('device:statusUpdate', loggingModalHandler);
                const progressUnsub = mqttClient.onNotification('device:progressUpdate', loggingProgressHandler);

                const dataUpdateUnsub = mqttClient.onNotification('device:dataUpdate', () => {
                    invalidate('app:device');
                    loadApps();
                });

                const getLogsStatusUnsub = mqttClient.onNotification('device:getLogsStatus', (payload: any) => {
                    const logId = payload?.logId;
                    const action = payload?.action;
                    const status = payload?.status;
                    if (logId !== pendingLogDownloadId || (action !== 'getLogs' && action !== 'get_logs')) return;
                    if (status === 'failed' || status === 'error') {
                        clearPendingLogDownload('failed', payload?.message || 'Log upload failed.');
                        loadActivityLogs();
                        return;
                    }
                    if (status !== 'success' && status !== 'complete') return;
                    clearPendingLogDownload('done');
                    loadActivityLogs();
                });

                mqttUnsubscribes.push(statusUnsub, progressUnsub, dataUpdateUnsub, getLogsStatusUnsub);
            } catch (error) {
                console.error('[UserDevicePage] Failed to set up MQTT handlers:', error);
            }
        }
    });

    onDestroy(() => {
        if (pendingLogDownloadTimeoutId) {
            clearTimeout(pendingLogDownloadTimeoutId);
            pendingLogDownloadTimeoutId = null;
        }
        pendingLogDownloadId = null;
        if (reloadDebounceTimer) {
            clearTimeout(reloadDebounceTimer);
            reloadDebounceTimer = null;
        }
        if (healthRefreshInterval) {
            clearInterval(healthRefreshInterval);
        }
        if (actionLogSyncManager) {
            try {
                actionLogSyncManager.cleanup();
            } catch (error) {
                console.error('[UserDevicePage] Error cleaning up ActionLogSyncManager:', error);
            }
            actionLogSyncManager = null;
        }
        // Cleanup MQTT subscriptions
        mqttUnsubscribes.forEach(unsub => {
            try {
                unsub();
            } catch (error) {
                console.error('[UserDevicePage] Error unsubscribing from MQTT:', error);
            }
        });
        mqttUnsubscribes = [];
    });

    // Helper function to get profile setting value by key
    // This function respects the merged settings from loadDeviceProfile:
    // - Device-specific overrides (if any) take precedence
    // - Global profile settings are used as fallback
    // - Settings are already merged by loadDeviceProfile, so we just need to read them
    // NOTE: Uses reactive deviceProfile variable to ensure updates when data changes
    function getProfileSetting(key: string, defaultValue: string = '-'): string {
        // Ensure deviceProfile is loaded (use reactive variable)
        if (!deviceProfile) {
            return defaultValue;
        }

        const settings = deviceProfile.settings;
        if (!settings || !Array.isArray(settings)) {
            return defaultValue;
        }

        // Find the setting by key
        const setting = settings.find((s: any) => s.key === key);
        if (!setting) {
            return defaultValue;
        }

        // Check if value is null, undefined, or empty string
        if (setting.value === null || setting.value === undefined || setting.value === '') {
            return defaultValue;
        }

        // Handle boolean values - support both 'true'/'false' and 'enabled'/'disabled' formats
        if (setting.dataType === 'boolean') {
            const val = String(setting.value).toLowerCase();
            return (val === 'true' || val === 'enabled' || setting.value === true) ? 'Enable' : 'Disable';
        }

        // Return the setting value (already merged with overrides by loadDeviceProfile)
        return String(setting.value);
    }

    // Helper function to parse JSON string settings (for kiosk_application, home_launcher)
    function getProfileSettingParsed(key: string, field: 'name' | 'package' | 'value', defaultValue: string = '-'): string {
        const value = getProfileSetting(key, '');
        if (value === '' || value === '-') {
            return defaultValue;
        }

        // Try to parse as JSON (for complex settings like kiosk_application)
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed[field] || defaultValue;
            }
        } catch {
            // Not JSON, return as-is for 'value' field
            if (field === 'value') {
                return value;
            }
        }

        return defaultValue;
    }


    // Tabs - Updated to match Figma design
    const tabs: TabItem[] = [
        { id: "details", label: "Details" },
        { id: "configuration", label: "Configuration" },
        { id: "apps", label: "Installed Apps" },
        { id: "deployments", label: "Deployments" },
        { id: "activity", label: "Activity Logs" }
    ];

    let activeTab = "details";

    // Initialize tab from URL and keep it in sync
    $: {
        const urlParams = new URLSearchParams($page.url.search);
        const tabParam = urlParams.get('tab');
        if (tabParam && tabs.some(t => t.id === tabParam)) {
            activeTab = tabParam;
        }
    }

    function handleTabChange(e: CustomEvent<string>) {
        activeTab = e.detail;
        const url = new URL($page.url);
        url.searchParams.set('tab', activeTab);
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
    }

    // Connection status: use real-time MQTT store when we have an update, else server data
    $: isOnline = (() => {
        const store = $deviceRealtimeStore;
        if (!store || !device?.id) return device?.connected ?? false;
        const known = store.getDevice(device.id);
        if (known === null) return device?.connected ?? false;
        return store.isDeviceConnected(device.id);
    })();
    $: isActive = (device?.status || '').toUpperCase() === 'ACTIVE';

    // Action handlers
    async function handleRefresh() {
        if (!device?.id) return;
        try {
            addAlert('info', 'Sending refresh command to device...');

            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.refresh', {
                deviceId: device.id
            }, { timeoutMs: 30000 });

            addAlert('success', result.message || 'Device refresh command sent successfully!');
            // Reload device information (CPU, MEM, DSK, uptime, etc.) so metrics reflect latest from ClickHouse
            await invalidate('app:device');
            // Give device time to upload new metrics, then reload again
            setTimeout(() => invalidate('app:device'), 3000);
        } catch (error) {
            console.error('Refresh failed:', error);
            addAlert('error', error instanceof Error ? error.message : 'Unable to refresh device. Please try again!');
        }
    }

    async function handleSnapshot() {
        if (!device?.id) return;
        try {
            addAlert('info', 'Capturing screenshot...');
            const rpcResult = await callUserRpc<{
                flowId?: string;
                result: { deviceId: string; objectPath: string; operationId: string };
            }>('device.screenshot', { deviceId: device.id }, { timeoutMs: 60000 });

            const flowId = rpcResult?.flowId;
            if (!flowId) {
                throw new Error('Missing flowId in screenshot response');
            }

            const screenshot = await waitForScreenshotResult(flowId, device.id, { timeoutMs: 60000 });

            if (screenshot?.data) {
                screenshotData = screenshot.data;
                screenshotFormat = screenshot.format || 'jpeg';
                screenshotOpen = true;
                addAlert('success', 'Screenshot captured successfully!');
            } else {
                throw new Error('No image data received from device');
            }
        } catch (error) {
            console.error('Screenshot failed:', error);
            addAlert('error', error instanceof Error ? error.message : 'Unable to capture screenshot. Please try again!');
        }
    }

    function handleControl() {
        // TODO: Implement control/RDP
        goto(`/user/iot/devices/${device?.id}/rdp`);
    }

    function handleTerminal() {
        goto(`/user/iot/devices/${device?.id}/terminal`);
    }

    function handlePushFile() {
        pushFileDestinationPath = "";
        pushFileSearchTerm = "";
        pushFileSelectedResourceId = null;
        pushFileCurrentPage = 1;
        showPushFileModal = true;
        loadPushFileResources();
    }

    function handlePullFile() {
        pullFileSourcePath = "";
        showPullFileModal = true;
    }

    function handleUpdate() {
        updateFirmwareSearch = "";
        updateFirmwareSelected = null;
        updateFirmwarePage = 1;
        showUpdateFirmwareModal = true;
        loadFirmwareOptions();
    }

    // Pull File action
    async function executePullFile() {
        if (!pullFileSourcePath.trim()) {
            addAlert('error', 'Please enter a source file path');
            return;
        }

        pullFileLoading = true;
        try {
            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.file.pull', {
                deviceId: device?.id,
                sourcePath: pullFileSourcePath.trim(),
                destinationPath: pullFileSourcePath.trim()
            }, { timeoutMs: 60000 });

            addAlert('success', result.message || 'File pull action sent to device');
            showPullFileModal = false;
        } catch (error) {
            console.error('Pull file failed:', error);
            addAlert('error', error instanceof Error ? error.message : 'Unable to pull file. Please try again!');
        } finally {
            pullFileLoading = false;
        }
    }

    // Load resources for Push File modal
    // Uses the same API as the old app (/api/resources/files)
    async function loadPushFileResources() {
        pushFileResourcesLoading = true;
        try {
            const params = new URLSearchParams({
                page: String(pushFileCurrentPage),
                pageSize: String(pushFilePageSize),
                ...(pushFileSearchTerm ? { search: pushFileSearchTerm } : {})
            });

            // Use the same API as the old app for consistency
            const res = await fetch(`/api/resources/files?${params}`);
            if (!res.ok) throw new Error('Failed to load resources');

            const data = await res.json();
            pushFileResources = data.items || [];
            pushFileTotalCount = data.meta?.totalCount || 0;
            pushFileTotalPages = data.meta?.totalPages || 1;
        } catch (error) {
            console.error('Failed to load resources:', error);
            pushFileResources = [];
        } finally {
            pushFileResourcesLoading = false;
        }
    }

    // Push File action
    async function executePushFile() {
        if (!pushFileSelectedResourceId) {
            toast.error('Please select a file to push');
            return;
        }
        if (!pushFileDestinationPath.trim()) {
            toast.error('Please enter a destination path');
            return;
        }

        const selectedResource = pushFileResources.find(r => r.id === pushFileSelectedResourceId);
        if (!selectedResource) {
            toast.error('Selected resource not found');
            return;
        }

        pushFileLoading = true;
        console.log('[PushFile] Starting push file operation...', {
            deviceId: device?.id,
            sourcePath: selectedResource.name,
            destinationPath: pushFileDestinationPath.trim(),
            resourceId: pushFileSelectedResourceId
        });

        try {
            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.file.push', {
                deviceId: device?.id,
                sourcePath: selectedResource.name,
                destinationPath: pushFileDestinationPath.trim(),
                resourceId: pushFileSelectedResourceId
            }, { timeoutMs: 60000 });

            console.log('[PushFile] RPC result:', result);

            addAlert('success', result.message || 'File push action sent to device');
            showPushFileModal = false;
        } catch (error) {
            console.error('[PushFile] Push file failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unable to push file. Please try again!';
            console.error('[PushFile] Error message:', errorMessage);
            addAlert('error', errorMessage);
        } finally {
            pushFileLoading = false;
            console.log('[PushFile] Push file operation complete, loading:', pushFileLoading);
        }
    }

    // Load firmware options for Update Firmware modal
    async function loadFirmwareOptions() {
        updateFirmwareOptionsLoading = true;
        try {
            const res = await fetch(`/api/user/resources/firmware?pageSize=100`);
            if (!res.ok) throw new Error('Failed to load firmware');

            const data = await res.json();
            updateFirmwareOptions = (data.items || []).map((item: any) => ({
                id: item.id,
                name: item.name || 'Unknown',
                packageName: item.packageName || '-',
                version: item.version || '-',
                size: formatFileSize(item.size),
                createdOn: formatInstallDate(item.createdAt)
            }));
        } catch (error) {
            console.error('Failed to load firmware:', error);
            updateFirmwareOptions = [];
        } finally {
            updateFirmwareOptionsLoading = false;
        }
    }

    function selectFirmware(firmwareId: string) {
        updateFirmwareSelected = firmwareId;
    }

    // Update Firmware action
    async function confirmUpdateFirmware() {
        if (!updateFirmwareSelected) {
            toast.error('Please select a firmware to update');
            return;
        }

        const selectedFirmware = updateFirmwareOptions.find(fw => fw.id === updateFirmwareSelected);
        if (!selectedFirmware) {
            toast.error('Selected firmware not found');
            return;
        }

        updateFirmwareLoading = true;
        try {
            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.firmware.update', {
                deviceId: device?.id,
                firmwareVersion: selectedFirmware.version || '1.0.0',
                resourceId: updateFirmwareSelected
            }, { timeoutMs: 60000 });

            addAlert('success', result.message || 'Firmware update initiated!');
            showUpdateFirmwareModal = false;
        } catch (error) {
            console.error('Firmware update failed:', error);
            addAlert('error', error instanceof Error ? error.message : 'Unable to update Firmware. Please try again!');
        } finally {
            updateFirmwareLoading = false;
        }
    }

    async function handleReboot() {
        showRebootConfirm = true;
    }

    async function confirmReboot() {
        try {
            addAlert('info', 'Rebooting device...');

            const result = await callUserRpc<{
                success: boolean;
                operationId?: string;
                message?: string;
            }>('device.reboot', {
                deviceId: device?.id
            }, { timeoutMs: 30000 });

            addAlert('success', result.message || 'Device reboot initiated successfully!');
        } catch (error) {
            console.error('Reboot failed:', error);
            addAlert('error', error instanceof Error ? error.message : 'Unable to reboot device. Please try again!');
        }
    }


    async function handleEditDevice() {
        if (!device) return;
        showEditDeviceModal = true;
    }

    async function handleEditDeviceSave() {
        showEditDeviceModal = false;
        await invalidateAll();
        toast.success('Device saved successfully!');
    }

    function handleEditDeviceError(error: string) {
        toast.error(`Unable to save device: ${error}`);
    }

    function handleEditDeviceClose() {
        showEditDeviceModal = false;
    }

    // Copy API Key to clipboard
    async function copyApiKey() {
        if (!device?.apiKey) return;
        try {
            await navigator.clipboard.writeText(device.apiKey);
            toast.success('API Key copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy API Key');
        }
    }

    // Generate new API Key
    let isGeneratingKey = false;
    let generateKeyForm: HTMLFormElement | null = null;

    // Handle button click to show confirm before submitting
    function handleGenerateKeyClick() {
        showGenerateKeyConfirm = true;
    }

    // Confirm and execute key generation (form submit is handled by use:enhance below)
    function confirmGenerateKey() {
        if (!generateKeyForm) return;
        isGeneratingKey = true;
        showGenerateKeyConfirm = false;
        generateKeyForm.requestSubmit();
    }

    // Handle generateApiKey form result (success or 400 error from server)
    function handleGenerateKeyEnhance() {
        return async ({ result }: { result: { type: string; data?: { error?: string } } }) => {
            isGeneratingKey = false;
            if (result.type === 'failure' && result.data?.error) {
                toast.error(result.data.error);
            } else if (result.type === 'success') {
                await invalidate('app:device');
                toast.success('New API Key generated successfully!');
            }
        };
    }

    // Format API Key for display
    function formatApiKey(key: string | null | undefined): string {
        if (!key) return 'N/A';
        if (key.length <= 8) return '••••••••';
        return `${key.substring(0, 4)}••••${key.substring(key.length - 4)}`;
    }
</script>

<!-- Main wrap -->
<div class="device-details-page">
    <!-- Alert notifications (push file error, pull file, reboot, etc.) -->
    {#if alerts.length > 0}
        <div class="page-alerts">
            {#each alerts as alert (alert.id)}
                <Alert
                    severity={alert.severity}
                    variant="filled"
                    message={alert.message}
                    dismissible={true}
                    on:dismiss={() => dismissAlert(alert.id)}
                />
            {/each}
        </div>
    {/if}

    <!-- Edit Device Button - Top Right -->
    <div class="edit-button-wrapper">
        <Button
            variant="filled"
            color="primary"
            size="lg"
            icon={PenLine}
            iconPosition="left"
            on:click={handleEditDevice}
        >
            Edit Device
        </Button>
    </div>

    <!-- Header Section: Device Health + General -->
    <div class="header-section">
        <!-- Device Health Card -->
        <Card variant="default" padding="none" fullWidth={true} class="device-health-card">
            <div slot="header" class="card-header">
                <div class="icon-button">
                    <ScanFace size={20} color="#A3A3A3" />
                </div>
                <div class="content-wrap">
                    <h3 class="card-title">Device Health</h3>
                    <p class="card-subtitle">Real-time CPU, memory, storage, and network status.</p>
                </div>
            </div>

            <!-- Metrics Row: when device is offline, show N/A for all metrics (no real-time data) -->
            <div class="details-wrap">
                <div class="metric-item">
                    <span class="metric-label">Device Uptime</span>
                    <span class="metric-value" style="color: #6941C6;">
                        {isOnline ? formatUptime(deviceInfo?.system_uptime_seconds ?? null) : 'N/A'}
                    </span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">CPU</span>
                    <span class="metric-value" style="color: {isOnline ? getUsageColor(deviceInfo?.cpu_usage ?? null) : getUsageColor(null)};">
                        {isOnline && deviceInfo?.cpu_usage !== null && deviceInfo?.cpu_usage !== undefined ? `${Math.round(deviceInfo.cpu_usage)} %` : 'N/A'}
                    </span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">MEM</span>
                    <span class="metric-value" style="color: {isOnline ? getUsageColor(deviceInfo?.ram_usage ?? null) : getUsageColor(null)};">
                        {isOnline && deviceInfo?.ram_usage != null ? `${Math.round(deviceInfo.ram_usage)} %` : 'N/A'}
                    </span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">DSK</span>
                    <span class="metric-value" style="color: {isOnline ? getUsageColor(deviceInfo?.disk_usage ?? null) : getUsageColor(null)};">
                        {isOnline && deviceInfo?.disk_usage !== null && deviceInfo?.disk_usage !== undefined ? `${Math.round(deviceInfo.disk_usage)} %` : 'N/A'}
                    </span>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
                <Button variant="outline" color="gray" size="md" icon={RefreshCw} iconPosition="left" on:click={handleRefresh}>
                    Refresh
                </Button>
                <Button variant="outline" color="gray" size="md" icon={Camera} iconPosition="left" on:click={handleSnapshot}>
                    Snapshot
                </Button>
                <Button variant="outline" color="gray" size="md" icon={Airplay} iconPosition="left" on:click={handleControl}>
                    Control
                </Button>
                <Button variant="outline" color="gray" size="md" icon={TerminalIcon} iconPosition="left" on:click={handleTerminal}>
                    Terminal
                </Button>
                <Button variant="outline" color="gray" size="md" icon={Upload} iconPosition="left" on:click={handlePushFile}>
                    Push File
                </Button>
                <Button variant="outline" color="gray" size="md" icon={Download} iconPosition="left" on:click={handlePullFile}>
                    Pull File
                </Button>
                <Button variant="outline" color="gray" size="md" icon={BookUp2} iconPosition="left" on:click={handleUpdate}>
                    Update
                </Button>
                <Button variant="outline" color="danger" size="md" icon={Power} iconPosition="left" on:click={handleReboot}>
                    Reboot
                </Button>
            </div>
        </Card>

        <!-- General Card -->
        <Card variant="default" padding="none" class="general-card">
            <div slot="header" class="card-header">
                <div class="icon-button">
                    <Airplay size={20} color="#A3A3A3" />
                </div>
                <div class="content-wrap">
                    <h3 class="card-title">General</h3>
                    <p class="card-subtitle">General information details</p>
                </div>
            </div>

            <!-- Content -->
            <div class="general-content">
                <div class="info-row">
                    <span class="info-label">Connection Status</span>
                    <div class="info-value">
                        <Badge
                            label={isOnline ? 'Online' : 'Offline'}
                            color={isOnline ? 'success' : 'gray'}
                            variant="filled"
                            size="sm"
                        />
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Last Seen</span>
                    <span class="info-value-text">{formatLastSeen(device?.lastUsedAt ?? device?.lastSeenAt ?? deviceInfo?.last_connected_at ?? deviceInfo?.last_status_at ?? device?.disconnectedAt ?? device?.connectedAt)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Public IP</span>
                    <span class="info-value-text">{deviceInfo?.public_ip || device?.ipAddress || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">LAN MAC</span>
                    <span class="info-value-text">{deviceInfo != null ? (deviceInfo.mac_lan || 'N/A') : (device?.lanMac || 'N/A')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Wi-Fi MAC</span>
                    <span class="info-value-text">{deviceInfo != null ? (deviceInfo.mac_wifi || 'N/A') : (device?.wifiMac || 'N/A')}</span>
                </div>
            </div>
        </Card>
    </div>

    <!-- Tabs -->
    <div class="tabs-wrapper">
        <TabGroup
            {tabs}
            activeTab={activeTab}
            type="underline"
            size="md"
            fullWidth={false}
            on:change={handleTabChange}
        />
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
        {#if activeTab === 'details'}
            <div class="details-grid">
                <!-- Left Column -->
                <div class="details-column">
                    <!-- Device Information Card -->
                    <Card variant="default" padding="none" class="info-card">
                        <div slot="header" class="info-card-header">
                            <div class="icon-wrap">
                                <Info size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Device Information</h4>
                                <p>General details and identification information.</p>
                            </div>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">Device State</span>
                                <Badge
                                    label={isActive ? 'Active' : 'Inactive'}
                                    color={isActive ? 'success' : 'gray'}
                                    variant="filled"
                                    size="sm"
                                    showDot={true}
                                />
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Device Name</span>
                                <span class="value">{device?.name || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Assigned Profile</span>
                                {#if data.deviceProfile?.name}
                                    <a href="/user/iot/profiles/{data.deviceProfile.id}" class="value link">{data.deviceProfile.name}</a>
                                {:else}
                                    <span class="value">None</span>
                                {/if}
                            </div>
                            <div class="info-row-detail description">
                                <span class="label">Description</span>
                                <p class="description-text">{device?.description || 'No description provided.'}</p>
                            </div>
                            {#if device?.tags && device.tags.length > 0}
                                <div class="tags-row">
                                    {#each device.tags as tag}
                                        <Tag label={tag.name || tag} size="sm" />
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </Card>

                    <!-- Technical Details Card -->
                    <Card variant="default" padding="none" class="info-card">
                        <div slot="header" class="info-card-header">
                            <div class="icon-wrap">
                                <Cpu size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Technical Details</h4>
                                <p>Hardware, OS and firmware information</p>
                            </div>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">OS Version</span>
                                <span class="value">{deviceInfo?.os_version || device?.osVersion || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Firmware</span>
                                <span class="value">{deviceInfo?.firmware || device?.firmwareVersion || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Model</span>
                                <span class="value">{deviceInfo?.model || device?.model || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Operating System</span>
                                <span class="value">{device?.deviceType || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Manufacturer</span>
                                <span class="value">{device?.manufacturer || deviceInfo?.manufacturer || '-'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Hardware ID</span>
                                <span class="value">{device?.hardwareId || deviceInfo?.hardware_id || '-'}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <!-- Right Column -->
                <div class="details-column">
                    <!-- Network Information Card -->
                    <Card variant="default" padding="none" class="info-card">
                        <div slot="header" class="info-card-header">
                            <div class="icon-wrap">
                                <Wifi size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Network Information</h4>
                                <p>Connection, signal strength, and IP details</p>
                            </div>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">Connection Status</span>
                                <Badge
                                    label={isOnline ? 'Online' : 'Offline'}
                                    color={isOnline ? 'success' : 'gray'}
                                    size="sm"
                                    showDot={false}
                                />
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Last Seen</span>
                                <span class="value">{formatLastSeen(device?.lastUsedAt ?? device?.lastSeenAt ?? deviceInfo?.last_connected_at ?? deviceInfo?.last_status_at ?? device?.disconnectedAt ?? device?.connectedAt)}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Network Interface</span>
                                <span class="value">{deviceInfo?.network_interface || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Wi-Fi SSID</span>
                                <span class="value">{deviceInfo?.wifi_ssid || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Signal Strength</span>
                                <span class="value">{deviceInfo?.signal_strength_dbm ? `${deviceInfo.signal_strength_dbm} dBm` : 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Public IP</span>
                                <span class="value">{deviceInfo?.public_ip || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Private IP</span>
                                <span class="value">{deviceInfo?.private_ip || device?.ipAddress || 'N/A'}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">LAN MAC</span>
                                <span class="value">{deviceInfo != null ? (deviceInfo.mac_lan || 'N/A') : (device?.lanMac || 'N/A')}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Wi-Fi MAC</span>
                                <span class="value">{deviceInfo != null ? (deviceInfo.mac_wifi || 'N/A') : (device?.wifiMac || 'N/A')}</span>
                            </div>
                            <div class="info-row-detail">
                                <span class="label">Primary MAC</span>
                                <span class="value">{device?.macAddress || 'N/A'}</span>
                            </div>
                        </div>
                    </Card>

                    <!-- Security Card -->
                    <Card variant="default" padding="none" class="info-card security-card">
                        <div slot="header" class="info-card-header">
                            <div class="icon-wrap">
                                <Shield size={20} color="#A3A3A3" />
                            </div>
                            <div class="header-text">
                                <h4>Security</h4>
                                <p>API keys, licenses, and security settings</p>
                            </div>
                            <form
                                bind:this={generateKeyForm}
                                method="POST"
                                action="?/generateApiKey"
                                style="display: inline-block"
                                use:enhance={handleGenerateKeyEnhance}
                            >
                                <Button
                                    type="button"
                                    variant="text"
                                    color="primary"
                                    size="sm"
                                    icon={RefreshCw}
                                    iconPosition="left"
                                    disabled={isGeneratingKey}
                                    loading={isGeneratingKey}
                                    on:click={handleGenerateKeyClick}
                                >
                                    {isGeneratingKey ? 'Generating...' : 'Generate New Key'}
                                </Button>
                            </form>
                        </div>
                        <div class="info-card-body">
                            <div class="info-row-detail">
                                <span class="label">API Key</span>
                                <div class="api-key-value">
                                    <span class="api-key-text">{formatApiKey(device?.apiKey)}</span>
                                    {#if device?.apiKey}
                                        <Button
                                            variant="ghost"
                                            color="gray"
                                            size="sm"
                                            icon={Link2}
                                            iconPosition="only"
                                            on:click={copyApiKey}
                                            title="Copy API Key"
                                        />
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

        {:else if activeTab === 'configuration'}
            <!-- Key on profile so section re-renders when load returns after save -->
            {#key (deviceProfile?.overrideCount ?? 0) + (deviceProfile?.settings?.length ?? 0)}
            <Card variant="default" padding="none" class="config-card">
                <!-- Header -->
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
                            <span class="cell-value">{getProfileSetting('display_resolution', deviceInfo?.resolution || '-')}</span>
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
                            <span class="cell-value">{getProfileSetting('screen_orientation', deviceInfo?.orientation || '-')}</span>
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
                            <span class="cell-value">{getProfileSetting('brightness_level', '-')}{getProfileSetting('brightness_level', '') ? '%' : ''}</span>
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
                            <span class="cell-value">{getProfileSetting('enable_audio', '-')}</span>
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
                            <span class="cell-value">{getProfileSetting('volume_level', '-')}{getProfileSetting('volume_level', '') ? '%' : ''}</span>
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
                            <span class="cell-value">{getProfileSetting('timezone', deviceInfo?.timezone || '-')}</span>
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
                            <div class="launcher-value">
                                <span class="cell-value">{getProfileSettingParsed('home_launcher', 'value', '-')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Schedule Settings Section -->
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
                            {#if getProfileSetting('power_management_schedule', 'Disable') === 'Enable'}
                                <div class="schedule-detail">
                                    <span class="schedule-badge enabled">Enabled</span>
                                    <div class="schedule-items">
                                        <span class="schedule-item"><span class="schedule-label">On:</span> {getProfileSetting('power_on_datetime', '-').replace('T', ' ')}</span>
                                        <span class="schedule-item"><span class="schedule-label">Off:</span> {getProfileSetting('power_off_datetime', '-').replace('T', ' ')}</span>
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
                            {#if getProfileSetting('reboot_schedule_enabled', 'Disable') === 'Enable'}
                                <div class="schedule-detail">
                                    <span class="schedule-badge enabled">Enabled</span>
                                    <div class="schedule-items">
                                        <span class="schedule-item"><span class="schedule-label">Frequency:</span> <span style="text-transform: capitalize;">{getProfileSetting('reboot_schedule_frequency', 'daily')}</span></span>
                                        {#if getProfileSetting('reboot_schedule_frequency', 'daily') === 'weekly'}
                                            <span class="schedule-item"><span class="schedule-label">Day:</span> <span style="text-transform: capitalize;">{getProfileSetting('reboot_schedule_day', 'monday')}</span></span>
                                        {/if}
                                        <span class="schedule-item"><span class="schedule-label">Time:</span> {getProfileSetting('reboot_schedule_time', '02:00')}</span>
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
                            {#if getProfileSetting('download_schedule_enabled', 'Disable') === 'Enable'}
                                <div class="schedule-detail">
                                    <span class="schedule-badge enabled">Enabled</span>
                                    <div class="schedule-items">
                                        <span class="schedule-item"><span class="schedule-label">Frequency:</span> <span style="text-transform: capitalize;">{getProfileSetting('download_schedule_frequency', 'daily')}</span></span>
                                        {#if getProfileSetting('download_schedule_frequency', 'daily') === 'weekly'}
                                            <span class="schedule-item"><span class="schedule-label">Day:</span> <span style="text-transform: capitalize;">{getProfileSetting('download_schedule_day', 'monday')}</span></span>
                                        {/if}
                                        <span class="schedule-item"><span class="schedule-label">Time:</span> {getProfileSetting('download_schedule_time', '03:00')}</span>
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

        {:else if activeTab === 'apps'}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <Card variant="default" padding="none" class="apps-card">
                <div slot="header" class="apps-header">
                    <div class="apps-icon-wrap">
                        <Server size={20} color="#A3A3A3" />
                    </div>
                    <div class="apps-header-text">
                        <h4>Installed Apps</h4>
                        <p>List of installed apps. Pinned apps are shown first.</p>
                    </div>
                    <Button
                        variant="outline"
                        color="primary"
                        size="md"
                        icon={Plus}
                        iconPosition="left"
                        on:click={openInstallAppModal}
                    >
                        Install New App
                    </Button>
                </div>

                <div>
                {#if appsLoading}
                    <div class="apps-loading">
                        <div class="loading-spinner"></div>
                        <span>Loading apps...</span>
                    </div>
                {:else if appsError}
                    <div class="no-data-state">
                        <PackageOpen size={72} color="#A3A3A3" strokeWidth={1.5} />
                        <p class="no-data-state-text">No Data Available</p>
                        <div class="no-data-state-actions">
                            <Button variant="filled" color="primary" size="sm" on:click={loadApps}>Retry</Button>
                        </div>
                    </div>
                {:else if apps.length === 0}
                    <div class="no-data-state">
                        <PackageOpen size={72} color="#A3A3A3" strokeWidth={1.5} />
                        <p class="no-data-state-text">No Data Available</p>
                    </div>
                {:else}
                    <DataTable
                        columns={appsColumns}
                        data={apps}
                        keyField="package_name"
                        sortable={true}
                        paginated={true}
                        pagination={{
                            page: appsCurrentPage,
                            pageSize: appsPageSize,
                            totalItems: appsTotalCount,
                            totalPages: appsTotalPages
                        }}
                        on:pageChange={(e) => {
                            appsCurrentPage = e.detail;
                            loadApps();
                        }}
                        loading={appsLoading}
                        emptyMessage="No apps installed on this device"
                        compact={true}
                        bordered={false}
                        cellBorders={false}
                    />
                {/if}
            </Card>

        {:else if activeTab === 'deployments'}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <Card variant="default" padding="none" class="deployments-card">
                <div slot="header" class="deployments-header">
                    <div class="deployments-icon-wrap">
                        <GitFork size={20} color="#A3A3A3" />
                    </div>
                    <div class="deployments-header-text">
                        <h4>Bulk Deployments</h4>
                        <p>Configuration setup of this device</p>
                    </div>
                </div>

                <div>
                {#if deploymentsLoading}
                    <div class="deployments-loading">
                        <div class="loading-spinner"></div>
                        <span>Loading deployments...</span>
                    </div>
                {:else if deployments.length === 0}
                    <div class="deployments-empty">
                        <GitFork size={48} color="#D6D6D6" />
                        <p>No deployments found for this device</p>
                        <Button
                            variant="primary"
                            size="medium"
                            class="btn-compact-padding"
                            on:click={() => goto('/user/iot/bundles')}
                        >
                            Go to Bundles
                        </Button>
                    </div>
                {:else}
                    <DataTable
                        columns={deploymentColumns}
                        data={deployments}
                        keyField="id"
                        sortable={true}
                        paginated={true}
                        pagination={{
                            page: deploymentsCurrentPage,
                            pageSize: deploymentsPageSize,
                            totalItems: deploymentsTotalCount,
                            totalPages: deploymentsTotalPages
                        }}
                        on:pageChange={(e) => {
                            deploymentsCurrentPage = e.detail;
                            loadDeployments();
                        }}
                        loading={deploymentsLoading}
                        emptyMessage="No deployments found for this device"
                        compact={true}
                        bordered={false}
                        cellBorders={false}
                    />
                {/if}
                </div>
            </Card>

        {:else if activeTab === 'activity'}
            <Card variant="default" padding="none" class="activity-card">
                <div slot="header" class="activity-header-with-action">
                    <div class="info-card-header">
                        <div class="icon-wrap">
                            <History size={20} color="#A3A3A3" />
                        </div>
                        <div class="header-text">
                            <h4>Activity Logs</h4>
                            <p>History of all actions performed on this device.</p>
                        </div>
                    </div>
                    <Button
                        class="download-logs-btn"
                        variant="outline"
                        color="primary"
                        size="md"
                        icon={downloadLogsLoading ? undefined : Download}
                        iconPosition="left"
                        disabled={downloadLogsLoading}
                        on:click={handleDownloadLogs}
                    >
                        {#if downloadLogsLoading}
                            Requesting logs...
                        {:else}
                            Download Logs
                        {/if}
                    </Button>
                </div>
                <div class="activity-body">
                    {#if activityLogsLoading}
                        <div class="loading-state">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p>Loading activity logs...</p>
                        </div>
                    {:else if activityLogs.length === 0}
                        <div class="empty-state">
                            <History size={48} color="#D6D6D6" />
                            <p>No activity logs found for this device.</p>
                        </div>
                    {:else}
                        <!-- Activity Logs: custom layout kept because DataTable does not support expandable/detail rows yet -->
                        <div class="activity-table-wrap">
                            <!-- Table Header -->
                            <div class="activity-table-header">
                                <div class="activity-header-cell activity-col-expand">
                                    <ChevronRight size={20} color="#525252" />
                                </div>
                                <div class="activity-header-cell activity-col-event">
                                    <span class="header-text">Date & Time</span>
                                </div>
                                <div class="activity-header-cell activity-col-description">
                                    <span class="header-text">Action Type</span>
                                </div>
                                <div class="activity-header-cell activity-col-status">
                                    <span class="header-text">Status</span>
                                </div>
                            </div>

                            <!-- Table Body -->
                            {#each activityLogs as log (log.id)}
                                <!-- Main Row -->
                                <div class="activity-row" class:expanded={log.expanded}>
                                    <div class="activity-cell activity-col-expand">
                                        <Button
                                            variant="text"
                                            color="gray"
                                            size="sm"
                                            icon={log.expanded ? ChevronDown : ChevronRight}
                                            iconPosition="only"
                                            disabled={!log.details || log.details.length === 0}
                                            on:click={() => toggleActivityLogExpansion(log.id)}
                                        />
                                    </div>
                                    <div class="activity-cell activity-col-event">
                                        <span class="event-name">{log.eventName}</span>
                                    </div>
                                    <div class="activity-cell activity-col-description">
                                        <span class="description-text">{log.description}</span>
                                    </div>
                                    <div class="activity-cell activity-col-status">
                                        <Badge
                                            label={log.status}
                                            color={getActivityLogBadgeColor(log.status)}
                                            variant="filled"
                                            size="sm"
                                            showDot={true}
                                        />
                                    </div>
                                </div>

                                <!-- Expanded Details -->
                                {#if log.expanded && log.details && log.details.length > 0}
                                    <div class="activity-details-row">
                                        <div class="activity-details-spacer"></div>
                                        <div class="activity-details-divider">
                                            <div class="divider-line"></div>
                                        </div>
                                        <div class="activity-details-content">
                                            {#each log.details as detail}
                                                <div class="detail-item">
                                                    <span class="detail-label">{detail.label}</span>
                                                    {#if detail.oldValue}
                                                        <span class="detail-old-value">{detail.oldValue}</span>
                                                    {/if}
                                                    <ArrowRight size={20} color="#292929" />
                                                    {#if detail.tags && detail.tags.length > 0}
                                                        <div class="detail-tags">
                                                            {#each detail.tags as tag}
                                                                <span class="detail-tag">{tag}</span>
                                                            {/each}
                                                        </div>
                                                    {:else}
                                                        <span class="detail-new-value">{detail.newValue}</span>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>

                        <!-- Pagination -->
                        <div class="activity-pagination">
                            <span class="pagination-details">{((activityLogsCurrentPage - 1) * activityLogsPageSize) + 1} - {Math.min(activityLogsCurrentPage * activityLogsPageSize, activityLogsTotalCount)} of {activityLogsTotalCount}</span>
                            <div class="pagination-controls">
                                <Button
                                    variant="ghost"
                                    color="gray"
                                    size="sm"
                                    icon={ChevronLeft}
                                    iconPosition="only"
                                    disabled={activityLogsCurrentPage === 1}
                                    on:click={() => { activityLogsCurrentPage = Math.max(1, activityLogsCurrentPage - 1); loadActivityLogs(); }}
                                />
                                <div class="page-number">{activityLogsCurrentPage}</div>
                                <Button
                                    variant="ghost"
                                    color="gray"
                                    size="sm"
                                    icon={ChevronRight}
                                    iconPosition="only"
                                    disabled={activityLogsCurrentPage === activityLogsTotalPages}
                                    on:click={() => { activityLogsCurrentPage = Math.min(activityLogsTotalPages, activityLogsCurrentPage + 1); loadActivityLogs(); }}
                                />
                            </div>
                        </div>
                    {/if}
                </div>
            </Card>
        {/if}
    </div>
</div>

<!-- Edit Device Modal (Shared Component) -->
<ScreenshotModal
    open={screenshotOpen}
    imageData={screenshotData}
    format={screenshotFormat}
    onClose={() => {
        screenshotOpen = false;
        screenshotData = null;
    }}
/>

<!-- Reboot Confirmation Dialog -->
<ConfirmationDialog
    bind:open={showRebootConfirm}
    title="Reboot Device"
    description="Are you sure you want to reboot this device? This will restart the device and may take a few minutes."
    confirmText="Reboot"
    cancelText="Cancel"
    onConfirm={confirmReboot}
/>

<!-- Generate API Key Confirmation Dialog -->
<ConfirmationDialog
    bind:open={showGenerateKeyConfirm}
    title="Generate New API Key"
    description="Are you sure you want to generate a new API Key? The old key will be invalidated and any applications using it will need to be updated."
    confirmText="Generate"
    cancelText="Cancel"
    onConfirm={confirmGenerateKey}
/>

<!-- Uninstall App Confirmation (same ConfirmModal as Delete Resource / Delete Device) -->
<ConfirmModal
    open={showUninstallAppConfirm}
    title="Uninstall App"
    description={uninstallAppTarget ? `Are you sure you want to uninstall "${uninstallAppTarget.app_name}"?` : ''}
    cancelText="Cancel"
    confirmText="Uninstall"
    on:close={() => { showUninstallAppConfirm = false; uninstallAppTarget = null; }}
    on:confirm={confirmUninstallApp}
/>

<EditDeviceModal
    bind:open={showEditDeviceModal}
    device={device}
    availableTags={availableTags}
    availableProfiles={availableProfiles}
    saveActionUrl="/user/iot/devices?/updateDevice"
    onSaveSuccess={handleEditDeviceSave}
    onSaveError={handleEditDeviceError}
    on:close={handleEditDeviceClose}
    on:save={async () => {
        await invalidateAll();
    }}
/>

<!-- Pull File Modal -->
<Modal
    open={showPullFileModal}
    title="Pull File"
    size="md"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => showPullFileModal = false}
>
    <!-- Source File Path Input - Using InputField from design-system -->
    <div class="flex flex-col gap-4 w-full">
        <InputField
            id="pull-file-source"
            label="Source File Path on Device"
            placeholder="eg: /home/user/documents/file.txt"
            bind:value={pullFileSourcePath}
            required={true}
        />

        <!-- Info Box - Styled to match design-system -->
        <div class="pull-file-info-box">
            <div class="pull-file-info-header">
                <Info size={20} color="#525252" />
                <span class="pull-file-info-title">File Transfer Information</span>
            </div>
            <ul class="pull-file-info-list">
                <li>The file will be streamed from the device to the server</li>
                <li>Large files may take several minutes to transfer</li>
                <li>You can monitor progress in the action logs</li>
                <li>The file will be saved to the server's resource storage</li>
            </ul>
        </div>
    </div>

    <!-- Footer -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            on:click={() => showPullFileModal = false}
            disabled={pullFileLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={executePullFile}
            disabled={pullFileLoading || !pullFileSourcePath.trim()}
            loading={pullFileLoading}
        >
            {pullFileLoading ? 'Pulling…' : 'Pull File'}
        </Button>
    </div>
</Modal>

<!-- Push File Modal -->
<Modal
    open={showPushFileModal}
    title="Push File"
    size="lg"
    overlayBg="rgba(0, 78, 235, 0.03)"
    closeOnBackdrop={false}
    closeOnEscape={true}
    showFooter={true}
    on:close={() => showPushFileModal = false}
>
    <div class="flex flex-col gap-4 w-full">
        <!-- Destination Path Input - Using InputField from design-system -->
        <InputField
            id="push-file-destination"
            label="Destination Path on Device"
            placeholder="eg: /home/user/downloads/"
            bind:value={pushFileDestinationPath}
            required={true}
        />

        <!-- Search Input - Using InputField with suffix icon -->
        <InputField
            id="push-file-search"
            type="search"
            placeholder="Search files"
            bind:value={pushFileSearchTerm}
            suffixIcon={true}
            on:input={() => { pushFileCurrentPage = 1; loadPushFileResources(); }}
        >
            <Search slot="suffix-icon" size={22} color="#292929" />
        </InputField>

        <!-- File List - Using Radio from design-system -->
        <div class="flex flex-col gap-2" style="max-height: 300px; overflow-y: auto;">
            {#if pushFileResourcesLoading}
                <div class="flex items-center justify-center py-8">
                    <span style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; color: #737373;">Loading files...</span>
                </div>
            {:else if pushFileResources.length === 0}
                <div class="flex items-center justify-center py-8">
                    <span style="font-family: var(--ds-font-family-primary); font-weight: 400; font-size: 14px; color: #737373;">No files found</span>
                </div>
            {:else}
                {#each pushFileResources as resource}
                    <button
                        type="button"
                        class="push-file-item"
                        class:selected={pushFileSelectedResourceId === resource.id}
                        on:click={() => pushFileSelectedResourceId = resource.id}
                    >
                        <div class="push-file-item-content">
                            <!-- Radio indicator -->
                            <div class="push-file-radio" class:checked={pushFileSelectedResourceId === resource.id}>
                                {#if pushFileSelectedResourceId === resource.id}
                                    <div class="push-file-radio-dot"></div>
                                {/if}
                            </div>

                            <!-- File info -->
                            <div class="push-file-info">
                                <span class="push-file-name">{resource.name}</span>
                                <span class="push-file-package">{resource.packageName || '-'}</span>
                            </div>

                            <!-- Meta info -->
                            <div class="push-file-meta">
                                <div class="push-file-meta-item">
                                    <span class="push-file-meta-label">Version</span>
                                    <span class="push-file-meta-value">{resource.version || '-'}</span>
                                </div>
                                <div class="push-file-meta-item">
                                    <span class="push-file-meta-label">Size</span>
                                    <span class="push-file-meta-value">{formatFileSize(resource.size)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="push-file-created">
                            Created On: {formatInstallDate(resource.createdAt)}
                        </div>
                    </button>
                {/each}
            {/if}
        </div>

        <!-- Pagination -->
        {#if pushFileTotalPages > 1}
            <div class="push-file-pagination">
                <span class="push-file-pagination-text">
                    {(pushFileCurrentPage - 1) * pushFilePageSize + 1} - {Math.min(pushFileCurrentPage * pushFilePageSize, pushFileTotalCount)} of {pushFileTotalCount}
                </span>
                <div class="push-file-pagination-controls">
                    <Button
                        variant="ghost"
                        color="gray"
                        size="sm"
                        icon={ChevronsLeft}
                        iconPosition="only"
                        disabled={pushFileCurrentPage === 1}
                        on:click={() => { pushFileCurrentPage = 1; loadPushFileResources(); }}
                    />
                    <Button
                        variant="ghost"
                        color="gray"
                        size="sm"
                        icon={ChevronLeft}
                        iconPosition="only"
                        disabled={pushFileCurrentPage === 1}
                        on:click={() => { pushFileCurrentPage--; loadPushFileResources(); }}
                    />
                    <div class="push-file-pagination-current">
                        <span>{pushFileCurrentPage}</span>
                    </div>
                    <Button
                        variant="ghost"
                        color="gray"
                        size="sm"
                        icon={ChevronRight}
                        iconPosition="only"
                        disabled={pushFileCurrentPage === pushFileTotalPages}
                        on:click={() => { pushFileCurrentPage++; loadPushFileResources(); }}
                    />
                    <Button
                        variant="ghost"
                        color="gray"
                        size="sm"
                        icon={ChevronsRight}
                        iconPosition="only"
                        disabled={pushFileCurrentPage === pushFileTotalPages}
                        on:click={() => { pushFileCurrentPage = pushFileTotalPages; loadPushFileResources(); }}
                    />
                </div>
            </div>
        {/if}
    </div>

    <!-- Footer - Using Modal's default footer slot -->
    <div slot="footer" class="flex items-center justify-end gap-4 w-full">
        <Button
            variant="outline"
            color="primary"
            size="lg"
            on:click={() => showPushFileModal = false}
            disabled={pushFileLoading}
        >
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={executePushFile}
            disabled={pushFileLoading || !pushFileSelectedResourceId || !pushFileDestinationPath.trim()}
            loading={pushFileLoading}
        >
            {pushFileLoading ? 'Pushing…' : 'Confirm'}
        </Button>
    </div>
</Modal>

<!-- Install New App Modal (shared component) -->
<AppPickerModal
    open={showInstallAppModal}
    title="Install New App"
    size="md"
    confirmText="Confirm"
    confirmLoadingText="Installing…"
    confirmLoading={installAppLoading}
    appsEndpoint="/api/user/resources/apps"
    {installedPackageNames}
    showAlreadyBadge={true}
    selectionMode="id"
    on:close={() => (showInstallAppModal = false)}
    on:confirm={handleInstallAppConfirm}
/>

<!-- Update Firmware Modal (Figma - 880px width, matching listing page) -->
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
        <InputField
            id="update-firmware-search"
            type="search"
            placeholder="Search and select firmware"
            bind:value={updateFirmwareSearch}
            suffixIcon={true}
            on:input={() => updateFirmwarePage = 1}
        >
            <Search slot="suffix-icon" size={22} color="#292929" />
        </InputField>
    </div>

    <!-- Firmware List with Radio Buttons -->
    <div class="w-full flex flex-col" style="gap: 8px; max-height: 350px; overflow-y: auto;">
        {#if updateFirmwareOptionsLoading}
            <div class="px-4 py-8 text-center" style="font-family: var(--ds-font-family-primary); font-size: 14px; color: #667085; background: #FAFAFA; border-radius: 6px;">
                Loading firmware...
            </div>
        {:else}
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
            <div class="flex items-center" style="gap: var(--ds-space-1);">
                <!-- First Page -->
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronsLeft}
                    iconPosition="only"
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = 1}
                />
                <!-- Previous Page -->
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronLeft}
                    iconPosition="only"
                    disabled={updateFirmwarePage === 1}
                    on:click={() => updateFirmwarePage = Math.max(1, updateFirmwarePage - 1)}
                />
                <!-- Current Page -->
                <div
                    class="flex items-center justify-center"
                    style="
                        width: 40px;
                        height: 40px;
                        background: var(--ds-color-gray-50);
                        border-radius: var(--ds-radius-lg);
                    "
                >
                    <span style="font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); font-weight: var(--ds-font-medium); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800);">
                        {updateFirmwarePage}
                    </span>
                </div>
                <!-- Next Page -->
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronRight}
                    iconPosition="only"
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = Math.min(updateFirmwareTotalPages, updateFirmwarePage + 1)}
                />
                <!-- Last Page -->
                <Button
                    variant="ghost"
                    color="gray"
                    size="sm"
                    icon={ChevronsRight}
                    iconPosition="only"
                    disabled={updateFirmwarePage >= updateFirmwareTotalPages}
                    on:click={() => updateFirmwarePage = updateFirmwareTotalPages}
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
            style="height: 44px; min-width: 100px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            {updateFirmwareLoading ? 'Updating…' : 'Confirm'}
        </Button>
    </div>
</Modal>

<style>
    /* Padding match listing: 24px, gap 16px */
    .device-details-page {
        display: flex;
        flex-direction: column;
        padding: 24px;
        gap: 16px;
        font-family: var(--ds-font-family-primary);
        background: var(--ds-bg-secondary);
        min-height: 100%;
    }

    /* Alert notifications (push file error, etc.) - fixed bottom-right to match toast position */
    .page-alerts {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        max-width: 420px;
        pointer-events: auto;
    }

    /* Edit Button */
    .edit-button-wrapper {
        display: flex;
        justify-content: flex-end;
        width: 100%;
    }

    @media (max-width: 500px) {
        .edit-button-wrapper {
            justify-content: stretch;
        }

        .edit-button-wrapper :global(button) {
            width: 100%;
        }
    }

    /* Header Section - Grid layout for better proportional control */
    .header-section {
        display: grid;
        grid-template-columns: 2fr 426px;
        gap: var(--ds-space-4);
        width: 100%;
        align-items: stretch;
    }

    /* On larger screens, ensure proper proportions */
    @media (min-width: 1201px) {
        .header-section {
            grid-template-columns: minmax(0, 2fr) 426px;
        }
    }

    /* Device Health Card - Override layout properties only */
    :global(.device-health-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        min-width: 0 !important;
    }

    .device-health-card {
        width: 100%;
        min-width: 0;
    }

    .card-header {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-2);
        border-bottom: 1px solid var(--ds-border-default);
    }

    .icon-button {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--ds-space-3);
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
    }

    .content-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-0-5);
        flex: 1;
    }

    .card-title {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-lg);
        line-height: var(--ds-leading-md);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .card-subtitle {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }

    /* Metrics Row */
    .details-wrap {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-4);
        flex-wrap: wrap;
    }

    .metric-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1 1 auto;
        min-width: 120px;
    }

    .metric-label {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }

    .metric-value {
        font-weight: 600;
        font-size: 26px;
        line-height: 32px;
        letter-spacing: -0.005em;
    }

    /* Quick Actions */
    .quick-actions {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-default);
    }

    /* General Card - Override layout properties only */
    :global(.general-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        max-width: 426px !important;
    }

    .general-card {
        width: 100%;
        max-width: 426px;
    }

    .general-content {
        display: flex;
        flex-direction: column;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-4);
    }

    .info-row {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: var(--ds-space-4);
    }

    .info-label {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }

    .info-value {
        display: flex;
        align-items: center;
    }

    .info-value-text {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
        text-align: right;
    }

    /* Tabs Wrapper */
    .tabs-wrapper {
        /*margin-top: 8px;*/
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    .tabs-wrapper::-webkit-scrollbar {
        height: 4px;
    }

    .tabs-wrapper::-webkit-scrollbar-track {
        background: transparent;
    }

    .tabs-wrapper::-webkit-scrollbar-thumb {
        background: #D6D6D6;
        border-radius: 2px;
    }

    .tabs-wrapper::-webkit-scrollbar-thumb:hover {
        background: #A3A3A3;
    }

    /* Tab Content */
    .tab-content {
        margin-top: 16px;
    }

    /* Details Grid - 2 columns layout */
    .details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ds-space-4);
    }

    .details-column {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    /* Info Card */
    /* Info Card - No overrides needed, Card component handles styling */

    /* Info Card - Override layout properties only */
    :global(.info-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
    }

    .info-card-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-3);
        border-bottom: 1px solid var(--ds-border-default);
        min-height: 60px;
        box-sizing: border-box;
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

    .info-card-body {
        display: flex;
        flex-direction: column;
        padding: 0;
    }

    .info-row-detail {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding: var(--ds-space-3) var(--ds-card-padding-md);
        min-height: 44px;
    }

    .info-row-detail .label {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }

    .info-row-detail .value {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
        text-align: right;
    }

    .info-row-detail .value.link {
        color: #0086C9;
        text-decoration: none;
    }

    .info-row-detail .value.link:hover {
        text-decoration: underline;
    }

    .info-row-detail.description {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 16px;
    }

    .description-text {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
        margin: 0;
    }

    .tags-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 16px 16px 16px;
    }

    /* Security Card */
    .security-card .info-card-header {
        flex-wrap: wrap;
        gap: var(--ds-space-2);
    }

    .security-card .info-card-header form {
        margin-left: auto;
        width: 100%;
    }

    @media (min-width: 501px) {
        .security-card .info-card-header form {
            width: auto;
        }
    }

    .api-key-value {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .api-key-text {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #141414;
    }

    /* Configuration Card - Override layout properties only */
    :global(.config-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: var(--ds-space-4) !important;
    }

    /* Align with tab Details: padding="none" + header/body manage own padding like info-card */
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

    /* Round bottom corners for last row cells */
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
        min-width: 0; /* allow shrink within grid minmax */
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

    /* Schedule grouped display */
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

    .launcher-value {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-4);
    }

    /* Apps Card - Override layout properties only */
    :global(.apps-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        gap: var(--ds-space-4) !important;
    }

    /* Align with tab Details: padding="none" + header has padding like info-card-header */
    .apps-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-2);
        min-height: 60px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--ds-border-default);
    }

    :global(.apps-card .card-body) {
        padding: var(--ds-card-padding-md);
    }

    /* Installed Apps table: no border (per design) – use DataTable bordered={false} cellBorders={false} */
    :global(.apps-card .ds-datatable) {
        border: none !important;
    }

    .apps-icon-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--ds-space-3);
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
    }

    .apps-header-text {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-0-5);
        flex: 1;
    }

    .apps-header-text h4 {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-lg);
        line-height: var(--ds-leading-md);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .apps-header-text p {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }

    .apps-loading,
    .no-data-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-12);
        gap: var(--ds-space-4);
    }

    .apps-loading span {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-tertiary);
        margin: 0;
    }

    .no-data-state-text {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-base);
        font-weight: var(--ds-font-regular);
        color: #A3A3A3;
        margin: 0;
    }

    .no-data-state-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
        justify-content: center;
    }

    .loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #E5E5E5;
        border-top-color: #0086C9;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .apps-table-wrap {
        display: flex;
        flex-direction: column;
        background: var(--ds-color-white);
        border-radius: var(--ds-radius-lg);
        overflow: hidden;
    }

    .apps-table {
        width: 100%;
        border-collapse: collapse;
    }

    .apps-table thead {
        background: var(--ds-color-neutral-true-100, #F5F5F5);
    }

    .apps-table th {
        padding: var(--ds-space-3) var(--ds-card-padding-md);
        text-align: left;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-secondary);
        border-bottom: 1px solid var(--ds-border-default);
    }

    .apps-table td {
        padding: var(--ds-card-padding-md);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
        border-bottom: 1px solid var(--ds-border-default);
        vertical-align: middle;
        background: var(--ds-color-white);
    }

    /* Round bottom corners for last row cells */
    .apps-table tbody tr:last-child td:first-child {
        border-bottom: none;
        border-bottom-left-radius: var(--ds-radius-lg);
    }

    .apps-table tbody tr:last-child td:last-child {
        border-bottom: none;
        border-bottom-right-radius: var(--ds-radius-lg);
    }

    .apps-table tbody tr:not(:last-child) td {
        border-bottom: 1px solid var(--ds-border-default);
    }

    .col-pin {
        width: 52px;
        padding: var(--ds-card-padding-md) !important;
    }

    .col-app {
        min-width: 400px;
    }

    .col-type {
        width: 150px;
    }

    .col-version {
        width: 100px;
    }

    .col-size {
        width: 100px;
    }

    .col-installed {
        width: 200px;
    }

    .col-actions {
        width: 78px;
        text-align: center;
    }

    .app-details {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .app-name {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
    }

    .app-package {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-tertiary);
    }

    /* Pagination */
    .apps-pagination {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        padding: var(--ds-space-2) var(--ds-space-6);
        gap: var(--ds-space-2);
        border-top: 1px solid var(--ds-border-default);
    }

    .pagination-info {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }

    .pagination-controls {
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
    }

    .page-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: var(--ds-color-gray-50);
        border-radius: var(--ds-radius-lg);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        text-align: center;
        color: var(--ds-color-gray-800);
    }

    /* Deployments Card - Override layout properties only */
    :global(.deployments-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        gap: var(--ds-space-4) !important;
    }

    /* Align with tab Details: padding="none" + header has padding like info-card-header */
    .deployments-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-2);
        min-height: 60px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--ds-border-default);
    }

    :global(.deployments-card .card-body) {
        padding: var(--ds-card-padding-md);
    }

    /* Deployments table: no border (per design) – use DataTable bordered={false} cellBorders={false} */
    :global(.deployments-card .ds-datatable) {
        border: none !important;
    }

    .deployments-icon-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--ds-space-3);
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-lg);
    }

    .deployments-header-text {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-0-5);
        flex: 1;
    }

    .deployments-header-text h4 {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-lg);
        line-height: var(--ds-leading-md);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .deployments-header-text p {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }

    .deployments-loading,
    .deployments-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-12);
        gap: var(--ds-space-4);
    }

    .deployments-loading span,
    .deployments-empty p {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-tertiary);
        margin: 0;
    }

    /* Bulk Deployments table – aligned with Figma spec */
    .deployments-table-wrap {
        display: flex;
        flex-direction: column;
        background: var(--ds-color-white);
        border-radius: 9px; /* Figma: Content radius 9px */
        overflow-x: auto; /* horizontal scroll when viewport is small */
        overflow-y: hidden;
    }

    .deployments-table {
        width: 100%;
        min-width: 1125px; /* 400+100+200+200+140+85 – wide enough for horizontal scroll on small screens */
        border-collapse: collapse;
    }

    .deployments-table thead {
        background: var(--ds-color-neutral-true-100);
    }

    .deployments-table th {
        /* Figma: Table header cell – height 44px, padding 12px 16px, bg #F5F5F5, border #EAECF0 */
        min-height: 44px;
        padding: 12px 16px; /* var(--ds-space-3) var(--ds-space-4) */
        box-sizing: border-box;
        text-align: left;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600); /* Figma Gray/600 #475467 */
        background: var(--ds-color-neutral-true-100);
        border-bottom: 1px solid var(--ds-color-gray-200);
    }

    .deployments-table td {
        /* Figma: Table cell – padding 16px, min-height 52px, font 14/20 #141414. No border-bottom per spec. */
        padding: var(--ds-space-4);
        box-sizing: border-box;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-900); /* #141414 */
        vertical-align: middle;
        background: var(--ds-color-white);
        min-height: 52px;
    }

    /* Figma: Action cell – padding 8px 16px, 36×36 button */
    .deployments-table td.dep-col-action {
        padding: var(--ds-space-2) var(--ds-space-4);
    }

    /* Round bottom corners for last row – 9px to match wrapper */
    .deployments-table tbody tr:last-child td:first-child {
        border-bottom-left-radius: 9px;
    }

    .deployments-table tbody tr:last-child td:last-child {
        border-bottom-right-radius: 9px;
    }

    .dep-col-name {
        min-width: 400px;
    }

    .dep-col-version {
        width: 100px;
    }

    .dep-col-started {
        width: 200px;
    }

    .dep-col-ended {
        width: 200px;
    }

    .dep-col-status {
        width: 140px;
    }

    .dep-col-action {
        width: 85px;
        text-align: center;
    }

    /* Deployments Pagination – Figma: padding 8px 24px, gap 8px, height 56px, border-top #EAECF0 */
    .deployments-pagination {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        padding: var(--ds-space-2) var(--ds-space-6);
        gap: var(--ds-space-2);
        min-height: 56px;
        box-sizing: border-box;
        border-top: 1px solid var(--ds-color-gray-200);
    }

    .dep-pagination-info {
        /* Figma: Details – Body/14-Regular, Neutral-True/600 #525252 */
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-600);
    }

    .dep-pagination-controls {
        display: flex;
        align-items: center;
        gap: 2px; /* Figma: Pagination numbers gap 2px */
    }

    .dep-page-numbers {
        display: flex;
        align-items: center;
        gap: 2px; /* Figma: gap 2px between page number cells */
    }

    .dep-page-number {
        /* Figma: _Pagination number base – 40×40, radius 8px */
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--ds-radius-lg);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        color: var(--ds-color-gray-600);
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .dep-page-number:hover {
        background: var(--ds-color-neutral-true-100);
    }

    .dep-page-number.active {
        /* Figma: active – Gray/50 #F9FAFB, Gray/800 #1D2939 */
        background: var(--ds-color-gray-50);
        color: var(--ds-color-gray-800);
    }

    .dep-page-ellipsis {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600);
    }

    /* Activity Card - Override layout properties only */
    :global(.activity-card .ds-card) {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        gap: var(--ds-space-4) !important;
    }

    /* Align with tab Details: padding="none", use info-card-header (has padding), body has padding */
    :global(.activity-card .card-body) {
        padding: var(--ds-card-padding-md);
    }

    .activity-header-with-action {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-4);
        width: 100%;
        padding-left: var(--ds-card-padding-md);
        padding-right: var(--ds-card-padding-md);
    }

    /* Align left content with card body; avoid double padding from inner info-card-header */
    .activity-header-with-action .info-card-header {
        padding-left: 0;
        padding-right: 0;
    }

    /* Download Logs button: Blue light/700, larger tap target */
    .activity-header-with-action :global(.download-logs-btn) {
        min-width: 140px;
        height: 40px;
        padding: 10px 20px;
        font-family: 'Poppins', var(--ds-font-sans);
        font-size: 16px;
        font-weight: 500;
        line-height: 20px;
        letter-spacing: 0;
        color: #026AA2;
        border-color: #0BA5EC;
    }
    .activity-header-with-action :global(.download-logs-btn:hover:not(:disabled)) {
        color: #065986;
        background-color: #F0F9FF;
    }
    .activity-header-with-action :global(.download-logs-btn svg) {
        color: inherit;
    }

    .activity-body {
        padding: 0;
    }

    .empty-state {
        padding: var(--ds-space-12);
        text-align: center;
        color: var(--ds-text-tertiary);
        font-size: var(--ds-text-sm);
    }

    /* Activity Table */
    .activity-table-wrap {
        display: flex;
        flex-direction: column;
        background: var(--ds-color-white);
        border-radius: var(--ds-radius-lg);
        overflow: hidden;
    }

    .activity-table-header {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        background: var(--ds-color-neutral-true-100, #F5F5F5);
        border-bottom: 1px solid var(--ds-border-default);
    }

    .activity-header-cell {
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
    .activity-header-cell.activity-col-expand {
        justify-content: center;
        padding-left: 0;
        padding-right: 0;
    }

    .activity-header-cell .header-text {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
    }

    .activity-col-expand {
        width: 60px;
        flex-shrink: 0;
    }

    .activity-cell.activity-col-expand {
        justify-content: center;
        padding-left: 0;
        padding-right: 0;
    }

    .activity-col-event {
        width: 240px;
        flex-shrink: 0;
    }

    .activity-col-description {
        flex: 1;
        min-width: 0;
    }

    .activity-col-status {
        width: 150px;
        flex-shrink: 0;
    }

    /* Activity Row */
    .activity-row {
        display: flex;
        flex-direction: row;
        align-items: stretch; /* Stretch all cells to same height */
        background: var(--ds-color-white);
        border-bottom: 1px solid var(--ds-border-default);
    }

    /* Round bottom corners for last activity row */
    .activity-table-wrap .activity-row:last-child {
        border-bottom: none;
    }

    .activity-table-wrap .activity-row:last-child .activity-cell:first-child {
        border-bottom-left-radius: var(--ds-radius-lg);
    }

    .activity-table-wrap .activity-row:last-child .activity-cell:last-child {
        border-bottom-right-radius: var(--ds-radius-lg);
    }

    .activity-cell {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: var(--ds-space-4);
        min-height: 52px;
        /* Remove individual border - use row border instead */
    }

    .event-name {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    .description-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    /* Activity Details Row */
    .activity-details-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        background: #FFFFFF;
        border-bottom: 1px solid #EAECF0;
        min-height: 60px;
    }

    .activity-details-spacer {
        width: 60px; /* Match expand column width */
        flex-shrink: 0;
        display: flex;
        justify-content: center;
    }

    .activity-details-divider {
        display: flex;
        flex-direction: column;
        justify-content: stretch;
        align-items: center;
        width: 20px;
        flex-shrink: 0;
        padding: 0;
    }

    .divider-line {
        width: 1px;
        background: #E5E5E5;
        flex: 1;
        min-height: 100%;
    }

    .activity-details-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 16px 16px 16px 12px;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }

    .detail-item {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 8px;
        flex-wrap: wrap;
    }

    .detail-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    .detail-old-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: #DD2590; /* Pink/600 */
    }

    .detail-new-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
        flex: 1;
    }

    /* Detail Tags */
    .detail-tags {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .detail-tag {
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 4px 6px;
        gap: 6px;
        background: var(--ds-color-white);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-md);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        text-align: center;
        color: var(--ds-color-gray-700);
    }

    /* Activity Pagination */
    .activity-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: var(--ds-space-2) var(--ds-space-6);
        gap: var(--ds-space-2);
        border-top: 1px solid var(--ds-border-default);
    }

    .activity-pagination .pagination-details {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }

    .activity-pagination .pagination-controls {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-1);
    }

    .activity-pagination .page-number {
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

    /* Install New App Modal styles are now in shared AppPickerModal component */

    /* Responsive */
    @media (max-width: 1200px) {
        .header-section {
            grid-template-columns: 1fr;
            gap: var(--ds-space-4);
        }

        .general-card {
            max-width: 100% !important;
        }

        :global(.general-card .ds-card) {
            max-width: 100% !important;
        }

        .quick-actions {
            grid-template-columns: repeat(4, 1fr);
        }

        .details-wrap {
            gap: var(--ds-space-4);
        }
        /* Keep 4 metrics per row when space allows; avoid forcing 50% to prevent early wrap */
    }

    @media (max-width: 1024px) {
        .device-details-page {
            padding: 24px;
        }

        .header-section {
            grid-template-columns: 1fr;
            gap: var(--ds-space-4);
        }

        .general-card {
            max-width: 100% !important;
        }

        :global(.general-card .ds-card) {
            max-width: 100% !important;
        }

        .details-grid {
            grid-template-columns: 1fr;
        }

        .details-column {
            width: 100%;
        }

        .details-wrap {
            flex-wrap: wrap;
            gap: var(--ds-space-3);
        }
        /* metric-item keep default flex: 1 1 auto so 4 cells per row when space allows */
    }

    @media (max-width: 900px) {
        .header-section {
            gap: var(--ds-space-3);
        }

        .quick-actions {
            grid-template-columns: repeat(2, 1fr);
            gap: var(--ds-space-3);
        }

        .details-wrap {
            gap: var(--ds-space-3);
        }
        /* metric-item keep default so 4 cells per row when space allows */
    }

    @media (max-width: 768px) {
        .device-details-page {
            padding: 24px;
        }

        .header-section {
            gap: var(--ds-space-3);
        }


        /* Align: all cards use padding="none", header manages own padding */
        .card-header,
        .info-card-header,
        .config-header,
        .apps-header,
        .deployments-header {
            padding: var(--ds-space-3);
        }

        .details-wrap,
        .general-content,
        .info-card-body {
            padding: var(--ds-space-3);
        }

        .quick-actions {
            grid-template-columns: repeat(2, 1fr);
            gap: var(--ds-space-2);
        }

        /*.tabs-wrapper {
            margin-top: var(--ds-space-2);
        }*/

        .tab-content {
            margin-top: var(--ds-space-3);
        }
    }

    @media (max-width: 500px) {
        .header-section {
            gap: var(--ds-space-2);
        }

        .quick-actions {
            grid-template-columns: 1fr;
            gap: var(--ds-space-2);
        }

        .details-wrap {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--ds-space-3);
        }

        .metric-item {
            flex: 1 1 100%;
            width: 100%;
            min-width: 100%;
        }

        .card-title {
            font-size: 16px;
            line-height: 22px;
        }

        .card-subtitle {
            font-size: 13px;
            line-height: 18px;
        }

        .metric-value {
            font-size: 24px;
            line-height: 30px;
        }

        .info-row-detail {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--ds-space-1);
        }

        .info-row-detail .value {
            text-align: left;
        }

        .info-row {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--ds-space-2);
        }

        .info-value-text {
            text-align: left;
        }
    }

    @media (max-width: 375px) {
        .device-details-page {
            padding: 24px;
        }

        /* Align: all cards use padding="none", header manages own padding */
        .card-header,
        .info-card-header,
        .config-header,
        .apps-header,
        .deployments-header {
            padding: var(--ds-space-2);
            flex-wrap: wrap;
        }

        .details-wrap,
        .general-content,
        .info-card-body {
            padding: var(--ds-space-2);
        }
    }

    /* ========================================
       Push File Modal Styles (Design System)
       ======================================== */

    /* File List Item */
    .push-file-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        text-align: left;
        background: #FAFAFA;
        border-radius: 8px;
        padding: 12px 16px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .push-file-item:hover {
        background: #F5F5F5;
    }

    .push-file-item.selected {
        background: #E0F2FE;
        border-color: #0086C9;
    }

    .push-file-item-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 12px;
        width: 100%;
    }

    /* Radio indicator - matches design-system Radio.svelte */
    .push-file-radio {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid #D6D6D6;
        background: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.15s ease;
    }

    .push-file-radio.checked {
        border-color: #141414;
        background: #FCFCFC;
    }

    .push-file-radio-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #141414;
    }

    /* File info */
    .push-file-info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }

    .push-file-name {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-md);
        line-height: var(--ds-leading-md);
        color: var(--ds-color-gray-800);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .push-file-package {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Meta info */
    .push-file-meta {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        flex-shrink: 0;
    }

    .push-file-meta-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .push-file-meta-label {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-600);
    }

    .push-file-meta-value {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-900);
    }

    /* Created date */
    .push-file-created {
        padding-left: 28px;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        color: var(--ds-color-gray-500);
    }

    /* Pagination */
    .push-file-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid #EAECF0;
    }

    .push-file-pagination-text {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }

    .push-file-pagination-controls {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
    }

    .push-file-pagination-current {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background: #F9FAFB;
        border-radius: 8px;
    }

    .push-file-pagination-current span {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
    }

    /* ========================================
       Pull File Modal Styles (Design System)
       ======================================== */

    .pull-file-info-box {
        background: #FAFAFA;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .pull-file-info-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }

    .pull-file-info-title {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-semibold);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-800);
    }

    .pull-file-info-list {
        margin: 0;
        padding-left: 20px;
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-500);
    }

    .pull-file-info-list li {
        margin-bottom: 4px;
    }

    .pull-file-info-list li:last-child {
        margin-bottom: 0;
    }

    /* Custom button styles */
    :global(.btn-compact-padding) {
        padding: 5px 5px !important;
    }
</style>
