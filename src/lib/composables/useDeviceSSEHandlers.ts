import { toast } from 'svelte-sonner';
import { sseStore } from '$lib/stores/sse-store';
import type { Writable } from 'svelte/store';

export interface DeviceSSEHandlersCallbacks {
    onPullFileSuccess?: (payload: { logId: string; objectPath: string }) => Promise<void>;
    onPullFileProgress?: (progress: number, message?: string) => void;
    onPullFileFailed?: (message: string) => void;
    onGetLogsSuccess?: (payload: { logId: string; objectPath: string }) => Promise<void>;
    onGetLogsProgress?: (progress: number, message?: string) => void;
    onGetLogsFailed?: (message: string) => void;
    onPushFileProgress?: (progress: number, message?: string) => void;
    onPushFileSuccess?: () => void;
    onPushFileFailed?: (message: string) => void;
    onPushFileData?: (fileData: string, fileName: string) => void;
    onInstallAppSuccess?: () => void;
    onInstallAppFailed?: (message: string) => void;
    onDataUpdate?: (updatedData: any) => void;
    onConnectionChange?: (connected: boolean, connectedAt?: string, disconnectedAt?: string) => void;
    onActionLogUpdate?: (logId: string, status: 'success' | 'failed', message?: string) => void;
}

/**
 * Composable for handling device SSE events
 * Extracts all SSE event handling logic from device detail pages
 */
