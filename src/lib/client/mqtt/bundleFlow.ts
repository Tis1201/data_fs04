/**
 * Bundle MQTT Flow
 * 
 * Client-side MQTT helpers for bundle wave status updates and device bundle progress.
 * Replaces SSE-based bundle realtime communication.
 */

import { mqttClient } from './mqttClient';

export interface BundleWaveUpdate {
    action?: string;
    bundleId: string;
    waveId: string;
    status: string;
    progress?: number;
    devicesTotal?: number;
    devicesCompleted?: number;
    devicesFailed?: number;
    endTime?: string;
    timestamp?: string;
}

export interface DeviceBundleStatus {
    action?: string;
    deviceId: string;
    bundleId?: string;
    waveId: string;
    status: string;
    progress?: number;
    timestamp?: string;
}

/**
 * Subscribe to bundle wave status updates via MQTT
 * Listens for real-time wave progress, completion, and failure notifications
 * 
 * @param bundleId - Bundle ID to filter updates for
 * @param onWaveUpdate - Callback function to handle wave updates
 * @returns Cleanup function to unsubscribe
 */
export function subscribeBundleWave(
    bundleId: string,
    onWaveUpdate: (payload: BundleWaveUpdate) => void
): () => void {
    console.log('[Bundle MQTT] Subscribing to bundle wave updates', { bundleId });

    // Listen for bundle:waveStatus notifications
    const unsubscribe = mqttClient.onNotification('bundle:waveStatus', (payload: any) => {
        console.log('[Bundle MQTT] Received wave status update', { payload });

        // Filter by bundleId
        if (payload.bundleId === bundleId && payload.waveId) {
            console.log('[Bundle MQTT] Processing wave update for bundle', { bundleId, waveId: payload.waveId });
            onWaveUpdate(payload as BundleWaveUpdate);
        }
    });

    return () => {
        console.log('[Bundle MQTT] Unsubscribing from bundle wave updates', { bundleId });
        unsubscribe();
    };
}

/**
 * Subscribe to device bundle status updates via MQTT
 * Listens for device-specific bundle installation progress
 * 
 * @param deviceId - Device ID to filter updates for
 * @param onStatusUpdate - Callback function to handle status updates
 * @returns Cleanup function to unsubscribe
 */
export function subscribeDeviceBundleStatus(
    deviceId: string,
    onStatusUpdate: (payload: DeviceBundleStatus) => void
): () => void {
    console.log('[Bundle MQTT] Subscribing to device bundle status', { deviceId });

    const unsubscribe = mqttClient.onNotification('device:bundleStatus', (payload: any) => {
        console.log('[Bundle MQTT] Received device bundle status', { payload });

        // Filter by deviceId
        if (payload.deviceId === deviceId) {
            console.log('[Bundle MQTT] Processing bundle status for device', { deviceId });
            onStatusUpdate(payload as DeviceBundleStatus);
        }
    });

    return () => {
        console.log('[Bundle MQTT] Unsubscribing from device bundle status', { deviceId });
        unsubscribe();
    };
}

/**
 * Subscribe to all bundle updates (wave status + device status)
 * Useful for bundle detail pages that need both types of updates
 * 
 * @param bundleId - Bundle ID to filter updates for
 * @param onUpdate - Callback function to handle all updates
 * @returns Cleanup function to unsubscribe
 */
export function subscribeBundleUpdates(
    bundleId: string,
    onUpdate: (payload: BundleWaveUpdate | DeviceBundleStatus) => void
): () => void {
    console.log('[Bundle MQTT] Subscribing to all bundle updates', { bundleId });

    const unsubWave = subscribeBundleWave(bundleId, onUpdate);
    
    // Also listen for device bundle status updates that match this bundle
    const unsubDevice = mqttClient.onNotification('device:bundleStatus', (payload: any) => {
        if (payload.bundleId === bundleId) {
            console.log('[Bundle MQTT] Processing device status for bundle', { bundleId, deviceId: payload.deviceId });
            onUpdate(payload as DeviceBundleStatus);
        }
    });

    return () => {
        console.log('[Bundle MQTT] Unsubscribing from all bundle updates', { bundleId });
        unsubWave();
        unsubDevice();
    };
}

