import { toast } from 'svelte-sonner';
import type { Writable } from 'svelte/store';
import { callUserRpc } from '$lib/client/mqtt/userRpc';
import { waitForScreenshotResult } from '$lib/client/mqtt/screenshotFlow';
import {
    refreshDevice as mqttRefreshDevice,
    rebootDevice as mqttRebootDevice,
    getDeviceLogs as mqttGetDeviceLogs
} from '$lib/client/mqtt/deviceActions';

export interface DeviceActionCallbacks {
    onSuccess?: (action: string, message?: string) => void;
    onError?: (action: string, error: Error | string) => void;
    onProgress?: (action: string, progress: number, message?: string) => void;
    addActionLog?: (actionType: string, message: string, status: 'initiated' | 'in_progress' | 'success' | 'failed', logId?: string) => string;
    updateActionLog?: (tempId: string | null, status: 'success' | 'failed', message?: string, durationMs?: number | null) => void;
}

/**
 * Service for handling device actions
 * Centralizes all device action API calls and error handling
 */
export class DeviceActionsService {
    constructor(
        private deviceId: string,
        private isLoading: Writable<boolean>,
        private actionStatus: Writable<{ action: string; status: string; message: string }>,
        private callbacks: DeviceActionCallbacks = {}
    ) {}

    /**
     * Helper function to execute RPC action and create log with real operationId
     * This ensures we never create temp logs - always wait for server response
     */
    private async executeActionWithLog<T extends { operationId?: string }>(
        actionType: string,
        actionLabel: string,
        rpcCall: () => Promise<T>,
        initMessage: string,
        successMessage: string
    ): Promise<{ result: T; operationId: string | undefined }> {
        // Make RPC call FIRST to get real operationId
        const result = await rpcCall();

        // Create log with REAL ID from server response
        const operationId = result.operationId;
        if (operationId && this.callbacks.addActionLog) {
            this.callbacks.addActionLog(actionType, initMessage, 'in_progress', operationId);
        }

        return { result, operationId };
    }

