<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { writable } from "svelte/store";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Badge } from "$lib/components/ui/badge";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import SecureKeyDisplay from "$lib/components/ui_components_sveltekit/display/SecureKeyDisplay.svelte";
    import {
        Clock,
        RefreshCw,
        Key,
        Wifi,
        Cpu,
        Server,
        Shield,
        Info,
        Settings,
        Tag,
        Terminal,
        Camera,
        RotateCcw,
        Upload,
        FileText,
        Edit,
        AlertCircle,
        CheckCircle,
        Loader2,
        Monitor,
    } from "lucide-svelte";
    import { AdminPageLayout, AdminCard } from "$lib/components/admin";
    import ActionHistory from "$lib/components/ui_components_sveltekit/devices/ActionHistory.svelte";
    import DeviceActions from "$lib/components/ui_components_sveltekit/devices/DeviceActions.svelte";
    import FirmwareModal from "$lib/components/ui_components_sveltekit/devices/FirmwareModal.svelte";
    import StatusBanner from "$lib/components/ui_components_sveltekit/devices/StatusBanner.svelte";
    import ScreenshotModal from "$lib/components/ui_components_sveltekit/devices/ScreenshotModal.svelte";
    import { CompactInfoGrid, CompactInfoItem } from "$lib/components/ui_components_sveltekit/layout";
    import DeviceInformationContent from "$lib/components/ui_components_sveltekit/devices/DeviceInformationContent.svelte";
    import ConnectionStatusCard from "$lib/components/ui_components_sveltekit/devices/ConnectionStatusCard.svelte";
    import SecurityCard from "$lib/components/ui_components_sveltekit/devices/SecurityCard.svelte";
    import TechnicalDetailsContent from "$lib/components/ui_components_sveltekit/devices/TechnicalDetailsContent.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import type { PageData } from "./$types";
    import { sseStore } from "$lib/stores/sse-store";
    import { subscribeDeviceDetailEvents } from "$lib/client/deviceDetailRealtime";
    import { onMount, onDestroy } from 'svelte';
    
    export let data: PageData;
    // Use let bindings so we can reassign and trigger Svelte reactivity on updates
    let device = (data as any).device;
    let licenses = device.licenses;
    let deviceActionLogs = (data as any).deviceActionLogs;
    const MAX_ACTION_LOGS = 15;
    let actionLogs: any[] = Array.isArray(deviceActionLogs) ? [...deviceActionLogs].slice(0, MAX_ACTION_LOGS) : [];
    // Track a temporary optimistic log row for firmware update initiation
    let pendingFirmwareTempId: string | null = null;
    const title = device.name || "Device Details";

    const LICENSE_STATUS_LABELS: Record<string, string> = {
        ACTIVE: 'Active',
        REVOKED: 'Revoked',
        EXPIRED: 'Expired',
        SUSPENDED: 'Suspended'
    };

    function toTitleCaseFromSnake(input: string): string {
        return (input || '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function getLicenseStatusLabel(status: string): string {
        return LICENSE_STATUS_LABELS[status] ?? status;
    }

    export function getLicenseStatusBadgeVariant(status: string): 'success' | 'destructive' | 'secondary' | 'outline' {
        const s = (status || '').toLowerCase();
        if (s === 'active') return 'success';
        if (s === 'revoked') return 'destructive';
        if (s === 'expired') return 'secondary';
        if (s === 'suspended') return 'outline';
        return 'outline';
    }

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Devices", "/admin/iot/devices"],
        [device.name || "Device", ""],
    ];

    // State management
    const activeTab = writable("overview");
    // Terminal state is now managed in the terminal page
    const isLoading = writable(false);
    const actionStatus = writable({ action: "", status: "", message: "" });
    let screenshotOpen = false;
    let screenshotData: string | null = null;
    let screenshotFormat: string = 'jpeg';

    // Setup the form for API key generation
    const {
        form: apiKeyForm,
        enhance: apiKeyEnhance,
        submitting: apiKeySubmitting,
    } = superForm(data.form, {
        id: "api-key-form", // Add a unique ID to avoid duplicate form ID errors
        resetForm: false,
        taintedMessage: null,
        onSubmit: ({ action }: { action: URL } | any) => {
            // Only handle the generateApiKey action
            const actionStr = typeof action === 'string' ? action : (action as URL)?.toString();
            if (actionStr !== "?/generateApiKey") {
                return;
            }
        },
        onResult: ({ result }) => {
            if (result.type === "success") {
                toast.success("API key generated successfully");
                // Refresh the page to show the new API key
                goto(`/admin/iot/devices/${device.id}`, {
                    invalidateAll: true,
                });
            } else if (result.type === "failure") {
                toast.error(result.data?.error || "Failed to generate API key");
            }
        },
        onError: () => {
            toast.error("An error occurred while generating API key");
        },
    });

    // Format connection status
    function getConnectionStatusBadge(connected: boolean) {
        return connected
            ? { label: "Connected", variant: "success" as const }
            : { label: "Disconnected", variant: "destructive" as const };
    }

    let connectionStatus = getConnectionStatusBadge(device.connected);
    $: connectionStatus = getConnectionStatusBadge(device.connected);
    // Realtime updates subscription handles
    let unsubscribeDeviceRealtime: (() => void) | null = null;
    let unsubConnectionLight: (() => void) | null = null;
    onMount(() => {
        console.log('[AdminDeviceDetail] onMount started for device:', device.id);
        console.log('[AdminDeviceDetail] Initial device state:', {
            id: device.id,
            connected: device.connected,
            connectedAt: device.connectedAt,
            disconnectedAt: device.disconnectedAt
        });
        
        try {
            console.debug('[AdminDeviceDetail] Connecting SSE to /api/sse ...');
            sseStore.connect(`/api/sse`, { withCredentials: true });
        } catch (e) {
            console.warn('[AdminDeviceDetail] SSE connect failed (may already be connected):', e);
        }
        let lastSubscribedConnectionId: string | null = null;
        sseStore.on('connected', (msg: any) => {
            const connId = msg?.data?.connectionId;
            if (!connId) return;
            if (connId === lastSubscribedConnectionId) {
                console.debug('[DeviceDetail] SSE connected event but already subscribed for', connId);
                return;
            }
            console.debug('[DeviceDetail] SSE (re)connected. Subscribing device channel', { deviceId: device.id, connId });
            fetch(`/api/sse/subscribe/device/${device.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connectionId: connId })
            }).then(() => {
                lastSubscribedConnectionId = connId;
                console.log('[DeviceDetail] Subscribed to device channel for', connId);
            }).catch((err) => console.warn('Subscribe failed', err));
        });

        // Use centralized realtime updater for action history
        if (!unsubscribeDeviceRealtime) {
            unsubscribeDeviceRealtime = subscribeDeviceDetailEvents(
                device.id,
                () => actionLogs,
                (logs) => { actionLogs = logs; }
            );
        }

        // Lightweight connection status updates remain inline
        unsubConnectionLight = sseStore.on('*', (msg: any) => {
            try {
                const evt = msg?.data ?? msg;
                const evtType = evt?.type || msg?.event || evt?.payload?.type;
                // Normalize payloads that carry action in payload
                const normalized = evt?.payload?.action === 'device:connection' ? { ...evt.payload, type: 'device:connection' }
                                  : evt;

                // Debug incoming messages minimally to avoid spam
                if (evtType || normalized?.type) {
                    console.debug('[DeviceDetail:SSE] Incoming', {
                        evtType,
                        normalizedType: normalized?.type,
                        forDevice: normalized?.deviceId,
                        currentDevice: device?.id
                    });
                }

                const isConnectionEvent = (evtType === 'device:connection') || (normalized?.type === 'device:connection');
                if (!isConnectionEvent) return;

                const c = normalized;
                if (!c?.deviceId || c.deviceId !== device.id) {
                    // Not for this device; ignore
                    return;
                }

                const prev = { connected: !!device.connected, connectedAt: device.connectedAt, disconnectedAt: device.disconnectedAt };

                // Reassign the whole object to trigger reactive updates in Svelte
                device = {
                    ...device,
                    connected: !!c.connected,
                    connectedAt: c.connected ? (c.connectedAt ?? device.connectedAt) : device.connectedAt,
                    disconnectedAt: !c.connected ? (c.disconnectedAt ?? device.disconnectedAt) : device.disconnectedAt
                };

                const next = { connected: !!device.connected, connectedAt: device.connectedAt, disconnectedAt: device.disconnectedAt };
                console.debug('[DeviceDetail:SSE] Applied connection update', { prev, next });
            } catch (e) {
                console.warn('[DeviceDetail:SSE] Error processing message', e);
            }
        });
    });

    onDestroy(() => {
        if (unsubscribeDeviceRealtime) {
            try { unsubscribeDeviceRealtime(); } catch {}
            unsubscribeDeviceRealtime = null;
        }
        if (unsubConnectionLight) {
            try { unsubConnectionLight(); } catch {}
            unsubConnectionLight = null;
        }
    });

    // Device action handlers
    function addActionLogRow(actionType: string, message: string, status: 'initiated' | 'in_progress' | 'success' | 'failed' = 'initiated') {
        const tempId = `temp-${actionType}-${Date.now()}`;
        actionLogs = [
            {
                id: tempId,
                deviceId: device.id,
                actionType,
                status,
                progress: null,
                initiatedAt: new Date().toISOString(),
                completedAt: null,
                durationMs: null,
                message,
                user: null
            },
            ...actionLogs
        ].slice(0, MAX_ACTION_LOGS);
        return tempId;
    }

    function updateTempActionLog(tempId: string | null, status: 'success' | 'failed', message?: string) {
        if (!tempId) return;
        const idx = actionLogs.findIndex((l) => l.id === tempId);
        if (idx >= 0) {
            const existing = actionLogs[idx];
            actionLogs[idx] = {
                ...existing,
                status,
                message: message ?? existing.message,
                completedAt: new Date().toISOString()
            };
            actionLogs = [...actionLogs];
        }
    }

    function accessRemoteTerminal() {
        // Log and navigate to the terminal page
        addActionLogRow('terminal', 'Opening terminal', 'initiated');
        goto(`/admin/iot/devices/${device.id}/terminal`);
    }

    async function retrieveSnapshot() {
        isLoading.set(true);
        actionStatus.set({
            action: "snapshot",
            status: "loading",
            message: "Taking screenshot...",
        });
        const tempId = addActionLogRow('snapshot', 'Taking screenshot…', 'in_progress');

        try {
            // Call the screenshot handler on the device
            const responsePayload = await sseStore.sendRequest(
                {
                    type: 'device',
                    scope: `subscription:device:${device.id}`,
                    payload: {
                        action: 'message',
                        type: 'screenshot:request',
                        deviceId: device.id,
                        quality: 80 // JPEG quality (1-100)
                    }
                },
                /* timeoutMs = */ 30000, // Screenshots might take longer; allow up to 30s
                /* requestIdPrefix = */ 'screenshot'
            );

            // Check for explicit error from device first
            const payloadType = responsePayload?.payload?.type;
            if (payloadType === 'screenshot:error') {
                const errMsg = responsePayload?.payload?.error || 'Device reported screenshot error';
                throw new Error(errMsg);
            }

            // Check if we have an image in the response (support multiple shapes)
            const imageData = responsePayload?.image
                || responsePayload?.payload?.image
                || responsePayload?.data?.image;
            const format = responsePayload?.format
                || responsePayload?.payload?.format
                || responsePayload?.data?.format
                || 'jpeg';

            if (imageData) {
                // Show in reusable modal
                screenshotData = imageData;
                screenshotFormat = format;
                screenshotOpen = true;

                actionStatus.set({ action: "snapshot", status: "success", message: "Screenshot captured" });
                toast.success("Device screenshot captured successfully");
                updateTempActionLog(tempId, 'success', 'Screenshot captured');
            } else {
                throw new Error("No image data received from device");
            }
        } catch (error) {
            actionStatus.set({
                action: "snapshot",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to capture screenshot"
            });
            toast.error("Failed to capture device screenshot");
            console.error("Error capturing screenshot:", error);
            updateTempActionLog(tempId, 'failed', error instanceof Error ? error.message : 'Failed to capture screenshot');
        } finally {
            isLoading.set(false);
        }
    }

    async function restartDevice() {
        isLoading.set(true);
        actionStatus.set({
            action: "restart",
            status: "loading",
            message: "Sending restart command...",
        });
        const tempId = addActionLogRow('restart', 'Sending restart command…', 'in_progress');

        try {
            // Send restart command to the device via SSE
            const responsePayload = await sseStore.sendRequest(
                {
                    type: 'device',
                    scope: `subscription:device:${device.id}`,
                    payload: {
                        action: 'restart',
                        deviceId: device.id
                    }
                },
                /* timeoutMs = */ 30000,
                /* requestIdPrefix = */ 'restart'
            );

            if (responsePayload?.success) {
                actionStatus.set({
                    action: "restart",
                    status: "success",
                    message: responsePayload.message || "Restart command sent",
                });
                toast.success("Device restart initiated");
                updateTempActionLog(tempId, 'success', 'Restart command sent');
            } else {
                throw new Error(responsePayload?.message || "Failed to restart device");
            }
        } catch (error) {
            actionStatus.set({
                action: "restart",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to restart device",
            });
            toast.error("Failed to restart device");
            console.error("Error restarting device:", error);
            updateTempActionLog(tempId, 'failed', error instanceof Error ? error.message : 'Failed to restart device');
        } finally {
            isLoading.set(false);
        }
    }

    async function updateFirmware() {
        // If no firmware selected, open the modal to select one first
        if (!selectedFirmware) {
            await openFirmwareModal();
            return;
        }
        await confirmFirmwareUpdate();
    }

    async function viewLogs() {
        isLoading.set(true);
        actionStatus.set({
            action: "logs",
            status: "loading",
            message: "Fetching device logs...",
        });

        try {
            // Request logs from the device via SSE
            const responsePayload = await sseStore.sendRequest(
                {
                    type: 'device',
                    scope: `subscription:device:${device.id}`,
                    payload: {
                        action: 'getLogs',
                        deviceId: device.id,
                        lines: 100 // Request last 100 lines of logs
                    }
                },
                /* timeoutMs = */ 8000,
                /* requestIdPrefix = */ 'logs'
            );

            if (responsePayload?.logs) {
                // Create a modal to display the logs
                const modal = document.createElement('div');
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100%';
                modal.style.height = '100%';
                modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.zIndex = '9999';
                
                // Create a container for the logs
                const container = document.createElement('div');
                container.style.position = 'relative';
                container.style.width = '80%';
                container.style.maxWidth = '800px';
                container.style.maxHeight = '80vh';
                container.style.backgroundColor = 'white';
                container.style.borderRadius = '8px';
                container.style.padding = '20px';
                container.style.overflow = 'auto';
                
                // Create a close button
                const closeButton = document.createElement('button');
                closeButton.textContent = '×';
                closeButton.style.position = 'absolute';
                closeButton.style.top = '10px';
                closeButton.style.right = '10px';
                closeButton.style.border = 'none';
                closeButton.style.background = 'none';
                closeButton.style.fontSize = '24px';
                closeButton.style.cursor = 'pointer';
                closeButton.style.color = '#666';
                closeButton.onclick = () => document.body.removeChild(modal);
                
                // Create a title
                const title = document.createElement('h3');
                title.textContent = 'Device Logs';
                title.style.marginBottom = '15px';
                title.style.borderBottom = '1px solid #eee';
                title.style.paddingBottom = '10px';
                
                // Create a pre element for the logs
                const pre = document.createElement('pre');
                pre.style.margin = '0';
                pre.style.padding = '10px';
                pre.style.backgroundColor = '#f5f5f5';
                pre.style.borderRadius = '4px';
                pre.style.overflow = 'auto';
                pre.style.fontSize = '12px';
                pre.style.fontFamily = 'monospace';
                pre.style.whiteSpace = 'pre-wrap';
                pre.textContent = responsePayload.logs.join('\n');
                
                // Assemble the modal
                container.appendChild(closeButton);
                container.appendChild(title);
                container.appendChild(pre);
                modal.appendChild(container);
                document.body.appendChild(modal);
                
                // Close modal when clicking outside the container
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                });
                
                actionStatus.set({
                    action: "logs",
                    status: "success",
                    message: "Logs retrieved",
                });
                toast.success("Device logs retrieved successfully");
            } else {
                throw new Error(responsePayload?.message || "No logs received from device");
            }
        } catch (error) {
            actionStatus.set({
                action: "logs",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to retrieve logs",
            });
            toast.error("Failed to retrieve device logs");
            console.error("Error retrieving logs:", error);
        } finally {
            isLoading.set(false);
        }
    }

    // -------------------- Firmware selection modal (Part 2 UI) --------------------
    let showFirmwareModal = false;
    let firmwareItems: any[] = [];
    let selectedFirmwareId: string | null = null;
    let selectedFirmware: any | null = null;
    let loadingFirmware = false;
    let firmwarePage = 1;
    let firmwareTotalPages = 1;
    let firmwareSearch = '';

    async function loadFirmwareResources(page = 1) {
        loadingFirmware = true;
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: '20'
            });
            if (firmwareSearch && firmwareSearch.trim().length > 0) {
                params.set('search', firmwareSearch.trim());
            }
            const res = await fetch(`/api/admin/resources/firmware?${params.toString()}`, { credentials: 'include' });
            if (!res.ok) {
                throw new Error('Failed to load firmware resources');
            }
            const data = await res.json();
            firmwareItems = data.items || [];
            firmwarePage = data.meta?.page || 1;
            firmwareTotalPages = data.meta?.totalPages || 1;
        } catch (err) {
            console.error('Firmware list error:', err);
            toast.error('Failed to load firmware resources');
        } finally {
            loadingFirmware = false;
        }
    }

    async function openFirmwareModal() {
        showFirmwareModal = true;
        selectedFirmwareId = selectedFirmware?.id || null;
        await loadFirmwareResources(1);
    }

    function onSelectFirmware(id: string) {
        selectedFirmwareId = id;
        selectedFirmware = firmwareItems.find((it) => it.id === id) || null;
    }

    // Typed wrappers for modal callbacks (avoid TS types in markup)
    function handleModalSearch(p?: number) {
        loadFirmwareResources(p ?? 1);
    }

    function handleModalSelect(id: string) {
        onSelectFirmware(id);
    }

    async function confirmFirmwareUpdate() {
        if (!selectedFirmware) {
            toast.error('Please select a firmware');
            return;
        }

        isLoading.set(true);
        actionStatus.set({
            action: 'firmware',
            status: 'loading',
            message: 'Initiating firmware update...'
        });

        // Optimistically add an action log row so the user sees it immediately
        try {
            const tempId = `temp-${Date.now()}`;
            pendingFirmwareTempId = tempId;
            actionLogs = [
                {
                    id: tempId,
                    deviceId: device.id,
                    actionType: 'firmware_update',
                    status: 'in_progress',
                    progress: null,
                    initiatedAt: new Date().toISOString(),
                    completedAt: null,
                    durationMs: null,
                    message: 'Initiating firmware update…',
                    user: null
                },
                ...actionLogs
            ].slice(0, MAX_ACTION_LOGS);
        } catch {}

        try {
            const responsePayload = await sseStore.sendRequest(
                {
                    type: 'device',
                    scope: `subscription:device:${device.id}`,
                    payload: {
                        action: 'updateFirmware',
                        deviceId: device.id,
                        firmware: {
                            resourceId: selectedFirmware.id,
                            resourceName: selectedFirmware.name,
                            packageName: selectedFirmware.packageName ?? null,
                            size: selectedFirmware.size,
                            path: selectedFirmware.path,
                            version: selectedFirmware.version ?? null,
                            format: selectedFirmware.format ?? null
                        }
                    }
                },
                /* timeoutMs = */ 30000,
                /* requestIdPrefix = */ 'firmware'
            );

            const ok = responsePayload?.success ?? responsePayload?.payload?.success ?? false;
            if (ok) {
                actionStatus.set({
                    action: 'firmware',
                    status: 'success',
                    message: responsePayload.message || responsePayload?.payload?.message || 'Firmware update initiated'
                });
                toast.success('Firmware update has been initiated');
                showFirmwareModal = false;
            } else {
                const errMsg = responsePayload?.message || responsePayload?.payload?.message || 'Failed to update firmware';
                throw new Error(errMsg);
            }
        } catch (error) {
            actionStatus.set({
                action: 'firmware',
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to update firmware'
            });
            toast.error('Failed to initiate firmware update');
            console.error('Error updating firmware:', error);
            // Mark the optimistic row as failed so the user still sees an entry
            if (pendingFirmwareTempId) {
                const idx = actionLogs.findIndex((l) => l.id === pendingFirmwareTempId);
                if (idx >= 0) {
                    const existing = actionLogs[idx];
                    actionLogs[idx] = {
                        ...existing,
                        status: 'failed',
                        message: existing.message || (error instanceof Error ? error.message : 'Failed to update firmware'),
                        completedAt: new Date().toISOString()
                    };
                    actionLogs = [...actionLogs];
                }
                pendingFirmwareTempId = null;
            }
        } finally {
            isLoading.set(false);
        }
    }

    // Navigate to edit page
    function navigateToEdit() {
        goto(`/admin/iot/devices/${device.id}/edit`);
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionLabel="Edit"
    actionIcon={Edit}
    actionOnClick={navigateToEdit}
    compact={true}
    contentSpacing="space-y-4"
>
    <!-- Device Action Buttons -->
    <AdminCard
        title="Device Actions"
        description="Manage and interact with this device"
        icon={Settings}
        class_name="mb-4"
        compact={true}
    >
        <DeviceActions
            {device}
            {isLoading}
            {actionStatus}
            onSnapshot={retrieveSnapshot}
            onRestart={restartDevice}
            onOpenFirmwareModal={openFirmwareModal}
            onViewLogs={viewLogs}
            onTerminal={accessRemoteTerminal}
            onRemoteDesktop={() => { addActionLogRow('remote_desktop', 'Opening remote desktop', 'initiated'); goto(`/admin/iot/devices/${device.id}/rdp`); }}
        />

        <!-- Status message for actions -->
        <StatusBanner status={$actionStatus} />
    </AdminCard>

<FirmwareModal
    show={showFirmwareModal}
    items={firmwareItems}
    loading={loadingFirmware}
    page={firmwarePage}
    totalPages={firmwareTotalPages}
    search={firmwareSearch}
    selectedId={selectedFirmwareId}
    searchFn={handleModalSearch}
    selectFn={handleModalSelect}
    onClose={() => (showFirmwareModal = false)}
    onConfirm={confirmFirmwareUpdate}
/>

<ScreenshotModal open={screenshotOpen} imageData={screenshotData} format={screenshotFormat} onClose={() => { screenshotOpen = false; screenshotData = null; }} />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Device Info Card -->
        <AdminCard
            title="Device Information"
            description="Basic details about this device"
            icon={Info}
            compact={true}
            class_name="md:col-span-2"
        >
            <!-- View Mode: Read-only display -->
            <div class="space-y-4">
                <!-- Basic Info -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="md:col-span-2">
                        <DeviceInformationContent {device} />
                    </div>

                    <!-- Metadata Section -->
                    <div
                        class="border-l-0 md:border-l border-muted pl-0 md:pl-4"
                    >
                        {#if device}
                            <CompactInfoGrid columns={1} gap="gap-1">
                                <CompactInfoItem label="Created" icon={Clock}>
                                    <div class="text-xs">
                                        <RelativeDate date={device.createdAt} />
                                        {#if device.createdBy && device.user}
                                            <span
                                                class="block text-muted-foreground"
                                                >by {device.user.name ||
                                                    device.user.email}</span
                                            >
                                        {/if}
                                    </div>
                                </CompactInfoItem>

                                {#if device.updatedAt && device.updatedAt.toString() !== device.createdAt.toString()}
                                    <CompactInfoItem
                                        label="Updated"
                                        icon={Clock}
                                    >
                                        <div class="text-xs">
                                            <RelativeDate
                                                date={device.updatedAt}
                                            />
                                        </div>
                                    </CompactInfoItem>
                                {/if}

                                {#if device.lastUsedAt}
                                    <CompactInfoItem
                                        label="Last used"
                                        icon={Clock}
                                    >
                                        <div class="text-xs">
                                            <RelativeDate
                                                date={device.lastUsedAt}
                                            />
                                        </div>
                                    </CompactInfoItem>
                                {/if}
                            </CompactInfoGrid>
                        {:else}
                            <div class="space-y-2">
                                <Skeleton class="h-3 w-3/4" />
                                <Skeleton class="h-3 w-1/2" />
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
            <svelte:fragment slot="footer">
                <MetadataFooter
                    items={[
                        {
                            label: "Created",
                            date: device.createdAt,
                            icon: "calendar",
                        },
                        {
                            label: "Created By",
                            value: device.user?.name || "Unknown",
                            icon: "user",
                        },
                        {
                            label: "Account",
                            value: device.account?.name || "None",
                            icon: "tag",
                        },
                        {
                            label: "Last Updated",
                            date: device.updatedAt,
                            icon: "clock",
                        },
                    ]}
                />
            </svelte:fragment>
        </AdminCard>

        <!-- Combined Connection & Security Card -->
        <AdminCard
            title="Device Status"
            icon={Server}
            compact={true}
            class_name="md:col-span-2"
        >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Connection Status Section -->
                    <ConnectionStatusCard {device} />

                <!-- Security Section -->
                <div
                    class="border-t md:border-t-0 md:border-l border-muted pt-4 md:pt-0 md:pl-4"
                >
                    <SecurityCard {device} apiKeyEnhance={apiKeyEnhance} apiKeySubmitting={apiKeySubmitting} />
                </div>
            </div>
        </AdminCard>

        <!-- Device Technical Details Card -->
        <AdminCard
            title="Technical Details"
            description="Hardware and software information"
            icon={Info}
            compact={true}
            class_name="md:col-span-2"
        >
            <TechnicalDetailsContent {device} />
        </AdminCard>
    </div>

    <!-- Device License -->
    <AdminCard
        title="Device Licenses"
        description="Licenses of this device"
        icon={FileText}
        class_name="mt-4"
        compact={true}
    >
        {#if actionLogs && actionLogs.length > 0}
            <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                <tr class="text-left border-b">
                    <th class="py-2 pr-4">License ID</th>
                    <th class="py-2 pr-4">Status</th>
                    <th class="py-2 pr-4">Issued At</th>
                    <th class="py-2 pr-4">Expires At</th>
                    <th class="py-2 pr-4">Key ID</th>
                    <th class="py-2 pr-4">Algorithm</th>
                </tr>
                </thead>
                <tbody>
                {#each licenses as license}
                    <tr class="border-b last:border-b-0">
                        <td class="py-2 pr-4">{license.id}</td>
                        <td class="py-2 pr-4">
                            <Badge variant={getLicenseStatusBadgeVariant(license.status)}>
                                {getLicenseStatusLabel(license.status)}
                            </Badge>
                        </td>
                        <td class="py-2 pr-4 text-neutral-500">{new Date(license.issuedAt).toLocaleString()}</td>
                        <td class="py-2 pr-4 text-neutral-500">{new Date(license.expiresAt).toLocaleString()}</td>
                        <td class="py-2 pr-4">{license.keyId}</td>
                        <td class="py-2 pr-4">{license.algorithm}</td>
                    </tr>
                {/each}
                </tbody>
            </table>
            </div>
        {:else}
            <div class="text-sm text-neutral-500">No licenses.</div>
        {/if}
    </AdminCard>

    <!-- Device Action History -->
    <AdminCard
        title="Action History"
        description="Recent actions performed on this device"
        icon={FileText}
        class_name="mt-4"
        compact={true}
    >
        {#if actionLogs && actionLogs.length > 0}
            <ActionHistory {actionLogs} />
        {:else}
            <div class="text-sm text-neutral-500">No recent actions.</div>
        {/if}
    </AdminCard>
</AdminPageLayout>

<!-- Terminal Dialog has been replaced with a dedicated terminal page -->
