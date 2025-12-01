import { writable, type Writable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { sseStore } from '$lib/stores/sse-store';
import { subscribeDeviceDetailEvents } from '$lib/client/actionHandlers';
import { DeviceActionsService } from '$lib/services/deviceActionsService';
import { useDeviceSSEHandlers } from './useDeviceSSEHandlers';

export interface UseDeviceDetailOptions {
    deviceId: string;
    basePath: '/admin' | '/user';
    resourceApiPath: '/api/admin/resources' | '/api/user/resources';
    device: { get: () => any; set: (value: any) => void };
    deviceInformation: { get: () => any; set: (value: any) => void };
    actionLogs: { get: () => any[]; set: (value: any[]) => void };
    isLoading: Writable<boolean>;
    actionStatus: Writable<{ action: string; status: string; message: string }>;
    screenshotOpen: { get: () => boolean; set: (value: boolean) => void };
    screenshotData: { get: () => string | null; set: (value: string | null) => void };
    screenshotFormat: { get: () => string; set: (value: string) => void };
    // Modal states - Install App
    showInstallAppModal: { get: () => boolean; set: (value: boolean) => void };
    installAppItems: { get: () => any[]; set: (value: any[]) => void };
    selectedInstallAppId: { get: () => string | null; set: (value: string | null) => void };
    selectedInstallApp: { get: () => any | null; set: (value: any | null) => void };
    loadingInstallApp: { get: () => boolean; set: (value: boolean) => void };
    installAppPage: { get: () => number; set: (value: number) => void };
    installAppTotalPages: { get: () => number; set: (value: number) => void };
    installAppSearch: { get: () => string; set: (value: string) => void };
    // Modal states - Pull File
    showPullFileModal: { get: () => boolean; set: (value: boolean) => void };
    pullFileItems: { get: () => any[]; set: (value: any[]) => void };
    selectedPullFileId: { get: () => string | null; set: (value: string | null) => void };
    selectedPullFile: { get: () => any | null; set: (value: any | null) => void };
    loadingPullFile: { get: () => boolean; set: (value: boolean) => void };
    pullFilePage: { get: () => number; set: (value: number) => void };
    pullFileTotalPages: { get: () => number; set: (value: number) => void };
    pullFileSearch: { get: () => string; set: (value: string) => void };
    pullFileDestinationPath: { get: () => string; set: (value: string) => void };
    // Modal states - Push File
    showPushFileModal: { get: () => boolean; set: (value: boolean) => void };
    pushFileSourcePath: { get: () => string; set: (value: string) => void };
    pushFileProgress: { get: () => number; set: (value: number) => void };
    pushFileStatusMessage: { get: () => string; set: (value: string) => void };
    // Modal states - Firmware
    showFirmwareModal: { get: () => boolean; set: (value: boolean) => void };
    firmwareItems: { get: () => any[]; set: (value: any[]) => void };
    selectedFirmwareId: { get: () => string | null; set: (value: string | null) => void };
    selectedFirmware: { get: () => any | null; set: (value: any | null) => void };
    loadingFirmware: { get: () => boolean; set: (value: boolean) => void };
    firmwarePage: { get: () => number; set: (value: number) => void };
    firmwareTotalPages: { get: () => number; set: (value: number) => void };
    firmwareSearch: { get: () => string; set: (value: string) => void };
    // Temp log IDs
    pendingFirmwareTempId: { get: () => string | null; set: (value: string | null) => void };
    pendingInstallAppTempId: { get: () => string | null; set: (value: string | null) => void };
}

/**
 * Main composable for device detail pages
 * Extracts all functions and handlers, state remains in component for Svelte reactivity
 */
export function useDeviceDetail(options: UseDeviceDetailOptions) {
    const {
        deviceId,
        basePath,
        resourceApiPath,
        device,
        deviceInformation,
        actionLogs,
        isLoading,
        actionStatus,
        screenshotOpen,
        screenshotData,
        screenshotFormat,
        showInstallAppModal,
        installAppItems,
        selectedInstallAppId,
        selectedInstallApp,
        loadingInstallApp,
        installAppPage,
        installAppTotalPages,
        installAppSearch,
        showPullFileModal,
        pullFileItems,
        selectedPullFileId,
        selectedPullFile,
        loadingPullFile,
        pullFilePage,
        pullFileTotalPages,
        pullFileSearch,
        pullFileDestinationPath,
        showPushFileModal,
        pushFileSourcePath,
        pushFileProgress,
        pushFileStatusMessage,
        showFirmwareModal,
        firmwareItems,
        selectedFirmwareId,
        selectedFirmware,
        loadingFirmware,
        firmwarePage,
        firmwareTotalPages,
        firmwareSearch,
        pendingFirmwareTempId,
        pendingInstallAppTempId
    } = options;

    const MAX_ACTION_LOGS = 15;

    // Action log helpers
    function addActionLogRow(actionType: string, message: string, status: 'initiated' | 'in_progress' | 'success' | 'failed' = 'initiated', logId?: string) {
        const id = logId || `temp-${actionType}-${Date.now()}`;
        const currentLogs = actionLogs.get();
        actionLogs.set([
            {
                id,
                deviceId: device.get().id,
                actionType,
                status,
                progress: null,
                initiatedAt: new Date().toISOString(),
                completedAt: null,
                durationMs: null,
                message,
                user: null
            },
            ...currentLogs
        ].slice(0, MAX_ACTION_LOGS));
        return id;
    }

    function updateTempActionLog(tempId: string | null, status: 'success' | 'failed', message?: string) {
        if (!tempId) return;
        const currentLogs = actionLogs.get();
        const idx = currentLogs.findIndex((l) => l.id === tempId);
        if (idx >= 0) {
            const existing = currentLogs[idx];
            currentLogs[idx] = {
                ...existing,
                status,
                message: message ?? existing.message,
                completedAt: new Date().toISOString()
            };
            actionLogs.set([...currentLogs]);
        }
    }

    // Initialize DeviceActionsService
    const actionsService = new DeviceActionsService(
        deviceId,
        isLoading,
        actionStatus,
        {
            addActionLog: addActionLogRow,
            updateActionLog: updateTempActionLog
        }
    );

    // Utility functions
    function downloadPushFile(base64Data: string, filename: string) {
        try {
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const extension = filename.split('.').pop()?.toLowerCase();
            let mimeType = 'application/octet-stream';
            if (extension === 'txt') mimeType = 'text/plain';
            else if (extension === 'json') mimeType = 'application/json';
            else if (extension === 'pdf') mimeType = 'application/pdf';
            else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
            else if (extension === 'png') mimeType = 'image/png';
            else if (extension === 'zip') mimeType = 'application/zip';
            
            const blob = new Blob([bytes], { type: mimeType });
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

    // Resource loading functions
    async function loadFirmwareResources(page = 1) {
        loadingFirmware.set(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: '20',
                sort: 'createdAt',
                order: 'desc'
            });
            if (firmwareSearch.get() && firmwareSearch.get().trim().length > 0) {
                params.set('search', firmwareSearch.get().trim());
            }
            const res = await fetch(`${resourceApiPath}/firmware?${params.toString()}`, { credentials: 'include' });
            if (!res.ok) {
                throw new Error('Failed to load firmware resources');
            }
            const data = await res.json();
            firmwareItems.set(data.items || []);
            firmwarePage.set(data.meta?.page || 1);
            firmwareTotalPages.set(data.meta?.totalPages || 1);
        } catch (err) {
            console.error('Firmware list error:', err);
            toast.error('Failed to load firmware resources');
        } finally {
            loadingFirmware.set(false);
        }
    }

    async function loadInstallAppResources(page = 1) {
        loadingInstallApp.set(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: '20'
            });
            if (installAppSearch.get() && installAppSearch.get().trim().length > 0) {
                params.set('search', installAppSearch.get().trim());
            }
            const res = await fetch(`/api/resources/apps?${params.toString()}`, { credentials: 'include' });
            if (!res.ok) {
                throw new Error('Failed to load app resources');
            }
            const data = await res.json();
            installAppItems.set(data.items || []);
            installAppPage.set(data.meta?.page || 1);
            installAppTotalPages.set(data.meta?.totalPages || 1);
        } catch (err) {
            console.error('App list error:', err);
            toast.error('Failed to load app resources');
        } finally {
            loadingInstallApp.set(false);
        }
    }

    async function loadPullFileResources(page = 1) {
        loadingPullFile.set(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: '20'
            });
            if (pullFileSearch.get() && pullFileSearch.get().trim().length > 0) {
                params.set('search', pullFileSearch.get().trim());
            }
            const res = await fetch(`/api/resources/files?${params.toString()}`, { credentials: 'include' });
            if (!res.ok) {
                throw new Error('Failed to load file resources');
            }
            const data = await res.json();
            pullFileItems.set(data.items || []);
            pullFilePage.set(data.meta?.page || 1);
            pullFileTotalPages.set(data.meta?.totalPages || 1);
        } catch (err) {
            console.error('File list error:', err);
            toast.error('Failed to load file resources');
        } finally {
            loadingPullFile.set(false);
        }
    }

    // Modal handlers
    async function openFirmwareModal() {
        showFirmwareModal.set(true);
        selectedFirmwareId.set(selectedFirmware.get()?.id || null);
        await loadFirmwareResources(1);
    }

    function onSelectFirmware(id: string) {
        selectedFirmwareId.set(id);
        selectedFirmware.set(firmwareItems.get().find((it) => it.id === id) || null);
    }

    async function confirmFirmwareUpdate() {
        const fw = selectedFirmware.get();
        if (!fw) {
            toast.error('Please select a firmware');
            return;
        }

        const tempId = `temp-${Date.now()}`;
        pendingFirmwareTempId.set(tempId);
        const currentLogs = actionLogs.get();
        actionLogs.set([
            {
                id: tempId,
                deviceId: device.get().id,
                actionType: 'firmware_update',
                status: 'in_progress',
                progress: null,
                initiatedAt: new Date().toISOString(),
                completedAt: null,
                durationMs: null,
                message: 'Initiating firmware update…',
                user: null
            },
            ...currentLogs
        ].slice(0, MAX_ACTION_LOGS));

        try {
            const response = await fetch(`/api/devices/${deviceId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'updateFirmware',
                    firmwareVersion: fw.version ?? '1.0.0',
                    resourceId: fw.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to update firmware: ${response.statusText}`);
            }

            const result = await response.json();
            const realLogId = result.data?.operationId;
            if (realLogId) {
                const logs = actionLogs.get();
                const logIndex = logs.findIndex(log => log.id === tempId);
                if (logIndex !== -1) {
                    logs[logIndex].id = realLogId;
                    actionLogs.set([...logs]);
                }
            }

            actionStatus.set({
                action: 'firmware',
                status: 'success',
                message: 'Firmware update initiated',
            });
            toast.success('Firmware update initiated');
            showFirmwareModal.set(false);
        } catch (error) {
            actionStatus.set({
                action: 'firmware',
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to update firmware',
            });
            toast.error('Failed to update firmware');
            console.error('Error updating firmware:', error);
            
            const logs = actionLogs.get();
            const idx = logs.findIndex((l) => l.id === tempId);
            if (idx >= 0) {
                const existing = logs[idx];
                logs[idx] = {
                    ...existing,
                    status: 'failed',
                    message: existing.message || (error instanceof Error ? error.message : 'Failed to update firmware'),
                    completedAt: new Date().toISOString()
                };
                actionLogs.set([...logs]);
            }
            pendingFirmwareTempId.set(null);
        } finally {
            isLoading.set(false);
        }
    }

    async function openInstallAppModal() {
        showInstallAppModal.set(true);
        selectedInstallAppId.set(selectedInstallApp.get()?.id || null);
        await loadInstallAppResources(1);
    }

    function onSelectInstallApp(id: string) {
        selectedInstallAppId.set(id);
        selectedInstallApp.set(installAppItems.get().find((it) => it.id === id) || null);
    }

    async function confirmInstallApp() {
        const app = selectedInstallApp.get();
        if (!app) {
            toast.error('Please select an app');
            return;
        }

        const tempId = `temp-${Date.now()}`;
        pendingInstallAppTempId.set(tempId);
        isLoading.set(true);
        
        try {
            actionStatus.set({
                action: 'installApp',
                status: 'in_progress',
                message: 'Initiating app installation...'
            });

            const currentLogs = actionLogs.get();
            actionLogs.set([
                {
                    id: tempId,
                    deviceId: device.get().id,
                    actionType: 'install',
                    status: 'in_progress',
                    initiatedBy: 'current_user',
                    initiatedAt: new Date().toISOString(),
                    message: 'Initiating app installation…',
                    metadata: {
                        app: {
                            resourceId: app.id,
                            resourceName: app.name,
                            packageName: app.packageName ?? null,
                            sizeBytes: app.size,
                            path: app.path,
                            version: app.version ?? null,
                            format: app.format ?? null
                        }
                    }
                },
                ...currentLogs
            ]);

            const response = await fetch(`/api/devices/${deviceId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'installApp',
                    packageName: app.packageName ?? 'unknown',
                    resourceId: app.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to install app: ${response.statusText}`);
            }

            const result = await response.json();
            const realLogId = result.data?.operationId;
            if (realLogId) {
                const logs = actionLogs.get();
                const logIndex = logs.findIndex(log => log.id === tempId);
                if (logIndex !== -1) {
                    logs[logIndex].id = realLogId;
                    actionLogs.set([...logs]);
                }
            }

            actionStatus.set({
                action: 'installApp',
                status: 'success',
                message: 'App installation initiated',
            });
            toast.success('App installation initiated');
            showInstallAppModal.set(false);
        } catch (error) {
            actionStatus.set({
                action: 'installApp',
                status: 'failed',
                message: error instanceof Error ? error.message : 'Failed to install app',
            });
            toast.error('Failed to install app');
            console.error('Error installing app:', error);
            
            const logs = actionLogs.get();
            const idx = logs.findIndex((l) => l.id === tempId);
            if (idx >= 0) {
                const existing = logs[idx];
                logs[idx] = {
                    ...existing,
                    status: 'failed',
                    message: existing.message || (error instanceof Error ? error.message : 'Failed to install app'),
                    completedAt: new Date().toISOString()
                };
                actionLogs.set([...logs]);
            }
            pendingInstallAppTempId.set(null);
        } finally {
            isLoading.set(false);
        }
    }

    async function openPullFileModal() {
        showPullFileModal.set(true);
        selectedPullFileId.set(selectedPullFile.get()?.id || null);
        pullFileDestinationPath.set('');
        await loadPullFileResources(1);
    }

    function onSelectPullFile(id: string) {
        selectedPullFileId.set(id);
        selectedPullFile.set(pullFileItems.get().find((it) => it.id === id) || null);
    }

    async function confirmPullFile() {
        const file = selectedPullFile.get();
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        if (!pullFileDestinationPath.get().trim()) {
            toast.error('Please enter destination path');
            return;
        }

        isLoading.set(true);
        try {
            actionStatus.set({
                action: 'pushFile',
                status: 'in_progress',
                message: 'Initiating file push...'
            });

            const response = await fetch(`/api/devices/${deviceId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'pushFile',
                    sourcePath: file.path,
                    destinationPath: pullFileDestinationPath.get().trim(),
                    resourceId: file.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to push file: ${response.statusText}`);
            }

            const result = await response.json();
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
            showPullFileModal.set(false);
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

    async function openPushFileModal() {
        showPushFileModal.set(true);
        pushFileSourcePath.set('');
        pushFileProgress.set(0);
        pushFileStatusMessage.set('');
    }

    async function confirmPushFile() {
        if (!pushFileSourcePath.get().trim()) {
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
            const response = await fetch(`/api/devices/${deviceId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'pullFile',
                    sourcePath: pushFileSourcePath.get().trim(),
                    destinationPath: pushFileSourcePath.get().trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to pull file: ${response.statusText}`);
            }

            const result = await response.json();
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
            showPushFileModal.set(false);
        } catch (error) {
            actionStatus.set({
                action: 'pullFile',
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to pull file',
            });
            toast.error('Failed to pull file');
            console.error('Error pulling file:', error);
            addActionLogRow('pullFile', 'Failed to pull file', 'failed');
        } finally {
            isLoading.set(false);
        }
    }

    // Action handlers
    function accessRemoteTerminal() {
        addActionLogRow('terminal', 'Opening terminal', 'initiated');
        goto(`${basePath}/iot/devices/${deviceId}/terminal`);
    }

    async function retrieveSnapshot() {
        await actionsService.retrieveSnapshot(
            { 
                data: { get: () => screenshotData.get(), set: (v: string | null) => screenshotData.set(v) },
                format: { get: () => screenshotFormat.get(), set: (v: string) => screenshotFormat.set(v) }
            },
            { get: () => screenshotOpen.get(), set: (v: boolean) => screenshotOpen.set(v) }
        );
    }

    async function restartDevice() {
        await actionsService.restartDevice();
    }

    async function rebootDevice() {
        await actionsService.rebootDevice();
    }

    async function viewLogs() {
        await actionsService.viewLogs();
    }

    function navigateToEdit() {
        goto(`${basePath}/iot/devices/${deviceId}/edit`);
    }

    // SSE handlers setup
    let unsubscribeDeviceRealtime: (() => void) | null = null;
    let sseHandlersCleanup: (() => void) | null = null;

    function setupSSEHandlers() {
        // Setup device detail events subscription
        unsubscribeDeviceRealtime = subscribeDeviceDetailEvents(
            deviceId,
            () => actionLogs.get(),
            (logs) => { actionLogs.set(logs); },
            actionStatus,
            sseStore
        );

        // Setup SSE event handlers
        const sseHandlers = useDeviceSSEHandlers(
            deviceId,
            device.get(),
            actionStatus,
            {
                onPullFileSuccess: async (payload) => {
                    // Update action log entry
                    if (payload.logId) {
                        const logIndex = actionLogs.get().findIndex(log => log.id === payload.logId);
                        if (logIndex >= 0) {
                            const updated = [...actionLogs.get()];
                            updated[logIndex] = {
                                ...updated[logIndex],
                                status: 'success',
                                message: "File uploaded and downloaded successfully"
                            };
                            actionLogs.set(updated);
                        }
                    }
                    showPullFileModal.set(false);
                    isLoading.set(false);
                },
                onPullFileFailed: (message) => {
                    // Update action log entry on failure
                    // Note: logId would need to be passed in the callback, but for now we'll rely on subscribeDeviceDetailEvents
                    showPullFileModal.set(false);
                    isLoading.set(false);
                },
                onPushFileProgress: (progress, message) => {
                    pushFileProgress.set(progress);
                    pushFileStatusMessage.set(message || pushFileStatusMessage.get());
                },
                onPushFileSuccess: () => {
                    showPushFileModal.set(false);
                    isLoading.set(false);
                },
                onPushFileFailed: () => {
                    showPushFileModal.set(false);
                    isLoading.set(false);
                },
                onPushFileData: (fileData, fileName) => {
                    downloadPushFile(fileData, fileName);
                    showPushFileModal.set(false);
                    isLoading.set(false);
                },
                onInstallAppSuccess: () => {
                    showInstallAppModal.set(false);
                    isLoading.set(false);
                },
                onInstallAppFailed: () => {
                    showInstallAppModal.set(false);
                    isLoading.set(false);
                },
                onGetLogsSuccess: async (payload) => {
                    // Update action log entry
                    if (payload.logId) {
                        const logIndex = actionLogs.get().findIndex(log => log.id === payload.logId);
                        if (logIndex >= 0) {
                            const updated = [...actionLogs.get()];
                            updated[logIndex] = {
                                ...updated[logIndex],
                                status: 'success',
                                message: "Logs uploaded and downloaded successfully"
                            };
                            actionLogs.set(updated);
                        }
                    }
                    isLoading.set(false);
                },
                onGetLogsFailed: (message) => {
                    isLoading.set(false);
                },
                onActionLogUpdate: (logId: string, status: 'success' | 'failed', message?: string) => {
                    updateTempActionLog(logId, status, message);
                },
                onDataUpdate: (updatedData) => {
                    if (updatedData.deviceInfo) {
                        deviceInformation.set(updatedData.deviceInfo);
                    }
                },
                onConnectionChange: (connected, connectedAt, disconnectedAt) => {
                    device.set({
                        ...device.get(),
                        connected: !!connected,
                        connectedAt: connected ? (connectedAt ?? device.get().connectedAt) : device.get().connectedAt,
                        disconnectedAt: !connected ? (disconnectedAt ?? device.get().disconnectedAt) : device.get().disconnectedAt
                    });
                }
            }
        );

        sseHandlers.init();
        sseHandlersCleanup = sseHandlers.cleanup;
    }

    function cleanup() {
        if (unsubscribeDeviceRealtime) {
            try { unsubscribeDeviceRealtime(); } catch {}
            unsubscribeDeviceRealtime = null;
        }
        if (sseHandlersCleanup) {
            try { sseHandlersCleanup(); } catch {}
            sseHandlersCleanup = null;
        }
    }

    return {
        // Resource loading
        loadFirmwareResources,
        loadInstallAppResources,
        loadPullFileResources,
        
        // Modal handlers
        openFirmwareModal,
        onSelectFirmware,
        confirmFirmwareUpdate,
        openInstallAppModal,
        onSelectInstallApp,
        confirmInstallApp,
        openPullFileModal,
        onSelectPullFile,
        confirmPullFile,
        openPushFileModal,
        confirmPushFile,
        
        // Action handlers
        accessRemoteTerminal,
        retrieveSnapshot,
        restartDevice,
        rebootDevice,
        viewLogs,
        navigateToEdit,
        
        // Helpers
        addActionLogRow,
        updateTempActionLog,
        downloadPushFile,
        
        // Setup/cleanup
        setupSSEHandlers,
        cleanup
    };
}