export function useDeviceSSEHandlers(
    deviceId: string,
    device: { id: string; connected: boolean; connectedAt?: string | null; disconnectedAt?: string | null },
    actionStatus: Writable<{ action: string; status: string; message: string }>,
    callbacks: DeviceSSEHandlersCallbacks = {}
) {
    let unsubscribeHandlers: (() => void) | null = null;

    /**
     * Extract filename from object path
     */
    function extractFileNameFromPath(objectPath: string): string {
        const parts = objectPath.split('/');
        return parts[parts.length - 1] || 'file';
    }

    /**
     * Handle get logs download and cleanup (same as pullFile)
     */
    async function handleGetLogsDownload(logId: string, objectPath: string) {
        try {
            const downloadResponse = await fetch(
                `/api/devices/${deviceId}/pull-file-download-url?logId=${logId}`,
                { 
                    credentials: 'include',
                    method: 'GET'
                }
            );
            
            if (!downloadResponse.ok) {
                throw new Error('Failed to get download URL');
            }
            
            const data = await downloadResponse.json();
            const downloadUrl = data.downloadUrl;
            const fileName = data.fileName || extractFileNameFromPath(objectPath);
            const finalObjectPath = data.objectPath || objectPath;
            
            // Trigger browser download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Note: File cleanup is handled by scheduled cronjob, not immediately after download
            
            actionStatus.set({
                action: "logs",
                status: "success",
                message: "Logs downloaded successfully"
            });
            toast.success(`Logs downloaded: ${fileName}`);
            
            await callbacks.onGetLogsSuccess?.({ logId, objectPath });
        } catch (error) {
            actionStatus.set({
                action: "logs",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to download logs"
            });
            toast.error("Failed to download logs");
        }
    }

    /**
     * Handle pull file download and cleanup
     */
    async function handlePullFileDownload(logId: string, objectPath: string) {
        try {
            const downloadResponse = await fetch(
                `/api/devices/${deviceId}/pull-file-download-url?logId=${logId}`,
                { 
                    credentials: 'include',
                    method: 'GET'
                }
            );
            
            if (!downloadResponse.ok) {
                throw new Error('Failed to get download URL');
            }
            
            const data = await downloadResponse.json();
            const downloadUrl = data.downloadUrl;
            const fileName = data.fileName || extractFileNameFromPath(objectPath);
            const finalObjectPath = data.objectPath || objectPath;
            
            // Trigger browser download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Note: File cleanup is handled by scheduled cronjob, not immediately after download
            
            actionStatus.set({
                action: "pullFile",
                status: "success",
                message: "File downloaded successfully"
            });
            toast.success(`File downloaded: ${fileName}`);
            
            await callbacks.onPullFileSuccess?.({ logId, objectPath });
        } catch (error) {
            actionStatus.set({
                action: "pullFile",
                status: "error",
                message: error instanceof Error ? error.message : "Failed to download file"
            });
            toast.error("Failed to download file");
        }
    }

    /**
     * Setup SSE event handlers
     */
    function setupHandlers() {
        // Connection status handler
        const connectionUnsubscribe = sseStore.on('*', (msg: any) => {
            try {
                const evt = msg?.data ?? msg;
                const evtType = evt?.type || msg?.event || evt?.payload?.type;
                
                // Handle data updates
                if (evtType === 'device:dataUpdate') {
                    const updatedData = evt.payload?.updatedData;
                    if (updatedData && updatedData.deviceInfo) {
                        callbacks.onDataUpdate?.(updatedData);
                        toast.success('Device updated', {
                            description: `Updated after ${evt.payload.action}`,
                            duration: 2000
                        });
                    }
                }
                
                // Normalize connection/disconnection events
                let normalized;
                if (evt?.payload?.action === 'device:connection' || evt?.payload?.action === 'device:disconnection') {
                    normalized = { ...evt.payload, type: evt.payload.action };
                } else if (evt?.type === 'device:connection' || evt?.type === 'device:disconnection') {
                    normalized = {
                        type: evt.type,
                        deviceId: evt.payload?.deviceId,
                        connected: evt.payload?.connected,
                        connectedAt: evt.payload?.connectedAt,
                        disconnectedAt: evt.payload?.disconnectedAt,
                        timestamp: evt.payload?.timestamp,
                        reason: evt.payload?.reason
                    };
                } else {
                    normalized = evt;
                }

                const isConnectionEvent = (evtType === 'device:connection') || (normalized?.type === 'device:connection');
                const isDisconnectionEvent = (evtType === 'device:disconnection') || (normalized?.type === 'device:disconnection');
                
                if (!isConnectionEvent && !isDisconnectionEvent) {
                    return;
                }

                const c = normalized;
                const cDeviceId = c?.deviceId;
                
                if (!cDeviceId || cDeviceId !== deviceId) {
                    return;
                }

                const connected = c?.connected ?? false;
                const connectedAt = c?.connectedAt;
                const disconnectedAt = c?.disconnectedAt;
                
                callbacks.onConnectionChange?.(connected, connectedAt, disconnectedAt);
            } catch (e) {
                console.warn('[DeviceSSE] Error processing connection message:', e);
            }
        });

        // Status update handlers (pull file, push file, install app)
        const statusUnsubscribe = sseStore.on('*', (msg: any) => {
            try {
                const evt = msg?.data ?? msg;
                const evtType = evt?.type || msg?.event || evt?.payload?.type;
                
                // Handle push file status updates
                if (evtType === 'device:pushFileStatus' && evt?.payload?.deviceId === deviceId) {
                    const payload = evt.payload;
                    
                    if (payload.progress !== undefined) {
                        callbacks.onPushFileProgress?.(payload.progress, payload.message);
                    }
                    
                    if (payload.status === 'success') {
                        callbacks.onPushFileSuccess?.();
                    } else if (payload.status === 'failed') {
                        callbacks.onPushFileFailed?.(payload.message || "File push failed");
                    }
                }
                
                // Handle pull file status updates
                if (evtType === 'device:pullFileStatus' && evt?.payload?.deviceId === deviceId) {
                    const payload = evt.payload;
                    
                    // Handle failed status FIRST - before progress check
                    if (payload.status === 'failed') {
                        actionStatus.set({
                            action: "pullFile",
                            status: "error",
                            message: payload.message || "File upload failed"
                        });
                        toast.error(payload.message || "File upload failed");
                        callbacks.onPullFileFailed?.(payload.message || "File upload failed");
                        
                        // Update action logs table to show failure
                        if (payload.logId && callbacks.onActionLogUpdate) {
                            callbacks.onActionLogUpdate(payload.logId, 'failed', payload.message || "File upload failed");
                        }
                        return; // Don't process progress or success after failure
                    }
                    
                    // Handle success/complete status - trigger download if objectPath available
                    if (payload.status === 'success' || payload.status === 'complete') {
                        // If we have objectPath, trigger download
                        if (payload.objectPath) {
                            actionStatus.set({
                                action: "pullFile",
                                status: "loading",
                                message: "File uploaded successfully, preparing download..."
                            });
                            (async () => {
                                await handlePullFileDownload(payload.logId, payload.objectPath);
                            })();
                        } else {
                            // Success but no objectPath - mark as success anyway
                            // The download URL endpoint will fetch objectPath from the log
                            actionStatus.set({
                                action: "pullFile",
                                status: "loading",
                                message: "File uploaded successfully, preparing download..."
                            });
                            // Try to get objectPath from the action log and trigger download
                            (async () => {
                                try {
                                    const response = await fetch(`/api/devices/${deviceId}/pull-file-download-url?logId=${payload.logId}`, {
                                        credentials: 'include',
                                        method: 'GET'
                                    });
                                    if (response.ok) {
                                        const data = await response.json();
                                        if (data.objectPath) {
                                            await handlePullFileDownload(payload.logId, data.objectPath);
                                        } else {
                                            // No objectPath available, just mark as success
                                            actionStatus.set({
                                                action: "pullFile",
                                                status: "success",
                                                message: payload.message || "File uploaded successfully"
                                            });
                                            toast.success(payload.message || "File uploaded successfully");
                                            await callbacks.onPullFileSuccess?.({ logId: payload.logId, objectPath: '' });
                                        }
                                    } else {
                                        // Failed to get download URL, but upload was successful
                                        actionStatus.set({
                                            action: "pullFile",
                                            status: "success",
                                            message: payload.message || "File uploaded successfully"
                                        });
                                        toast.success(payload.message || "File uploaded successfully");
                                        await callbacks.onPullFileSuccess?.({ logId: payload.logId, objectPath: '' });
                                    }
                                } catch (error) {
                                    // Error getting download URL, but upload was successful
                                    actionStatus.set({
                                        action: "pullFile",
                                        status: "success",
                                        message: payload.message || "File uploaded successfully"
                                    });
                                    toast.success(payload.message || "File uploaded successfully");
                                    await callbacks.onPullFileSuccess?.({ logId: payload.logId, objectPath: '' });
                                }
                            })();
                        }
                        return; // Don't process progress after success
                    }
                    
                    // Update progress if provided (only if not success/failed)
                    if (payload.progress !== undefined) {
                        actionStatus.set({
                            action: "pullFile",
                            status: "loading",
                            message: `Uploading file... ${payload.progress}%`
                        });
                        callbacks.onPullFileProgress?.(payload.progress, payload.message);
                    }
                }
                
                // Handle get logs status updates (same flow as pullFile)
                if (evtType === 'device:getLogsStatus' && evt?.payload?.deviceId === deviceId) {
                    const payload = evt.payload;
                    
                    // Handle failed status FIRST - before progress check
                    if (payload.status === 'failed') {
                        actionStatus.set({
                            action: "logs",
                            status: "error",
                            message: payload.message || "Logs upload failed"
                        });
                        toast.error(payload.message || "Logs upload failed");
                        callbacks.onGetLogsFailed?.(payload.message || "Logs upload failed");
                        
                        // Update action logs table to show failure
                        if (payload.logId && callbacks.onActionLogUpdate) {
                            callbacks.onActionLogUpdate(payload.logId, 'failed', payload.message || "Logs upload failed");
                        }
                        return; // Don't process progress or success after failure
                    }
                    
                    // Handle success/complete status - trigger download if objectPath available
                    if (payload.status === 'success' || payload.status === 'complete') {
                        // If we have objectPath, trigger download
                        if (payload.objectPath) {
                            actionStatus.set({
                                action: "logs",
                                status: "loading",
                                message: "Logs uploaded successfully, preparing download..."
                            });
                            (async () => {
                                await handleGetLogsDownload(payload.logId, payload.objectPath);
                            })();
                        } else {
                            // Success but no objectPath - try to get it from the action log
                            actionStatus.set({
                                action: "logs",
                                status: "loading",
                                message: "Logs uploaded successfully, preparing download..."
                            });
                            (async () => {
                                try {
                                    const response = await fetch(`/api/devices/${deviceId}/pull-file-download-url?logId=${payload.logId}`, {
                                        credentials: 'include',
                                        method: 'GET'
                                    });
                                    if (response.ok) {
                                        const data = await response.json();
                                        if (data.objectPath) {
                                            await handleGetLogsDownload(payload.logId, data.objectPath);
                                        } else {
                                            actionStatus.set({
                                                action: "logs",
                                                status: "success",
                                                message: payload.message || "Logs uploaded successfully"
                                            });
                                            toast.success(payload.message || "Logs uploaded successfully");
                                            await callbacks.onGetLogsSuccess?.({ logId: payload.logId, objectPath: '' });
                                        }
                                    } else {
                                        actionStatus.set({
                                            action: "logs",
                                            status: "success",
                                            message: payload.message || "Logs uploaded successfully"
                                        });
                                        toast.success(payload.message || "Logs uploaded successfully");
                                        await callbacks.onGetLogsSuccess?.({ logId: payload.logId, objectPath: '' });
                                    }
                                } catch (error) {
                                    actionStatus.set({
                                        action: "logs",
                                        status: "success",
                                        message: payload.message || "Logs uploaded successfully"
                                    });
                                    toast.success(payload.message || "Logs uploaded successfully");
                                    await callbacks.onGetLogsSuccess?.({ logId: payload.logId, objectPath: '' });
                                }
                            })();
                        }
                        return; // Don't process progress after success
                    }
                    
                    // Update progress if provided (only if not success/failed)
                    if (payload.progress !== undefined) {
                        actionStatus.set({
                            action: "logs",
                            status: "loading",
                            message: `Uploading logs... ${payload.progress}%`
                        });
                        callbacks.onGetLogsProgress?.(payload.progress, payload.message);
                    }
                }
                
                // Handle install app status updates
                if (evtType === 'device:installAppStatus' && evt?.payload?.deviceId === deviceId) {
                    const payload = evt.payload;
                    
                    if (payload.status === 'success') {
                        callbacks.onInstallAppSuccess?.();
                    } else if (payload.status === 'failed') {
                        callbacks.onInstallAppFailed?.(payload.message || "App installation failed");
                    }
                }
                
                // Handle push file data (file download)
                if (evtType === 'device:pushFileData' && evt?.payload?.deviceId === deviceId) {
                    const payload = evt.payload;
                    
                    if (payload.fileData && payload.fileName) {
                        callbacks.onPushFileData?.(payload.fileData, payload.fileName);
                        
                        actionStatus.set({
                            action: "pushFile",
                            status: "success",
                            message: "File downloaded successfully",
                        });
                        toast.success(`File downloaded: ${payload.fileName}`);
                    }
                }
            } catch (e) {
                console.warn('[DeviceSSE] Error processing status message:', e);
            }
        });

        unsubscribeHandlers = () => {
            connectionUnsubscribe();
            statusUnsubscribe();
        };
    }

    /**
     * Initialize handlers
     */
    function init() {
        setupHandlers();
    }

    /**
     * Cleanup handlers
     */
    function cleanup() {
        if (unsubscribeHandlers) {
            unsubscribeHandlers();
            unsubscribeHandlers = null;
        }
    }

    return {
        init,
        cleanup
    };
}

