import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { browser } from '$app/environment';
import { onDestroy } from 'svelte';

export interface UseDeviceAppMqttOptions {
    deviceId: string;
    onAppActionUpdate: (data: { type: string; payload: any }) => void;
}

/**
 * Composable for handling MQTT notifications related to device app actions.
 * Extracts MQTT handler logic from DeviceAppList component.
 * 
 * Handles:
 * - device:statusUpdate (for app install/uninstall/restart actions)
 * - device:progressUpdate (for app action progress)
 */
export function useDeviceAppMqtt(options: UseDeviceAppMqttOptions) {
    const { deviceId, onAppActionUpdate } = options;
    let mqttUnsubscribes: (() => void)[] = [];

    function setup() {
        if (!browser) {
            console.warn('[useDeviceAppMqtt] Not in browser, MQTT updates disabled');
            return;
        }

        console.log('[useDeviceAppMqtt] Setting up MQTT subscriptions for device:', deviceId);

        // Subscribe to device action status updates
        const statusUnsub = mqttClient.onNotification('device:statusUpdate', (payload: any) => {
            if (payload.deviceId !== deviceId) return;
            
            try {
                console.log('[useDeviceAppMqtt] Received statusUpdate:', payload);
                onAppActionUpdate({
                    type: 'device:statusUpdate',
                    payload: payload
                });
            } catch (err) {
                console.error('[useDeviceAppMqtt] Failed to handle statusUpdate:', err);
            }
        });
        mqttUnsubscribes.push(statusUnsub);

        // Subscribe to device action progress updates
        const progressUnsub = mqttClient.onNotification('device:progressUpdate', (payload: any) => {
            if (payload.deviceId !== deviceId) return;
            
            try {
                console.log('[useDeviceAppMqtt] Received progressUpdate:', payload);
                onAppActionUpdate({
                    type: 'device:progressUpdate',
                    payload: payload
                });
            } catch (err) {
                console.error('[useDeviceAppMqtt] Failed to handle progressUpdate:', err);
            }
        });
        mqttUnsubscribes.push(progressUnsub);
    }

    function cleanup() {
        mqttUnsubscribes.forEach(unsub => {
            try { unsub(); } catch {}
        });
        mqttUnsubscribes = [];
    }

    onDestroy(() => {
        cleanup();
    });

    return {
        setup,
        cleanup
    };
}

