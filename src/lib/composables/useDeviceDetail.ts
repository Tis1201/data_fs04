import { writable, type Writable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { subscribeActionLogUpdates } from '$lib/client/mqtt/handlers/data/actionLogHandler';
import { createModalHandler } from '$lib/client/mqtt/handlers/ui/modalHandler';
import { createProgressBarHandler } from '$lib/client/mqtt/handlers/ui/progressBarHandler';
import { DeviceActionsService } from '$lib/services/deviceActionsService';
import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { isRefreshAction } from '$lib/constants/device';
import {
    updateFirmware as mqttUpdateFirmware,
    installApp as mqttInstallApp,
    pushFile as mqttPushFile,
    pullFile as mqttPullFile
} from '$lib/client/mqtt/deviceActions';
import { ActionLogSyncManager } from '$lib/client/sync/ActionLogSyncManager';

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
    /** Called when a device:statusUpdate indicates success for an action that should reload device/apps (per AUTO_REFRESH_PLAN) */
    onRefreshActionsSuccess?: (payload: any) => void;
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
        onRefreshActionsSuccess
    } = options;

    const MAX_ACTION_LOGS = 15;

    function sortActionLogs(logs: any[]): any[] {
        return [...logs].sort((a, b) => {
            // Sort by initiatedAt timestamp descending (newest first)
            return new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime();
        });
    }

    function addActionLogRow(actionType: string, message: string, status: 'initiated' | 'in_progress' | 'success' | 'failed' = 'initiated', logId?: string) {
        if (!logId) {
            throw new Error('logId is required - cannot create temp logs');
        }
        const currentLogs = actionLogs.get();
        const newLogs = [
            {
                id: logId,
                deviceId: device.get().id,
                actionType,
                status,
                progress: null,
                initiatedBy: 'current_user',
                initiatedAt: new Date().toISOString(),
                completedAt: null,
                durationMs: null,
                message,
                user: null
            },
            ...currentLogs
        ];
        actionLogs.set(sortActionLogs(newLogs).slice(0, MAX_ACTION_LOGS));
        return logId;
    }

    function updateTempActionLog(tempId: string | null, status: 'success' | 'failed', message?: string, durationMs?: number | null) {
        if (!tempId) return;
        const currentLogs = actionLogs.get();
        const idx = currentLogs.findIndex((l) => l.id === tempId);
        if (idx >= 0) {
            const existing = currentLogs[idx];
            currentLogs[idx] = {
                ...existing,
                status,
                message: message ?? existing.message,
                completedAt: new Date().toISOString(),
                durationMs: durationMs !== undefined && durationMs !== null ? durationMs : (existing.durationMs ?? null)
            };
            actionLogs.set(sortActionLogs(currentLogs));
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

        isLoading.set(true);

        try {
            actionStatus.set({
                action: 'firmware',
                status: 'in_progress',
                message: 'Initiating firmware update...'
            });

            const result = await mqttUpdateFirmware(
                {
                    deviceId: device.get().id,
                    firmwareVersion: fw.version ?? '1.0.0',
                    resourceId: fw.id
                },
                { timeoutMs: 60000 }
            );

            if (result.operationId) {
                const currentLogs = actionLogs.get();
                const newLogs = [
                    {
                        id: result.operationId,
                        deviceId: device.get().id,
                        actionType: 'firmware_update',
                        status: 'initiated',
                        progress: null,
                        initiatedBy: 'current_user',
                        initiatedAt: new Date().toISOString(),
                        completedAt: null,
                        durationMs: null,
                        message: 'Initiating firmware update…',
                        user: null
                    },
                    ...currentLogs
                ];
                actionLogs.set(sortActionLogs(newLogs).slice(0, MAX_ACTION_LOGS));
            }

            actionStatus.set({
                action: 'firmware',
                status: 'success',
                message: result.message || 'Firmware update initiated',
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

        isLoading.set(true);
        
        try {
            actionStatus.set({
                action: 'installApp',
                status: 'in_progress',
                message: 'Initiating app installation...'
            });

            const result = await mqttInstallApp(
                {
                    deviceId: device.get().id,
                    packageName: app.packageName ?? 'unknown',
                    resourceId: app.id
                },
                { timeoutMs: 60000 }
            );

            if (result.operationId) {
                const currentLogs = actionLogs.get();
                const newLog = {
                    id: result.operationId,
                    deviceId: device.get().id,
                    actionType: 'install_app',
                    status: 'initiated',
                    progress: null,
                    initiatedBy: 'current_user',
                    initiatedAt: new Date().toISOString(),
                    completedAt: null,
                    durationMs: null,
                    message: 'Initiating app installation…',
                    user: null,
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
                };
                
                actionLogs.set(sortActionLogs([newLog, ...currentLogs]).slice(0, MAX_ACTION_LOGS));
            } else {
                console.warn('[useDeviceDetail] No operationId in RPC response', { result });
            }

            actionStatus.set({
                action: 'installApp',
                status: 'success',
                message: result.message || 'App installation initiated',
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

            const result = await mqttPushFile(
                {
                    deviceId: device.get().id,
                    sourcePath: file.path,
                    destinationPath: pullFileDestinationPath.get().trim(),
                    resourceId: file.id
                },
                { timeoutMs: 60000 }
            );

            if (result.operationId) {
                addActionLogRow('pushFile', 'File push initiated…', 'in_progress', result.operationId);
            }

            actionStatus.set({
                action: 'pushFile',
                status: 'success',
                message: result.message || 'File push initiated',
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
            const result = await mqttPullFile(
                {
                    deviceId: device.get().id,
                    sourcePath: pushFileSourcePath.get().trim(),
                    destinationPath: pushFileSourcePath.get().trim()
                },
                { timeoutMs: 60000 }
            );

            if (result.operationId) {
                addActionLogRow('pullFile', 'File pull initiated…', 'in_progress', result.operationId);
            }

            actionStatus.set({
                action: 'pullFile',
                status: 'success',
                message: result.message || 'File pull initiated',
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
            console.error('[useDeviceDetail] Error pulling file', { deviceId, error });
        } finally {
            isLoading.set(false);
        }
    }

    // Action handlers
    function accessRemoteTerminal() {
        const currentDevice = device.get();
        if (!currentDevice?.connected) {
            toast.error('Device is offline');
            return;
        }
        const terminalLogId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        addActionLogRow('terminal', 'Opening terminal', 'initiated', terminalLogId);
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
        const currentDevice = device.get();
        if (!currentDevice?.connected) {
            toast.error('Device is offline');
            return;
        }
        await actionsService.viewLogs();
    }

    function navigateToEdit() {
        goto(`${basePath}/iot/devices/${deviceId}/edit`);
    }

    // MQTT handlers setup
    let unsubscribeDeviceRealtime: (() => void) | null = null;
    let mqttUnsubscribes: (() => void)[] = [];
    let actionLogSyncManager: ActionLogSyncManager | null = null;

    function setupMQTTHandlers() {
        try {
            actionLogSyncManager = new ActionLogSyncManager(
                deviceId,
                () => actionLogs.get(),
                (logs) => { actionLogs.set(sortActionLogs(logs)); }
            );
            console.log('[useDeviceDetail] ActionLogSyncManager initialized', { deviceId });
        } catch (error) {
            console.error('[useDeviceDetail] Failed to initialize ActionLogSyncManager', { deviceId, error });
        }

        unsubscribeDeviceRealtime = subscribeActionLogUpdates(
            deviceId,
            () => actionLogs.get(),
            (logs) => { actionLogs.set(logs); },
            actionStatus
        );

        const modalHandler = createModalHandler({
            deviceId,
            showPullFileModal,
            showPushFileModal,
            showInstallAppModal,
            isLoading
        });

        const progressBarHandler = createProgressBarHandler({
            deviceId,
            pushFileProgress,
            pushFileStatusMessage
        });

        const statusHandler = (payload: any) => {
            modalHandler(payload);
            const isSuccess = payload?.status === 'success' || payload?.status === 'complete';
            if (isSuccess && onRefreshActionsSuccess && isRefreshAction(payload?.action)) {
                onRefreshActionsSuccess(payload);
            }
        };

        const statusUnsub = mqttClient.onNotification('device:statusUpdate', statusHandler);
        const progressUnsub = mqttClient.onNotification('device:progressUpdate', progressBarHandler);

        mqttUnsubscribes.push(statusUnsub, progressUnsub);
    }

    function cleanup() {
        if (actionLogSyncManager) {
            try {
                actionLogSyncManager.cleanup();
            } catch (error) {
                console.error('[useDeviceDetail] Error cleaning up ActionLogSyncManager', { deviceId, error });
            }
            actionLogSyncManager = null;
        }

        if (unsubscribeDeviceRealtime) {
            try { unsubscribeDeviceRealtime(); } catch {}
            unsubscribeDeviceRealtime = null;
        }
        mqttUnsubscribes.forEach(unsub => {
            try { unsub(); } catch {}
        });
        mqttUnsubscribes = [];
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
        setupMQTTHandlers: setupMQTTHandlers,
        cleanup
    };
}

