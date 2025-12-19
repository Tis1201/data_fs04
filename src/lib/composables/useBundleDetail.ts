/**
 * Bundle detail composable
 * Extracts state management, action handlers, and SSE logic for bundle detail pages
 * Shared across admin and user routes
 */

import { writable, get, type Writable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { invalidate } from '$app/navigation';
import { subscribeBundleWave } from '$lib/bundles/realtime';
import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { api_post, api_delete } from '$lib/utils/ApiUtils';
import { postV2, deleteV2 } from '$lib/utils/v2ApiHandler';
import { onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';

export interface UseBundleDetailOptions {
    bundleId: string;
    context: 'admin' | 'user';
    bundle: { get: () => any; set: (value: any) => void };
    bundleDevices: { get: () => any[] };
    selectedWave: { get: () => any | null; set: (value: any | null) => void };
    enableDeviceTracking?: boolean; // Admin only - real-time device connection tracking
    enableStopAllWaves?: boolean;   // Admin only - stopAllWaves action
}

export interface WaveStats {
    devicesTotal: number;
    devicesCompleted: number;
    devicesFailed: number;
    progress: number;
}

export interface DerivedWave {
    id: string;
    name: string;
    status: string;
    startTime?: string | null;
    endTime?: string | null;
    devicesTotal?: number | null;
    devicesCompleted?: number | null;
    devicesFailed?: number | null;
    progress?: number | null;
}

/**
 * Main composable for bundle detail pages
 */
export function useBundleDetail(options: UseBundleDetailOptions) {
    const {
        bundleId,
        context,
        bundle,
        bundleDevices,
        selectedWave,
        enableDeviceTracking = false,
        enableStopAllWaves = false
    } = options;

    // State management
    const showAppSelector = writable(false);
    const addingApp = writable(false);
    const activeTab = writable('info');
    const deviceStatusVersion = writable(0);
    const wavesVersion = writable(0);
    const deviceProgressReloadToken = writable(0);
    
    // Real-time device status tracking (admin only)
    const deviceConnectionStates = new Map<string, boolean>();
    
    // Wave stats management
    const waveStats: Record<string, WaveStats> = {};
    
    // SSE subscriptions
    let unsubscribeRealtime: (() => void) | null = null;
    let unsubscribeDeviceConnections: (() => void) | null = null;

    // Computed values
    const appsCount = writable(0);
    const wavesCount = writable(0);
    const onlineDevicesCount = writable(0);
    const offlineDevicesCount = writable(0);
    const totalDevicesCount = writable(0);
    const derivedWaves = writable<DerivedWave[]>([]);

    // Helper to update computed counts
    function updateComputedCounts() {
        const b = bundle.get();
        appsCount.set((b?.apps?.length) || 0);
        wavesCount.set((b?.waves?.length) || 0);
    }
    
    // Initial update
    updateComputedCounts();

    // Update device counts (reactive to deviceStatusVersion)
    deviceStatusVersion.subscribe(() => {
        const devices = bundleDevices.get();
        totalDevicesCount.set(devices?.length || 0);
        
        if (enableDeviceTracking && deviceConnectionStates.size > 0) {
            // Use real-time device states
            const online = Array.from(deviceConnectionStates.values()).filter(connected => connected).length;
            onlineDevicesCount.set(online);
        } else {
            // Use static device data
            const online = devices?.filter((d: any) => d.device?.connected)?.length || 0;
            onlineDevicesCount.set(online);
        }
        
        offlineDevicesCount.set(get(totalDevicesCount) - get(onlineDevicesCount));
    });

    // Helper to derive waves with real-time stats
    function updateDerivedWaves() {
        const b = bundle.get();
        const waves = (b?.waves || []) as any[];
        
        const derived = waves.map((w) => {
            const stats = waveStats[w.id] || {} as any;
            const devicesTotal = stats.devicesTotal ?? w.devicesTotal ?? 0;
            const devicesCompleted = stats.devicesCompleted ?? w.devicesCompleted ?? 0;
            const devicesFailed = stats.devicesFailed ?? w.devicesFailed ?? 0;
            const progress = stats.progress ?? (
                devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0
            );
            
            // Compute wave status based on real-time stats
            let computedStatus = w.status;
            if (devicesTotal > 0 && (devicesCompleted + devicesFailed) >= devicesTotal) {
                computedStatus = devicesFailed > 0 ? 'FAILED' : 'COMPLETED';
            } else if (devicesTotal > 0 && (devicesCompleted + devicesFailed) > 0) {
                computedStatus = 'IN_PROGRESS';
            }
            
            return {
                id: w.id,
                name: w.name,
                status: computedStatus,
                startTime: w.startTime ?? null,
                endTime: w.endTime ?? null,
                devicesTotal,
                devicesCompleted,
                devicesFailed,
                progress
            };
        });
        
        derivedWaves.set(derived);
    }
    
    // Update derived waves when wavesVersion changes
    wavesVersion.subscribe(() => {
        updateDerivedWaves();
    });
    
    // Initial update
    updateDerivedWaves();

    // Action handlers
    async function handleAppSelect(event: CustomEvent<{id: string; name: string; autoOpen: boolean}>) {
        const app = event.detail;
        if (!app) return;
        
        addingApp.set(true);
        
        try {
            const b = bundle.get();
            const nextOrder = b.apps.length > 0 
                ? Math.max(...b.apps.map((a: any) => a.order)) + 1 
                : 1;
                
            const apiPath = `/api/v2/bundles/${bundleId}/apps`;
                
            await api_post(apiPath, {
                resourceId: app.id,
                order: nextOrder,
                autoOpen: app.autoOpen
            });
            
            toast.success(`${app.name} added to bundle successfully`);
            await invalidate('app:bundle');
            showAppSelector.set(false);
        } catch (error) {
            toast.error("Failed to add app to bundle");
            console.error(error);
        } finally {
            addingApp.set(false);
        }
    }

    async function handleDeleteApp(appId: string) {
        try {
            const apiPath = `/api/v2/bundles/${bundleId}/apps/${appId}`;
                
            await api_delete(apiPath, appId);
            toast.success("App removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove app from bundle");
            console.error(error);
        }
    }

    async function handleDeleteBundle() {
        try {
            const apiPath = `/api/v2/bundles/${bundleId}`;
                
            await api_delete(apiPath, bundleId);
            toast.success("Bundle deleted successfully");
            const listPath = context === 'admin' ? '/admin/iot/bundles' : '/user/iot/bundles';
            goto(listPath);
        } catch (error) {
            toast.error("Failed to delete bundle");
            console.error(error);
        }
    }

    async function handleStopAllWaves() {
        if (!enableStopAllWaves) {
            toast.error("Stop all waves action not available");
            return;
        }
        
        try {
            const apiPath = `/api/v2/bundles/${bundleId}/stop-all-waves`;
            const response = await postV2(apiPath, {});
            toast.success(response.message || "All waves stopped successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to stop waves");
            console.error(error);
        }
    }

    // Setup MQTT subscriptions
    function setupMQTTSubscriptions() {
        const b = bundle.get();
        if (!b?.id) return;

        // Clean up previous subscription
        if (unsubscribeRealtime) {
            unsubscribeRealtime();
            unsubscribeRealtime = null;
        }

        // Subscribe to bundle wave updates via MQTT
        unsubscribeRealtime = subscribeBundleWave(b.id, (payload) => {
            const waveId = payload.waveId;
            const waveStatus = payload.status;
            const devicesTotal = payload.devicesTotal;
            const devicesCompleted = payload.devicesCompleted;
            const devicesFailed = payload.devicesFailed;
            const progress = payload.progress;
            
            if (waveId && (b?.waves || []).some((w: any) => w.id === waveId)) {
                // Update wave stats
                waveStats[waveId] = {
                    devicesTotal: devicesTotal ?? (waveStats[waveId]?.devicesTotal ?? 0),
                    devicesCompleted: devicesCompleted ?? (waveStats[waveId]?.devicesCompleted ?? 0),
                    devicesFailed: devicesFailed ?? (waveStats[waveId]?.devicesFailed ?? 0),
                    progress: progress ?? (waveStats[waveId]?.progress ?? 0)
                };
                
                wavesVersion.update(v => v + 1);
                updateDerivedWaves(); // Update derived waves immediately
                
                // Trigger device progress reload if this is the selected wave
                if (selectedWave.get()?.id === waveId) {
                    deviceProgressReloadToken.update(v => v + 1);
                }
                
                // Update wave status in bundle
                if (waveStatus) {
                    const currentBundle = bundle.get();
                    const waveIndex = (currentBundle?.waves || []).findIndex((w: any) => w.id === waveId);
                    if (waveIndex !== -1) {
                        bundle.set({
                            ...currentBundle,
                            waves: currentBundle.waves.map((w: any, idx: number) => 
                                idx === waveIndex ? { ...w, status: waveStatus } : w
                            )
                        });
                        updateComputedCounts(); // Update counts after bundle change
                    }
                }
            }
            
            invalidate('app:bundle');
        });

        // Setup device connection tracking (admin only)
        if (enableDeviceTracking) {
            setupDeviceConnectionTracking();
        }
    }

    // Setup device connection tracking (admin only)
    function setupDeviceConnectionTracking() {
        // Initialize device connection states from static data
        const devices = bundleDevices.get();
        if (devices) {
            devices.forEach((d: any) => {
                if (d.device?.id) {
                    deviceConnectionStates.set(d.device.id, !!d.device.connected);
                }
            });
            deviceStatusVersion.update(v => v + 1);
        }

        // Listen for device connection events via MQTT
        // Subscribe to both device:connection notifications
        const unsubConnection = mqttClient.onNotification('device:connection', (payload: any) => {
            const deviceId = payload.deviceId;
            const connected = payload.connected ?? true; // connection event means connected
            
            if (deviceId && deviceConnectionStates.has(deviceId)) {
                deviceConnectionStates.set(deviceId, connected);
                deviceStatusVersion.update(v => v + 1);
            }
        });

        // Subscribe to device:disconnection notifications
        const unsubDisconnection = mqttClient.onNotification('device:disconnection', (payload: any) => {
            const deviceId = payload.deviceId;
            
            if (deviceId && deviceConnectionStates.has(deviceId)) {
                deviceConnectionStates.set(deviceId, false);
                deviceStatusVersion.update(v => v + 1);
            }
        });

        // Store combined unsubscribe function
        unsubscribeDeviceConnections = () => {
            unsubConnection();
            unsubDisconnection();
        };
    }

    // Initialize on mount
    onMount(async () => {
        // MQTT client connects automatically via AuthStateHandler
        // No need to manually connect

        // Setup bundle wave subscriptions via MQTT
        setupMQTTSubscriptions();

        // Device connection tracking is now handled via MQTT notifications
        // No need for manual SSE subscriptions

        // Note: Bundle changes are handled reactively in the component
        // The component should call setupMQTTSubscriptions() when bundle.id changes
    });

    // Cleanup on destroy
    onDestroy(() => {
        if (unsubscribeRealtime) {
            try {
                unsubscribeRealtime();
            } catch (e) {
                console.error('Error cleaning up MQTT subscription:', e);
            }
            unsubscribeRealtime = null;
        }
        
        if (unsubscribeDeviceConnections) {
            try {
                unsubscribeDeviceConnections();
            } catch (e) {
                console.error('Error cleaning up device connection subscription:', e);
            }
            unsubscribeDeviceConnections = null;
        }
    });

    return {
        // State
        showAppSelector,
        addingApp,
        activeTab,
        deviceStatusVersion,
        wavesVersion,
        deviceProgressReloadToken,
        
        // Computed values
        appsCount,
        wavesCount,
        onlineDevicesCount,
        offlineDevicesCount,
        totalDevicesCount,
        derivedWaves,
        
        // Action handlers
        handleAppSelect,
        handleDeleteApp,
        handleDeleteBundle,
        handleStopAllWaves: enableStopAllWaves ? handleStopAllWaves : undefined,
        
        // Helper functions (for reactive updates in component)
        updateComputedCounts,
        updateDerivedWaves,
        setupMQTTSubscriptions
    };
}