    /**
     * Retrieve snapshot/screenshot from device via MQTT
     */
    async retrieveSnapshot(
        screenshotData: { 
            data: { get: () => string | null; set: (value: string | null) => void };
            format: { get: () => string; set: (value: string) => void };
        },
        screenshotOpen: { get: () => boolean; set: (value: boolean) => void }
    ): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: "snapshot",
            status: "loading",
            message: "Taking screenshot...",
        });
        
        let operationId: string | undefined;

        try {
            // Make RPC call FIRST to get real operationId
            const rpcResult = await callUserRpc<{
                flowId?: string;
                result: { deviceId: string; objectPath: string; operationId: string };
            }>(
                'device.screenshot',
                { deviceId: this.deviceId },
                { timeoutMs: 60000 }
            );

            // Create log with REAL ID from server response
            operationId = rpcResult?.result?.operationId;
            if (operationId && this.callbacks.addActionLog) {
                this.callbacks.addActionLog('snapshot', 'Taking screenshot…', 'in_progress', operationId);
            }

            const flowId = rpcResult?.flowId;
            if (!flowId) {
                throw new Error('Missing flowId in screenshot response');
            }

            const screenshot = await waitForScreenshotResult(flowId, this.deviceId, { timeoutMs: 60000 });

            if (screenshot.data) {
                screenshotData.data.set(screenshot.data);
                screenshotData.format.set(screenshot.format || 'jpeg');
                screenshotOpen.set(true);

                this.actionStatus.set({ action: "snapshot", status: "success", message: "Screenshot captured" });
                toast.success("Device screenshot captured successfully");
                if (operationId && this.callbacks.updateActionLog) {
                    this.callbacks.updateActionLog(operationId, 'success', 'Screenshot captured');
                }
            } else {
                throw new Error("No image data received from device");
            }
        } catch (error) {
            this.actionStatus.set({
                action: "snapshot",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to capture screenshot"
            });
            toast.error("Failed to capture device screenshot");
            console.error("Error capturing screenshot via MQTT:", error);
            if (operationId && this.callbacks.updateActionLog) {
                // Extract durationMs from error if available (from device.screenshot notification)
                const durationMs = (error as any)?.durationMs;
                this.callbacks.updateActionLog(
                    operationId, 
                    'failed', 
                    error instanceof Error ? error.message : 'Failed to capture screenshot',
                    durationMs
                );
            }
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Restart/refresh device via MQTT
     */
    async restartDevice(): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: "refresh",
            status: "loading",
            message: "Sending refresh command...",
        });

        let operationId: string | undefined;

        try {
            const { result, operationId: opId } = await this.executeActionWithLog(
                'refresh',
                'Refresh',
                () => mqttRefreshDevice({ deviceId: this.deviceId }, { timeoutMs: 30000 }),
                'Refresh initiated…',
                'Refresh command sent'
            );
            operationId = opId;

            this.actionStatus.set({
                action: "refresh",
                status: "success",
                message: result.message || "Refresh command sent",
            });
            toast.success("Device refresh initiated");
        } catch (error) {
            this.actionStatus.set({
                action: "refresh",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to refresh device",
            });
            toast.error("Failed to refresh device");
            console.error("Error refreshing device:", error);
            if (operationId && this.callbacks.updateActionLog) {
                this.callbacks.updateActionLog(operationId, 'failed', error instanceof Error ? error.message : 'Failed to refresh device');
            }
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Reboot device via MQTT
     */
    async rebootDevice(): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: "reboot",
            status: "loading",
            message: "Sending reboot command...",
        });

        let operationId: string | undefined;

        try {
            const { result, operationId: opId } = await this.executeActionWithLog(
                'reboot',
                'Reboot',
                () => mqttRebootDevice({ deviceId: this.deviceId }, { timeoutMs: 30000 }),
                'Reboot initiated…',
                'Reboot command sent'
            );
            operationId = opId;

            this.actionStatus.set({
                action: "reboot",
                status: "success",
                message: result.message || "Reboot command sent",
            });
            toast.success("Device reboot initiated");
        } catch (error) {
            this.actionStatus.set({
                action: "reboot",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to reboot device",
            });
            toast.error("Failed to reboot device");
            console.error("Error rebooting device:", error);
            if (operationId && this.callbacks.updateActionLog) {
                this.callbacks.updateActionLog(operationId, 'failed', error instanceof Error ? error.message : 'Failed to reboot device');
            }
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * View/download device logs via MQTT
     */
    async viewLogs(): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: "logs",
            status: "in_progress",
            message: "Requesting logs from device...",
        });

        let operationId: string | undefined;

        try {
            const { result, operationId: opId } = await this.executeActionWithLog(
                'getLogs',
                'Get Logs',
                () => mqttGetDeviceLogs({ deviceId: this.deviceId, format: 'zip' }, { timeoutMs: 60000 }),
                'Logs request initiated…',
                'Logs request initiated'
            );
            operationId = opId;

            this.actionStatus.set({
                action: "logs",
                status: "success",
                message: result.message || "Logs request initiated",
            });
            toast.success("Logs request initiated");
        } catch (error) {
            this.actionStatus.set({
                action: "logs",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to get logs",
            });
            toast.error("Failed to get device logs");
            console.error('Error getting logs:', error);
            if (operationId && this.callbacks.updateActionLog) {
                this.callbacks.updateActionLog(operationId, 'failed', error instanceof Error ? error.message : 'Failed to get logs');
            }
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Update firmware
     */
    async updateFirmware(firmware: { version: string; id: string }): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: 'firmware',
            status: 'loading',
            message: 'Initiating firmware update...'
        });

        try {
            // Make API call FIRST to get real operationId
            const response = await fetch(`/api/devices/${this.deviceId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'updateFirmware',
                    firmwareVersion: firmware.version ?? '1.0.0',
                    resourceId: firmware.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to update firmware: ${response.statusText}`);
            }

            const result = await response.json();
            const realLogId = result.data?.operationId;
            
            // ✅ Create log with real ID from server response
            if (realLogId && this.callbacks.addActionLog) {
                this.callbacks.addActionLog('firmware_update', 'Initiating firmware update…', 'initiated', realLogId);
            }

            this.actionStatus.set({
                action: 'firmware',
                status: 'success',
                message: 'Firmware update initiated',
            });
            toast.success('Firmware update initiated');
        } catch (error) {
            this.actionStatus.set({
                action: 'firmware',
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to update firmware',
            });
            toast.error('Failed to update firmware');
            console.error('Error updating firmware:', error);
            // Note: No log entry created on error - operationId not available
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Install app
     */
    async installApp(app: { id: string; packageName?: string }): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: 'installApp',
            status: 'in_progress',
            message: 'Initiating app installation...'
        });

        try {
            // Make API call FIRST to get real operationId
            const response = await fetch(`/api/devices/${this.deviceId}/actions`, {
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
            
            // ✅ Create log with real ID from server response
            if (realLogId && this.callbacks.addActionLog) {
                this.callbacks.addActionLog('install', 'Initiating app installation…', 'initiated', realLogId);
            }

            this.actionStatus.set({
                action: 'installApp',
                status: 'success',
                message: 'App installation initiated',
            });
            toast.success('App installation initiated');
        } catch (error) {
            this.actionStatus.set({
                action: 'installApp',
                status: 'failed',
                message: error instanceof Error ? error.message : 'Failed to install app',
            });
            toast.error('Failed to install app');
            console.error('Error installing app:', error);
            // Note: No log entry created on error - operationId not available
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Pull file from device
     */
    async pullFile(sourcePath: string, destinationPath?: string, resourceId?: string): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: 'pullFile',
            status: 'in_progress',
            message: 'Initiating file pull...'
        });

        try {
            const response = await fetch(`/api/devices/${this.deviceId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'pullFile',
                    sourcePath: sourcePath.trim(),
                    destinationPath: destinationPath || sourcePath.trim(),
                    ...(resourceId ? { resourceId } : {})
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to pull file: ${response.statusText}`);
            }

            const result = await response.json();
            const realLogId = result.data?.operationId;
            if (realLogId) {
                this.callbacks.addActionLog?.('pullFile', 'File pull initiated…', 'in_progress', realLogId);
            }

            this.actionStatus.set({
                action: 'pullFile',
                status: 'success',
                message: 'File pull initiated',
            });
            toast.success('File pull initiated');
        } catch (error) {
            this.actionStatus.set({
                action: 'pullFile',
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to pull file',
            });
            toast.error('Failed to pull file');
            console.error('Error pulling file:', error);
            this.callbacks.addActionLog?.('pullFile', 'Failed to pull file', 'failed');
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Push file to device
     */
    async pushFile(sourcePath: string, destinationPath: string, resourceId?: string): Promise<void> {
        this.isLoading.set(true);
        this.actionStatus.set({
            action: 'pushFile',
            status: 'in_progress',
            message: 'Initiating file push...'
        });

        try {
            const response = await fetch(`/api/devices/${this.deviceId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: JSON.stringify({
                    action: 'pushFile',
                    sourcePath: sourcePath.trim(),
                    destinationPath: destinationPath.trim(),
                    ...(resourceId ? { resourceId } : {})
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to push file: ${response.statusText}`);
            }

            const result = await response.json();
            const realLogId = result.data?.operationId;
            if (realLogId) {
                this.callbacks.addActionLog?.('pushFile', 'File push initiated…', 'in_progress', realLogId);
            }

            this.actionStatus.set({
                action: 'pushFile',
                status: 'success',
                message: 'File push initiated',
            });
            toast.success('File push initiated');
        } catch (error) {
            this.actionStatus.set({
                action: 'pushFile',
                status: 'failed',
                message: error instanceof Error ? error.message : 'Failed to push file',
            });
            toast.error('Failed to push file');
            console.error('Error pushing file:', error);
            this.callbacks.addActionLog?.('pushFile', 'Failed to push file', 'failed');
        } finally {
            this.isLoading.set(false);
        }
    }
}

