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
    import DeviceDeviceTagComponent from "$lib/components/ui_components_sveltekit/devices/device_device_tag/DeviceDeviceTagComponent.svelte";
    import DeviceDetailTabs from "$lib/components/device/DeviceDetailTabs.svelte";
    
    export let data: PageData;
    // Use let bindings so we can reassign and trigger Svelte reactivity on updates
    let device = (data as any).device;
    $: device = data.device;
    let licenses = device.licenses;
    let deviceActionLogs = (data as any).deviceActionLogs;
    const MAX_ACTION_LOGS = 15;
    let actionLogs: any[] = Array.isArray(deviceActionLogs) ? [...deviceActionLogs].slice(0, MAX_ACTION_LOGS) : [];
    // Track a temporary optimistic log row for firmware update initiation
    let pendingFirmwareTempId: string | null = null;
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
        if (!unsubscribeDeviceRealtime) {
            unsubscribeDeviceRealtime = subscribeDeviceDetailEvents(
                device.id,
                () => actionLogs,
                (logs) => { actionLogs = logs; }
            );
        }

        // Lightweight connection status updates remain inline
        unsubConnectionLight = sseStore.on('*', (msg: any) => {
            console.log('[UserDeviceDetail] SSE message received:', msg);
            try {
                const evt = msg?.data ?? msg;
                const evtType = evt?.type || msg?.event || evt?.payload?.type;
                
                // Log the raw event structure to understand the format
                console.log('[UserDeviceDetail] Raw event structure:', {
                    msg,
                    evt,
                    evtType,
                    payload: evt?.payload,
                    action: evt?.payload?.action
                });
                
                // Normalize payloads that carry action in payload
                const normalized = evt?.payload?.action === 'device:connection' ? { ...evt.payload, type: 'device:connection' }
                                  : evt;

                console.log('[UserDeviceDetail] Parsed event:', {
                    evtType,
                    normalizedType: normalized?.type,
                    forDevice: normalized?.deviceId,
                    currentDevice: device?.id,
                    payload: normalized
                });

                const isConnectionEvent = (evtType === 'device:connection') || (normalized?.type === 'device:connection');
                if (!isConnectionEvent) {
                    console.log('[UserDeviceDetail] Not a connection event, ignoring');
                    return;
                }

                const c = normalized;
                if (!c?.deviceId || c.deviceId !== device.id) {
                    console.log('[UserDeviceDetail] Not for this device, ignoring');
                    return;
                }

                const prev = { connected: !!device.connected, connectedAt: device.connectedAt, disconnectedAt: device.disconnectedAt };
                console.log('[UserDeviceDetail] Previous device state:', prev);

                // Reassign the whole object to trigger reactive updates in Svelte
                device = {
                    ...device,
                    connected: !!c.connected,
                    connectedAt: c.connected ? (c.connectedAt ?? device.connectedAt) : device.connectedAt,
                    disconnectedAt: !c.connected ? (c.disconnectedAt ?? device.disconnectedAt) : device.disconnectedAt
                };

                const next = { connected: !!device.connected, connectedAt: device.connectedAt, disconnectedAt: device.disconnectedAt };
                console.log('[UserDeviceDetail] Applied connection update:', { prev, next });
                
                // Force a reactivity update
                device = { ...device };
            } catch (e) {
                console.warn('[UserDeviceDetail] Error processing message:', e);
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
            message: "Generating device logs...",
        });

        try {
            // Send the request to the device using sendRequest (this will trigger the device)
            console.log('Sending logs request to device:', device.id);
            
            // Set up a listener for the device:logsStatus message that contains the actual logs data
            let responseReceived = false;
            let progress = 0;
            let statusMessage = "Requesting device logs...";
            
            const responseHandler = (message: any) => {
                console.log('Received message:', message);
                
                // Handle device:logsStatus messages (progress updates and completion)
                if (message.event === 'device:logsStatus' && 
                    message.data?.payload?.deviceId === device.id) {
                    
                    console.log('Processing logs status:', message.data.payload);
                    const payload = message.data.payload;
                    
                    // Update progress and status
                    if (payload.progress !== undefined) {
                        progress = payload.progress;
                        statusMessage = payload.message || statusMessage;
                        
                        actionStatus.set({
                            action: "logs",
                            status: "loading",
                            message: `${statusMessage} (${progress}%)`,
                        });
                    }
                    
                    // Handle completion
                    if (payload.status === 'success' && payload.logsData) {
                        console.log('Logs completed successfully, processing download...');
                        
                        // Trigger file download
                        if (payload.logsData) {
                            const now = new Date();
                            const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
                            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
                            downloadLogsFile(payload.logsData, `device_logs_${dateStr}_${timeStr}.zip`);
                        }
                        
                        actionStatus.set({
                            action: "logs",
                            status: "success",
                            message: "Logs downloaded successfully",
                        });
                        
                        responseReceived = true;
                    } else if (payload.status === 'error') {
                        actionStatus.set({
                            action: "logs",
                            status: "error",
                            message: payload.message || "Failed to retrieve logs",
                        });
                        responseReceived = true;
                    }
                }
                
                // Also handle device:response messages for backward compatibility
                if (message.event === 'device:response' && 
                    message.data?.payload?.action === 'getLogs' && 
                    message.data?.payload?.deviceId === device.id) {
                    
                    console.log('Processing logs response:', message.data.payload);
                    
                    if (message.data.payload?.success && message.data.payload?.logsData) {
                        // Trigger file download
                        const now = new Date();
                        const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
                        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
                        const filename = `device_logs_${dateStr}_${timeStr}.zip`;
                        downloadLogsFile(message.data.payload.logsData, filename);

                        actionStatus.set({
                            action: "logs",
                            status: "success",
                            message: "Logs downloaded successfully",
                        });
                        toast.success("Device logs downloaded successfully");
                        responseReceived = true;
                    } else {
                        throw new Error(message.data.payload?.message || "Failed to generate logs on device");
                    }
                }
            };

            // Subscribe to device:response messages
            const unsubscribe = sseStore.on('device:response', responseHandler);

            // Send the request
            await sseStore.sendRequest({
                type: 'device',
                scope: `subscription:device:${device.id}`,
                payload: {
                    action: 'getLogs',
                    deviceId: device.id,
                    format: 'zip'
                }
            }, 180000, 'logs'); 

            // Wait for response with timeout (match server: 10 minutes)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Request timed out after 10 minutes")), 10 * 60 * 1000)
            );
            
            const responsePromise = new Promise<void>((resolve) => {
                const checkResponse = () => {
                    if (responseReceived) {
                        resolve();
                    } else {
                        setTimeout(checkResponse, 100); // Check every 100ms
                    }
                };
                checkResponse();
            });

            // Race between response and timeout
            await Promise.race([responsePromise, timeoutPromise]);

            // Clean up the listener
            unsubscribe();
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
            onOpenFirmwareModal={openFirmwareModal}
            onViewLogs={viewLogs}
            onTerminal={accessRemoteTerminal}
            onRemoteDesktop={() => { addActionLogRow('remote_desktop', 'Opening remote desktop', 'initiated'); goto(`/user/iot/devices/${device.id}/rdp`); }}
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

    <!-- Tabbed Device Detail Interface -->
    <DeviceDetailTabs 
        {device} 
        {actionLogs} 
        {licenses} 
        {apiKeyEnhance} 
        {apiKeySubmitting}
    />
</AdminPageLayout>

<!-- Terminal Dialog has been replaced with a dedicated terminal page -->
