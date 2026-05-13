import { mqttClient } from '$lib/client/mqtt/mqttClient';

export type WaveStatusPayload = {
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
};

/**
 * Subscribe to bundle wave status updates via MQTT
 * 
 * @param bundleId - Bundle ID to filter updates for
 * @param onWaveUpdate - Callback function to handle wave updates
 * @returns Cleanup function to unsubscribe
 */
export function subscribeBundleWave(bundleId: string, onWaveUpdate: (payload: WaveStatusPayload) => void) {
  console.log('[BundleRealtime] subscribeBundleWave called for bundleId:', bundleId);
  
  // Subscribe to MQTT notifications
  const unsubscribe = mqttClient.onNotification('bundle:waveStatus', (payload: any) => {
    console.log('[BundleRealtime] bundle:waveStatus received:', payload);
    
    // Filter by bundleId
    if (payload.bundleId === bundleId && payload.waveId) {
      console.log('[BundleRealtime] Matched bundleId, calling onWaveUpdate with payload:', payload);
      try {
        onWaveUpdate(payload as WaveStatusPayload);
        console.log('[BundleRealtime] onWaveUpdate completed successfully');
      } catch (e) {
        console.error('[BundleRealtime] Error in onWaveUpdate callback:', e);
      }
    } else {
      console.log('[BundleRealtime] Notification ignored - bundleId mismatch or missing waveId', {
        expectedBundleId: bundleId,
        receivedBundleId: payload.bundleId,
        waveId: payload.waveId
      });
    }
  });

  return () => {
    console.log('[BundleRealtime] Cleaning up subscriptions for bundle:', bundleId);
    unsubscribe();
    console.log('[BundleRealtime] Cleanup completed');
  };
}


