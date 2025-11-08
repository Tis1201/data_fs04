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
    import InstallAppModal from "$lib/components/ui_components_sveltekit/devices/InstallAppModal.svelte";
    import PullFileModal from "$lib/components/ui_components_sveltekit/devices/PullFileModal.svelte";
    import PushFileModal from "$lib/components/ui_components_sveltekit/devices/PushFileModal.svelte";
    import StatusBanner from "$lib/components/ui_components_sveltekit/devices/StatusBanner.svelte";
    import ScreenshotModal from "$lib/components/ui_components_sveltekit/devices/ScreenshotModal.svelte";
    import { CompactInfoGrid, CompactInfoItem } from "$lib/components/ui_components_sveltekit/layout";
    import DeviceInformationContent from "$lib/components/ui_components_sveltekit/devices/DeviceInformationContent.svelte";
    import ConnectionStatusCard from "$lib/components/ui_components_sveltekit/devices/ConnectionStatusCard.svelte";
    import SecurityCard from "$lib/components/ui_components_sveltekit/devices/SecurityCard.svelte";
    import TechnicalDetailsContent from "$lib/components/ui_components_sveltekit/devices/TechnicalDetailsContent.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import type { PageData } from "./$types";
    import { createComponentSSE } from "$lib/stores/sse-store";
    import { subscribeDeviceDetailEvents } from "$lib/client/actionHandlers";
    import { onMount, onDestroy } from 'svelte';
    import DeviceDeviceTagComponent from "$lib/components/ui_components_sveltekit/devices/device_device_tag/DeviceDeviceTagComponent.svelte";
    import DeviceDetailTabs from "$lib/components/device/DeviceDetailTabs.svelte";
    
    // Create a per-component SSE store (independent connection for this page)
    const sseStore = createComponentSSE();
    
    export let data: PageData;
    // Use let bindings so we can reassign and trigger Svelte reactivity on updates
    let device = (data as any).device;
    $: device = data.device;
    let licenses = device.licenses;
    let deviceActionLogs = (data as any).deviceActionLogs;
    let deviceInformation = (data as any).deviceInformation; // 🆕 NEW: Device information from ClickHouse
    const MAX_ACTION_LOGS = 15;
    let actionLogs: any[] = Array.isArray(deviceActionLogs) ? [...deviceActionLogs].slice(0, MAX_ACTION_LOGS) : [];
    // Track a temporary optimistic log row for firmware update initiation
    let pendingFirmwareTempId: string | null = null;
    // Track a temporary optimistic log row for install app initiation
    let pendingInstallAppTempId: string | null = null;
    const title = device.name || "Device Details";

    // Helpers
    const formatDeviceStatus = (s: string | null | undefined) => (s ? s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—');

    const LICENSE_STATUS_LABELS: Record<string, string> = {
        ACTIVE: 'Active',
        REVOKED: 'Revoked',
        EXPIRED: 'Expired',
        SUSPENDED: 'Suspended'
    };

    // UX-friendly labels for action types and statuses
    const ACTION_LABELS: Record<string, string> = {
        firmware_update: 'Firmware update',
        screenshot: 'Screenshot',
        snapshot: 'Snapshot',
        restart: 'Restart',
        remote_desktop: 'Remote desktop',
        terminal: 'Terminal',
        install: 'Install',
        pull_file: 'Pull file',
        push_file: 'Push file',
        ping: 'Ping',
        status_check: 'Status check',
        config_update: 'Configuration update'
    };

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

    const STATUS_LABELS: Record<string, string> = {
        initiated: 'Initiated',
        in_progress: 'In progress',
        success: 'Completed',
        failed: 'Failed',
        cancelled: 'Cancelled',
        timeout: 'Timed out'
    };

    function toTitleCaseFromSnake(input: string): string {
        return (input || '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function getActionLabel(actionType: string): string {
        return ACTION_LABELS[actionType] ?? toTitleCaseFromSnake(actionType);
    }

    function getStatusLabel(status: string): string {
        return STATUS_LABELS[status] ?? toTitleCaseFromSnake(status);
    }

    // Real-time connection status updates
    let unsubConnection: (() => void) | null = null;
    let unsubConnected: (() => void) | null = null;
    let subscribedDevice = false;

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Home", "/user"],
        ["Devices", "/user/iot/devices"],
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
                goto(`/user/iot/devices/${device.id}`, {
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
    let statusUnsubscribe: (() => void) | null = null;
    onMount(() => {
        console.log('[UserDeviceDetail] onMount started for device:', device.id);
        console.log('[UserDeviceDetail] Initial device state:', {
            id: device.id,
            connected: device.connected,
            connectedAt: device.connectedAt,
            disconnectedAt: device.disconnectedAt
        });
        
        try {
            console.debug('[UserDeviceDetail] Connecting SSE to /api/sse ...');
            sseStore.connect(`/api/sse`, { withCredentials: true });
            console.log('[UserDeviceDetail] SSE connect initiated');
        } catch (e) {
            console.warn('[UserDeviceDetail] SSE connect failed (may already be connected):', e);
        }
        
        // Check SSE connection status
        console.log('[UserDeviceDetail] SSE store state:', sseStore);
        console.log('[UserDeviceDetail] SSE connection ID:', sseStore.connectionId);
        
        // Add a test function to manually trigger connection status change for debugging
        (window as any).testConnectionStatus = () => {
            console.log('[UserDeviceDetail] Manual test: toggling connection status');
            device = {
                ...device,
                connected: !device.connected,
                connectedAt: device.connected ? null : new Date().toISOString(),
                disconnectedAt: device.connected ? new Date().toISOString() : null
            };
            console.log('[UserDeviceDetail] Manual device state change:', {
                connected: device.connected,
                connectedAt: device.connectedAt,
                disconnectedAt: device.disconnectedAt
            });
        };
        // After connectionId is known, call subscribe endpoint to bind this connection to device channel
        // Persistently re-subscribe on every SSE (re)connect because connectionId changes
        let lastSubscribedConnectionId: string | null = null;
        sseStore.on('connected', (msg: any) => {
            console.log('[UserDeviceDetail] SSE connected event received:', msg);
            const connId = msg?.data?.connectionId;
            if (!connId) {
                console.warn('[UserDeviceDetail] No connectionId in connected event');
                return;
            }
            if (connId === lastSubscribedConnectionId) {
                console.debug('[UserDeviceDetail] SSE connected event but already subscribed for', connId);
                return;
            }
            console.log('[UserDeviceDetail] SSE (re)connected. Subscribing device channel', { deviceId: device.id, connId });
            fetch(`/api/sse/subscribe/device/${device.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connectionId: connId })
            }).then((response) => {
                console.log('[UserDeviceDetail] Subscribe response:', response);
                if (response.ok) {
                    lastSubscribedConnectionId = connId;
                    console.log('[UserDeviceDetail] Successfully subscribed to device channel for', connId);
                } else {
                    console.error('[UserDeviceDetail] Subscribe failed with status:', response.status);
                    response.text().then(text => console.error('[UserDeviceDetail] Subscribe error:', text));
                }
            }).catch((err) => console.warn('[UserDeviceDetail] Subscribe failed:', err));
        });

        // Use centralized realtime updater for action history
        // Pass the per-component SSE store so handlers receive messages from the correct connection
        if (!unsubscribeDeviceRealtime) {
            unsubscribeDeviceRealtime = subscribeDeviceDetailEvents(
                device.id,
                () => actionLogs,
                (logs) => { actionLogs = logs; },
                actionStatus,
                sseStore  // Pass per-component SSE store
            );
        }

        // Lightweight connection status updates remain inline
        unsubConnectionLight = sseStore.on('*', (msg: any) => {
            console.log('[UserDeviceDetail] SSE message received:', msg);
            try {
                const evt = msg?.data ?? msg;
                const evtType = evt?.type || msg?.event || evt?.payload?.type;
                
                // 🆕 NEW: Handle data updates pushed via SSE
                if (evtType === 'device:dataUpdate') {
                    const updatedData = evt.payload?.updatedData;
                    
                    if (updatedData && updatedData.deviceInfo) {
                        console.log('[UserDeviceDetail] Received fresh device info via SSE push');
                        deviceInformation = updatedData.deviceInfo;
                        
                        toast.success('Device updated', {
                            description: `Updated after ${evt.payload.action}`,
                            duration: 2000
                        });
                    }
                    // Don't return here - let the message bubble to DeviceAppList component
                    // The DeviceAppList component subscribes to the same SSE store and needs to receive this message
                }
                
                // Log the raw event structure to understand the format
                console.log('[UserDeviceDetail] Raw event structure:', {
                    msg,
                    evt,
                    evtType,
                    payload: evt?.payload,
                    action: evt?.payload?.action
                });
                
                // Normalize payloads - handle both old and new structures
                // Old: { payload: { action: 'device:connection', deviceId, connected } }
                // New: { type: 'device:connection', payload: { deviceId, connected } }
                let normalized;
                if (evt?.payload?.action === 'device:connection') {
                    // Old structure: flatten payload with action into type
                    normalized = { ...evt.payload, type: 'device:connection' };
                } else if (evt?.type === 'device:connection' || evt?.type === 'device:disconnection') {
                    // New structure: already has type at top level, keep as is
                    normalized = evt;
                } else {
                    // Other structures: pass through
                    normalized = evt;
                }

                console.log('[UserDeviceDetail] Parsed event:', {
                    evtType,
                    normalizedType: normalized?.type,
                    forDevice: normalized?.deviceId || normalized?.payload?.deviceId,
                    currentDevice: device?.id,
                    payload: normalized
                });

                const isConnectionEvent = (evtType === 'device:connection') || (normalized?.type === 'device:connection');
                const isDisconnectionEvent = (evtType === 'device:disconnection') || (normalized?.type === 'device:disconnection');
                if (!isConnectionEvent && !isDisconnectionEvent) {
                    console.log('[UserDeviceDetail] Not a connection/disconnection event, ignoring');
                    return;
                }

                const c = normalized;
                const cDeviceId = c?.deviceId || c?.payload?.deviceId;
                if (!cDeviceId || cDeviceId !== device.id) {
                    console.log('[UserDeviceDetail] Not for this device, ignoring');
                    return;
                }

                const prev = { connected: !!device.connected, connectedAt: device.connectedAt, disconnectedAt: device.disconnectedAt };
                console.log('[UserDeviceDetail] Previous device state:', prev);

                // Reassign the whole object to trigger reactive updates in Svelte
                const connected = c?.connected ?? c?.payload?.connected ?? false;
                const connectedAt = c?.connectedAt ?? c?.payload?.connectedAt;
                const disconnectedAt = c?.disconnectedAt ?? c?.payload?.disconnectedAt;
                
                device = {
                    ...device,
                    connected: !!connected,
                    connectedAt: connected ? (connectedAt ?? device.connectedAt) : device.connectedAt,
                    disconnectedAt: !connected ? (disconnectedAt ?? device.disconnectedAt) : device.disconnectedAt
                };

                const next = { connected: !!device.connected, connectedAt: device.connectedAt, disconnectedAt: device.disconnectedAt };
                console.log('[UserDeviceDetail] Applied connection update:', { prev, next });
                
                // Force a reactivity update
                device = { ...device };
            } catch (e) {
                console.warn('[UserDeviceDetail] Error processing message:', e);
            }
        });

        // Add status message handlers for push file, pull file, and install app
        statusUnsubscribe = sseStore.on('*', (msg: any) => {
            try {
                const evt = msg?.data ?? msg;
                const evtType = evt?.type || msg?.event || evt?.payload?.type;
                
                // Handle push file status updates
                if (evtType === 'device:pushFileStatus' && evt?.payload?.deviceId === device.id) {
                    const payload = evt.payload;
                    console.log('[UserDeviceDetail] Push file status update:', payload);
                    
                    if (payload.progress !== undefined) {
                        pushFileProgress = payload.progress;
                        pushFileStatusMessage = payload.message || pushFileStatusMessage;
                        
                        actionStatus.set({
                            action: "pushFile",
                            status: payload.status === 'success' ? 'success' : payload.status === 'failed' ? 'failed' : 'loading',
                            message: `${pushFileStatusMessage} (${pushFileProgress}%)`,
                        });
                    }
                    
                    if (payload.status === 'success') {
                        actionStatus.set({
                            action: "pushFile",
                            status: "success",
                            message: "File pushed successfully",
                        });
                        toast.success("File pushed successfully");
                        
                        // Close the modal and reset loading state
                        showPushFileModal = false;
                        isLoading.set(false);
                    } else if (payload.status === 'failed') {
                        actionStatus.set({
                            action: "pushFile",
                            status: "failed",
                            message: payload.message || "File push failed",
                        });
                        toast.error(payload.message || "File push failed");
                        
                        // Close the modal and reset loading state on failure too
                        showPushFileModal = false;
                        isLoading.set(false);
                    }
                }
                
                // Handle pull file status updates
                if (evtType === 'device:pullFileStatus' && evt?.payload?.deviceId === device.id) {
                    const payload = evt.payload;
                    console.log('[UserDeviceDetail] Pull file status update:', payload);
                    
                    actionStatus.set({
                        action: "pullFile",
                        status: payload.status === 'success' ? 'success' : payload.status === 'failed' ? 'failed' : 'loading',
                        message: payload.message || `Pulling file... (${payload.progress || 0}%)`,
                    });
                    
                    if (payload.status === 'success') {
                        actionStatus.set({
                            action: "pullFile",
                            status: "success",
                            message: "File pulled successfully",
                        });
                        toast.success("File pulled successfully");
                        
                        // Close the modal and reset loading state
                        showPullFileModal = false;
                        isLoading.set(false);
                    } else if (payload.status === 'failed') {
                        actionStatus.set({
                            action: "pullFile",
                            status: "failed",
                            message: payload.message || "File pull failed",
                        });
                        toast.error(payload.message || "File pull failed");
                        
                        // Close the modal and reset loading state on failure too
                        showPullFileModal = false;
                        isLoading.set(false);
                    }
                }
                
                // Handle install app status updates
                if (evtType === 'device:installAppStatus' && evt?.payload?.deviceId === device.id) {
                    const payload = evt.payload;
                    console.log('[UserDeviceDetail] Install app status update:', payload);
                    
                    actionStatus.set({
                        action: "installApp",
                        status: payload.status === 'success' ? 'success' : payload.status === 'failed' ? 'failed' : 'loading',
                        message: payload.message || `Installing app... (${payload.progress || 0}%)`,
                    });
                    
                    if (payload.status === 'success') {
                        actionStatus.set({
                            action: "installApp",
                            status: "success",
                            message: "App installed successfully",
                        });
                        toast.success("App installed successfully");
                        
                        // Close the modal and reset loading state
                        showInstallAppModal = false;
                        isLoading.set(false);
                    } else if (payload.status === 'failed') {
                        actionStatus.set({
                            action: "installApp",
                            status: "failed",
                            message: payload.message || "App installation failed",
                        });
                        toast.error(payload.message || "App installation failed");
                        
                        // Close the modal and reset loading state on failure too
                        showInstallAppModal = false;
                        isLoading.set(false);
                    }
                }
                
                // Handle push file data (file download)
                if (evtType === 'device:pushFileData' && evt?.payload?.deviceId === device.id) {
                    const payload = evt.payload;
                    console.log('[UserDeviceDetail] Push file data received:', payload);
                    
                    // Trigger file download
                    if (payload.fileData && payload.fileName) {
                        downloadPushFile(payload.fileData, payload.fileName);
                        
                        actionStatus.set({
                            action: "pushFile",
                            status: "success",
                            message: "File downloaded successfully",
                        });
                        toast.success(`File downloaded: ${payload.fileName}`);
                        
                        // Close the modal and reset loading state
                        showPushFileModal = false;
                        isLoading.set(false);
                    }
                }
            } catch (e) {
                console.warn('[UserDeviceDetail] Error processing status message:', e);
            }
        });
    });

    onDestroy(() => {
        console.log('[UserDeviceDetail] onDestroy - cleaning up...');
        
        if (unsubscribeDeviceRealtime) {
            try { unsubscribeDeviceRealtime(); } catch {}
            unsubscribeDeviceRealtime = null;
        }
        if (unsubConnectionLight) {
            try { unsubConnectionLight(); } catch {}
            unsubConnectionLight = null;
        }
        if (statusUnsubscribe) {
            try { statusUnsubscribe(); } catch {}
            statusUnsubscribe = null;
        }
        
        // Unsubscribe from device channel
        if (sseStore.connectionId) {
            console.log('[UserDeviceDetail] Unsubscribing from device channel...');
            fetch(`/api/sse/unsubscribe/device/${device.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connectionId: sseStore.connectionId })
            }).catch(err => console.warn('Unsubscribe failed:', err));
        }
        
        // Disconnect this component's SSE connection (won't affect other tabs now!)
        console.log('[UserDeviceDetail] Disconnecting per-component SSE...');
        sseStore.disconnect();
        console.log('[UserDeviceDetail] Cleanup complete');
    });

    // Device action handlers
    function addActionLogRow(actionType: string, message: string, status: 'initiated' | 'in_progress' | 'success' | 'failed' = 'initiated', logId?: string) {
        const id = logId || `temp-${actionType}-${Date.now()}`;
        actionLogs = [
            {
                id,
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
        return id;
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
        goto(`/user/iot/devices/${device.id}/terminal`);
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
                /* timeoutMs = */ 120000, // Screenshots might take longer; allow up to 2 minutes
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

    // Utility function to download logs file
    function downloadLogsFile(base64Data: string, filename: string) {
        try {
            // Decode the base64 zip data and download it
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/zip' });
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading logs file:', error);
            toast.error('Failed to download logs file');
        }
    }

    // Utility function to download push file
    function downloadPushFile(base64Data: string, filename: string) {
        try {
            // Decode the base64 data and download it
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Determine MIME type based on file extension
            const extension = filename.split('.').pop()?.toLowerCase();
            let mimeType = 'application/octet-stream';
            if (extension === 'txt') mimeType = 'text/plain';
            else if (extension === 'json') mimeType = 'application/json';
            else if (extension === 'pdf') mimeType = 'application/pdf';
            else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
            else if (extension === 'png') mimeType = 'image/png';
            else if (extension === 'zip') mimeType = 'application/zip';
            
            const blob = new Blob([bytes], { type: mimeType });
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading push file:', error);
            toast.error('Failed to download file');
        }
    }

    async function restartDevice() {
        isLoading.set(true);
        actionStatus.set({
            action: "refresh",
            status: "loading",
            message: "Sending refresh command...",
        });
        const tempId = addActionLogRow('refresh', 'Sending refresh command…', 'in_progress');

        try {
            // Use the unified action API instead of direct SSE
            const response = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'refresh'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to refresh device: ${response.statusText}`);
            }

            const result = await response.json();
            
            actionStatus.set({
                action: "refresh",
                status: "success",
                message: "Refresh command sent",
            });
            toast.success("Device refresh initiated");
            
            // The real-time handler will update the temp log with the server's log ID
            // when it receives the device:statusUpdate message
        } catch (error) {
            actionStatus.set({
                action: "refresh",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to refresh device",
            });
            toast.error("Failed to refresh device");
            console.error("Error refreshing device:", error);
            updateTempActionLog(tempId, 'failed', error instanceof Error ? error.message : 'Failed to refresh device');
        } finally {
            isLoading.set(false);
        }
    }

    async function rebootDevice() {
        isLoading.set(true);
        actionStatus.set({
            action: "reboot",
            status: "loading",
            message: "Sending reboot command...",
        });
        const tempId = addActionLogRow('reboot', 'Sending reboot command…', 'in_progress');

        try {
            // Use the unified action API instead of direct SSE
            const response = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'reboot'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to reboot device: ${response.statusText}`);
            }

            const result = await response.json();
            
            actionStatus.set({
                action: "reboot",
                status: "success",
                message: "Reboot command sent",
            });
            toast.success("Device reboot initiated");
            
            // The real-time handler will update the temp log with the server's log ID
            // when it receives the device:statusUpdate message
        } catch (error) {
            actionStatus.set({
                action: "reboot",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to reboot device",
            });
            toast.error("Failed to reboot device");
            console.error("Error rebooting device:", error);
            updateTempActionLog(tempId, 'failed', error instanceof Error ? error.message : 'Failed to reboot device');
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
        if ($isLoading) return;
        
        isLoading.set(true);
        actionStatus.set({
            action: "logs",
            status: "in_progress",
            message: "Requesting logs from device...",
        });

        try {
            // Use the unified action API instead of direct SSE
            const response = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'getLogs',
                    format: 'zip'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to get logs: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Use the real log ID from the server response
            const realLogId = result.data?.operationId;
            if (realLogId) {
                addActionLogRow('getLogs', 'Logs request initiated…', 'in_progress', realLogId);
            }
            
            actionStatus.set({
                action: "logs",
                status: "success",
                message: "Logs request initiated",
            });
            toast.success("Logs request initiated");
            
            // The real-time handler will update the log with the real log ID
            // when it receives the device:statusUpdate message
            
        } catch (error) {
            actionStatus.set({
                action: "logs",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to get logs",
            });
            toast.error("Failed to get device logs");
            console.error('Error getting logs:', error);
            // Create a temp log for error display
            const tempId = addActionLogRow('getLogs', 'Failed to get logs', 'failed');
        } finally {
            isLoading.set(false);
        }
    }

    // -------------------- Install App selection modal --------------------
    let showInstallAppModal = false;
    let installAppItems: any[] = [];
    let selectedInstallAppId: string | null = null;
    let selectedInstallApp: any | null = null;
    let loadingInstallApp = false;
    let installAppPage = 1;
    let installAppTotalPages = 1;
    let installAppSearch = '';

    // -------------------- Pull File selection modal --------------------
    let showPullFileModal = false;
    let pullFileItems: any[] = [];
    let selectedPullFileId: string | null = null;
    let selectedPullFile: any | null = null;
    let loadingPullFile = false;
    let pullFilePage = 1;
    let pullFileTotalPages = 1;
    let pullFileSearch = '';
    let pullFileDestinationPath = '';

    // -------------------- Push File modal --------------------
    let showPushFileModal = false;
    let pushFileSourcePath = '';
    let pushFileProgress = 0;
    let pushFileStatusMessage = '';

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
            const res = await fetch(`/api/user/resources/firmware?${params.toString()}`, { credentials: 'include' });
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
            // Use the unified action API instead of direct SSE
            const response = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'updateFirmware',
                    firmwareVersion: selectedFirmware.version ?? '1.0.0'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to update firmware: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Use the real log ID from the server response
            const realLogId = result.data?.operationId;
            if (realLogId) {
                // Update the temp log with the real log ID
                const logIndex = actionLogs.findIndex(log => log.id === pendingFirmwareTempId);
                if (logIndex !== -1) {
                    actionLogs[logIndex].id = realLogId;
                }
            }
            
            actionStatus.set({
                action: 'firmware',
                status: 'success',
                message: 'Firmware update initiated',
            });
            toast.success('Firmware update initiated');
            showFirmwareModal = false;
            
            // The real-time handler will update the log with progress
            // when it receives the device:statusUpdate message
            
        } catch (error) {
            actionStatus.set({
                action: 'firmware',
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to update firmware',
            });
            toast.error('Failed to update firmware');
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

    // -------------------- Install App functions --------------------
    async function loadInstallAppResources(page = 1) {
        console.log('Loading install app resources, page:', page);
        loadingInstallApp = true;
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: '20'
            });
            if (installAppSearch && installAppSearch.trim().length > 0) {
                params.set('search', installAppSearch.trim());
            }
            const url = `/api/resources/apps?${params.toString()}`;
            console.log('Fetching from URL:', url);
            const res = await fetch(url, { credentials: 'include' });
            console.log('Response status:', res.status);
            if (!res.ok) {
                throw new Error('Failed to load app resources');
            }
            const data = await res.json();
            console.log('Received data:', data);
            installAppItems = data.items || [];
            installAppPage = data.meta?.page || 1;
            installAppTotalPages = data.meta?.totalPages || 1;
            console.log('Set installAppItems:', installAppItems.length, 'items');
        } catch (err) {
            console.error('App list error:', err);
            toast.error('Failed to load app resources');
        } finally {
            loadingInstallApp = false;
        }
    }

    async function openInstallAppModal() {
        console.log('=== openInstallAppModal function called ===');
        console.log('Opening install app modal...');
        showInstallAppModal = true;
        selectedInstallAppId = selectedInstallApp?.id || null;
        console.log('Modal state set to true, loading resources...');
        await loadInstallAppResources(1);
        console.log('Resources loaded, modal should be visible');
    }

    function onSelectInstallApp(id: string) {
        selectedInstallAppId = id;
        selectedInstallApp = installAppItems.find((it) => it.id === id) || null;
    }

    function onInstallAppSearch(p?: number) {
        loadInstallAppResources(p ?? 1);
    }

    function onSelectInstallAppFromList(id: string) {
        onSelectInstallApp(id);
    }


    async function confirmInstallApp() {
        if (!selectedInstallApp) {
            toast.error('Please select an app');
            return;
        }

        isLoading.set(true);
        try {
            const tempId = `temp-${Date.now()}`;
            actionStatus.set({
                action: 'installApp',
                status: 'in_progress',
                message: 'Initiating app installation...'
            });

            // Add optimistic log entry
            pendingInstallAppTempId = tempId;
            actionLogs = [
                {
                    id: tempId,
                    deviceId: device.id,
                    actionType: 'install',
                    status: 'in_progress',
                    initiatedBy: 'current_user',
                    initiatedAt: new Date().toISOString(),
                    message: 'Initiating app installation…',
                    metadata: {
                        app: {
                            resourceId: selectedInstallApp.id,
                            resourceName: selectedInstallApp.name,
                            packageName: selectedInstallApp.packageName ?? null,
                            sizeBytes: selectedInstallApp.size,
                            path: selectedInstallApp.path,
                            version: selectedInstallApp.version ?? null,
                            format: selectedInstallApp.format ?? null
                        }
                    }
                },
                ...actionLogs
            ];

            // Use the unified action API instead of direct SSE
            const response = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'installApp',
                    packageName: selectedInstallApp.packageName ?? 'unknown',
                    resourceId: selectedInstallApp.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to install app: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Use the real log ID from the server response
            const realLogId = result.data?.operationId;
            if (realLogId) {
                // Update the temp log with the real log ID
                const logIndex = actionLogs.findIndex(log => log.id === pendingInstallAppTempId);
                if (logIndex !== -1) {
                    actionLogs[logIndex].id = realLogId;
                }
            }
            
            actionStatus.set({
                action: 'installApp',
                status: 'success',
                message: 'App installation initiated',
            });
            toast.success('App installation initiated');
            showInstallAppModal = false;
            
            // The real-time handler will update the log with progress
            // when it receives the device:statusUpdate message
            
        } catch (error) {
            actionStatus.set({
                action: 'installApp',
                status: 'failed',
                message: error instanceof Error ? error.message : 'Failed to install app',
            });
            toast.error('Failed to install app');
            console.error('Error installing app:', error);
            
            // Handle error in action logs
            if (pendingInstallAppTempId) {
                const idx = actionLogs.findIndex((l) => l.id === pendingInstallAppTempId);
                if (idx >= 0) {
                    const existing = actionLogs[idx];
                    actionLogs[idx] = {
                        ...existing,
                        status: 'failed',
                        message: existing.message || (error instanceof Error ? error.message : 'Failed to install app'),
                        completedAt: new Date().toISOString()
                    };
                    actionLogs = [...actionLogs];
                }
                pendingInstallAppTempId = null;
            }
        } finally {
            isLoading.set(false);
        }
    }

    // -------------------- Pull File functions --------------------
    async function loadPullFileResources(page = 1) {
        console.log('Loading pull file resources, page:', page);
        loadingPullFile = true;
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: '20'
            });
            if (pullFileSearch && pullFileSearch.trim().length > 0) {
                params.set('search', pullFileSearch.trim());
            }
            const url = `/api/resources/files?${params.toString()}`;
            console.log('Fetching from URL:', url);
            const res = await fetch(url, { credentials: 'include' });
            console.log('Response status:', res.status);
            if (!res.ok) {
                throw new Error('Failed to load file resources');
            }
            const data = await res.json();
            console.log('Received data:', data);
            pullFileItems = data.items || [];
            pullFilePage = data.meta?.page || 1;
            pullFileTotalPages = data.meta?.totalPages || 1;
            console.log('Set pullFileItems:', pullFileItems.length, 'items');
        } catch (err) {
            console.error('File list error:', err);
            toast.error('Failed to load file resources');
        } finally {
            loadingPullFile = false;
        }
    }

    async function openPullFileModal() {
        console.log('=== openPullFileModal function called ===');
        console.log('Opening pull file modal...');
        showPullFileModal = true;
        selectedPullFileId = selectedPullFile?.id || null;
        pullFileDestinationPath = '';
        console.log('Modal state set to true, loading resources...');
        await loadPullFileResources(1);
        console.log('Resources loaded, modal should be visible');
    }

    function onSelectPullFile(id: string) {
        selectedPullFileId = id;
        selectedPullFile = pullFileItems.find((it) => it.id === id) || null;
    }

    function onPullFileSearch(p?: number) {
        loadPullFileResources(p ?? 1);
    }

    function onSelectPullFileFromList(id: string) {
        onSelectPullFile(id);
    }

    async function confirmPullFile() {
        if (!selectedPullFile) {
            toast.error('Please select a file');
            return;
        }

        if (!pullFileDestinationPath.trim()) {
            toast.error('Please enter destination path');
            return;
        }

        isLoading.set(true);
        try{
            actionStatus.set({
                action: 'pushFile',
                status: 'in_progress',
                message: 'Initiating file push...'
            });

            // Use the unified action API instead of direct SSE
            const response = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'pushFile',
                    sourcePath: selectedPullFile.path,
                    destinationPath: pullFileDestinationPath.trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to pull file: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Use the real log ID from the server response
            const realLogId = result.data?.operationId;
            if (realLogId) {
                addActionLogRow('pushFile', 'File push initiated…', 'in_progress', realLogId);
            }
            
            actionStatus.set({
                action: 'pushFile',
                status: 'success',
                message: 'File push initiated',
            });
            toast.success('File push initiated');
            showPullFileModal = false;
            
            // The real-time handler will update the log with progress
            // when it receives the device:statusUpdate message
            
        } catch (error) {
            actionStatus.set({
                action: 'pushFile',
                status: 'failed',
                message: error instanceof Error ? error.message : 'Failed to push file',
            });
            toast.error('Failed to push file');
            console.error('Error pushing file:', error);
        } finally {
            isLoading.set(false);
        }
    }

    // -------------------- Push File functions --------------------
    async function openPushFileModal() {
        console.log('=== openPushFileModal function called ===');
        console.log('Opening push file modal...');
        showPushFileModal = true;
        pushFileSourcePath = '';
        pushFileProgress = 0;
        pushFileStatusMessage = '';
        console.log('Modal state set to true');
    }

    async function confirmPushFile() {
        if (!pushFileSourcePath.trim()) {
            toast.error('Please enter source file path');
            return;
        }

        isLoading.set(true);
        actionStatus.set({
            action: 'pullFile',
            status: 'in_progress',
            message: 'Initiating file pull...'
        });

        try {
            // Use the unified action API instead of direct SSE
            const response = await fetch(`/api/devices/${device.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'pullFile',
                    sourcePath: pushFileSourcePath.trim(),
                    destinationPath: pushFileSourcePath.trim() // Use same path as destination for now
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to pull file: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Use the real log ID from the server response
            const realLogId = result.data?.operationId;
            if (realLogId) {
                addActionLogRow('pullFile', 'File pull initiated…', 'in_progress', realLogId);
            }
            
            actionStatus.set({
                action: 'pullFile',
                status: 'success',
                message: 'File pull initiated',
            });
            toast.success('File pull initiated');
            showPushFileModal = false;
            
            // The real-time handler will update the log with the real log ID
            // when it receives the device:statusUpdate message
            
        } catch (error) {
            actionStatus.set({
                action: 'pullFile',
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to pull file',
            });
            toast.error('Failed to pull file');
            console.error('Error pulling file:', error);
            // Create a temp log for error display
            const tempId = addActionLogRow('pullFile', 'Failed to pull file', 'failed');
        } finally {
            isLoading.set(false);
        }
    }

    // Navigate to edit page
    function navigateToEdit() {
        goto(`/user/iot/devices/${device.id}/edit`);
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
            onReboot={rebootDevice}
            onOpenInstallAppModal={openInstallAppModal}
            onOpenPullFileModal={openPullFileModal}
            onOpenPushFileModal={openPushFileModal}
            onOpenFirmwareModal={openFirmwareModal}
            onViewLogs={viewLogs}
            onTerminal={accessRemoteTerminal}
            onRemoteDesktop={() => { addActionLogRow('remote_desktop', 'Opening remote desktop', 'initiated'); goto(`/user/iot/devices/${device.id}/rdp`); }}
        />

        <!-- Status message for actions -->
        <StatusBanner status={$actionStatus} />
    </AdminCard>

<InstallAppModal
    show={showInstallAppModal}
    items={installAppItems}
    loading={loadingInstallApp}
    page={installAppPage}
    totalPages={installAppTotalPages}
    search={installAppSearch}
    selectedId={selectedInstallAppId}
    searchFn={onInstallAppSearch}
    selectFn={onSelectInstallAppFromList}
    onClose={() => (showInstallAppModal = false)}
    onConfirm={confirmInstallApp}
/>

<PullFileModal
    show={showPullFileModal}
    items={pullFileItems}
    loading={loadingPullFile}
    page={pullFilePage}
    totalPages={pullFileTotalPages}
    search={pullFileSearch}
    selectedId={selectedPullFileId}
    bind:destinationPath={pullFileDestinationPath}
    searchFn={onPullFileSearch}
    selectFn={onSelectPullFileFromList}
    onClose={() => (showPullFileModal = false)}
    onConfirm={confirmPullFile}
/>

<PushFileModal
    show={showPushFileModal}
    bind:sourcePath={pushFileSourcePath}
    loading={$isLoading && $actionStatus.action === 'pullFile'}
    progress={pushFileProgress}
    statusMessage={pushFileStatusMessage}
    onClose={() => (showPushFileModal = false)}
    onConfirm={confirmPushFile}
/>

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

    <!-- Tabbed Device Detail Interface -->
    <DeviceDetailTabs 
        {device} 
        {actionLogs} 
        {licenses} 
        {apiKeyEnhance} 
        {apiKeySubmitting}
        {isLoading}
        {actionStatus}
        {deviceInformation}
        {sseStore}
    />
</AdminPageLayout>

<!-- Terminal Dialog has been replaced with a dedicated terminal page -->
