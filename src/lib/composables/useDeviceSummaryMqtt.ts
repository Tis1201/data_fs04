import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { browser } from '$app/environment';
import { onDestroy } from 'svelte';

export interface UseDeviceSummaryMqttOptions {
    deviceId: string;
    onAppChange: () => void;
}

/**
 * Composable for handling MQTT notifications related to device app summary updates.
 * Extracts MQTT handler logic from DeviceAppSummary component.
 * 
 * Handles:
 * - device:statusUpdate (for app install/uninstall actions only)
 * 
 * Triggers summary reload when apps are installed or uninstalled.
 */
export function useDeviceSummaryMqtt(options: UseDeviceSummaryMqttOptions) {
    const { deviceId, onAppChange } = options;
    let mqttUnsubscribe: (() => void) | null = null;

    function setup() {
        if (!browser) {
            console.warn('[useDeviceSummaryMqtt] Not in browser, MQTT updates disabled');
            return;
        }

        console.log('[useDeviceSummaryMqtt] Setting up MQTT subscription for device:', deviceId);

        // Subscribe to device status updates that indicate app changes
        mqttUnsubscribe = mqttClient.onNotification('device:statusUpdate', (payload: any) => {
            if (payload.deviceId === deviceId && 
                (payload.action === 'install' || payload.action === 'uninstall')) {
                console.log('[useDeviceSummaryMqtt] App install/uninstall detected, reloading summary');
                onAppChange();
            }
        });
    }

    function cleanup() {
        if (mqttUnsubscribe) {
            mqttUnsubscribe();
            mqttUnsubscribe = null;
        }
    }

    onDestroy(() => {
        cleanup();
    });

    return {
        setup,
        cleanup
    };
}

