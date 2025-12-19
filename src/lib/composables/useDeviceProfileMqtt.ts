import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import { onDestroy } from 'svelte';

export interface UseDeviceProfileMqttOptions {
    profileId: string;
    onStatusUpdate: () => void;
    onProgressUpdate: () => void;
    onProfileUpdate: (payload: any) => void;
}

/**
 * Composable for handling MQTT notifications related to device profile operations.
 * Extracts MQTT handler logic from DeviceAssignmentManager component.
 * 
 * Handles:
 * - device:statusUpdate (for profile apply status - filters by action === 'applyProfile')
 * - device:progressUpdate (for profile apply progress - filters by action === 'applyProfile')
 * - device:profileUpdate (for profile auto-reapply notifications)
 */
export function useDeviceProfileMqtt(options: UseDeviceProfileMqttOptions) {
    const { profileId, onStatusUpdate, onProgressUpdate, onProfileUpdate } = options;
    let mqttUnsubscribes: (() => void)[] = [];

    function setup() {
        if (!browser) {
            console.warn('[useDeviceProfileMqtt] Not in browser, MQTT updates disabled');
            return;
        }

        console.log('[useDeviceProfileMqtt] Setting up MQTT listeners for profile:', profileId);

        // Listen for device:statusUpdate notifications (profile apply status)
        const statusUnsub = mqttClient.onNotification('device:statusUpdate', (payload: any) => {
            const messageProfileId = payload?.profileId;
            const messageAction = payload?.action;
            const status = payload?.status;

            console.log('[useDeviceProfileMqtt] Received statusUpdate:', { messageProfileId, messageAction, status, profileId });

            if (messageAction === 'applyProfile' && messageProfileId === profileId) {
                // Refresh assigned devices to show updated status
                console.log('[useDeviceProfileMqtt] Profile apply status update, refreshing devices');
                onStatusUpdate();

                // Show toast for completion
                if (status === 'complete' || status === 'success') {
                    toast.success('Profile Applied', {
                        description: 'Profile settings have been applied to the device'
                    });
                } else if (status === 'failed' || status === 'error') {
                    toast.error('Profile Application Failed', {
                        description: payload?.message || 'Failed to apply profile to device'
                    });
                }
            }
        });
        mqttUnsubscribes.push(statusUnsub);

        // Listen for device:progressUpdate notifications (profile apply progress)
        const progressUnsub = mqttClient.onNotification('device:progressUpdate', (payload: any) => {
            const messageProfileId = payload?.profileId;
            const messageAction = payload?.action;
            const progress = payload?.progress;

            console.log('[useDeviceProfileMqtt] Received progressUpdate:', { messageProfileId, messageAction, progress, profileId });

            if (messageAction === 'applyProfile' && messageProfileId === profileId) {
                // Refresh assigned devices to show applying status
                onProgressUpdate();
            }
        });
        mqttUnsubscribes.push(progressUnsub);

        // Listen for profile-specific notifications (auto-reapply)
        const profileUnsub = mqttClient.onNotification('device:profileUpdate', (payload: any) => {
            const messageProfileId = payload?.profileId;
            const messageAction = payload?.action;
            const isAutoReapply = payload?.autoReapply;

            console.log('[useDeviceProfileMqtt] Received profileUpdate:', { messageProfileId, messageAction, isAutoReapply, profileId });

            if (messageAction === 'applyProfile' && messageProfileId === profileId) {
                // Refresh assigned devices to show updated status
                onProfileUpdate(payload);

                // Show toast notification for auto-reapply
                if (isAutoReapply) {
                    const deviceCount = payload?.deviceCount || 0;
                    toast.success('Profile Updated', {
                        description: `Reapplying to ${deviceCount} assigned devices`
                    });
                }
            }
        });
        mqttUnsubscribes.push(profileUnsub);
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

