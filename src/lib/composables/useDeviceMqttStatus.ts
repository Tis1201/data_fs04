import { browser } from '$app/environment';
import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { onDestroy } from 'svelte';

export interface DeviceStatusUpdate {
  type: 'device:connection' | 'device:disconnection';
  deviceId: string;
  deviceName?: string;
  connected: boolean;
  timestamp: string;
  reason?: string;
  accountId?: string | null;
  userId?: string | null;
}

/**
 * Composable for subscribing to device status updates via MQTT
 * 
 * Usage:
 * ```ts
 * const { subscribe } = useDeviceMqttStatus();
 * 
 * onMount(() => {
 *   const unsubscribe = subscribe((update) => {
 *     if (update.deviceId === myDeviceId) {
 *       device.connected = update.connected;
 *     }
 *   });
 *   return unsubscribe;
 * });
 * ```
 */
export function useDeviceMqttStatus() {
  let unsubscribeFn: (() => void) | null = null;

  function subscribe(callback: (update: DeviceStatusUpdate) => void): () => void {
    if (!browser) {
      return () => {};
    }

    // Subscribe to MQTT notifications for device status updates
    unsubscribeFn = mqttClient.onNotification('device:connection', (payload: any) => {
      handleStatusUpdate(payload, callback);
    });

    const unsubscribeDisconnect = mqttClient.onNotification('device:disconnection', (payload: any) => {
      handleStatusUpdate(payload, callback);
    });

    // Return combined unsubscribe function
    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
        unsubscribeFn = null;
      }
      unsubscribeDisconnect();
    };
  }

  function handleStatusUpdate(payload: any, callback: (update: DeviceStatusUpdate) => void) {
    try {
      const update: DeviceStatusUpdate = {
        type: payload.type || (payload.connected ? 'device:connection' : 'device:disconnection'),
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        connected: payload.connected,
        timestamp: payload.timestamp,
        reason: payload.reason,
        accountId: payload.accountId,
        userId: payload.userId
      };

      callback(update);
    } catch (err) {
      console.error('[useDeviceMqttStatus] Failed to handle status update:', err);
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    if (unsubscribeFn) {
      unsubscribeFn();
      unsubscribeFn = null;
    }
  });

  return {
    subscribe
  };
}

