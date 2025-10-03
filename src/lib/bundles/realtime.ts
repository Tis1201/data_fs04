import { sseStore } from '$lib/stores/sse-store';
import { getSseEndpoint } from '$lib/config/realtime';

export type WaveStatusPayload = {
  action?: string;
  waveId: string;
  status: string;
  progress?: number;
  devicesTotal?: number;
  devicesCompleted?: number;
  devicesFailed?: number;
  endTime?: string;
};

export function subscribeBundleWave(bundleId: string, onWaveUpdate: (payload: WaveStatusPayload) => void) {
  console.log('[BundleRealtime] subscribeBundleWave called for bundleId:', bundleId);
  console.log('[BundleRealtime] Current SSE connection status:', sseStore.connectionId ? 'connected' : 'not connected');
  
  try {
    const endpoint = getSseEndpoint();
    console.log('[BundleRealtime] Connecting to SSE endpoint:', endpoint);
    sseStore.connect(endpoint, { withCredentials: true });
  } catch (e) {
    console.warn('[BundleRealtime] Failed to connect to SSE:', e);
  }

  let unsubConnected: (() => void) | null = null;
  let unsubWave: (() => void) | null = null;
  let subscribed = false;

  async function subscribeNow(connId: string) {
    if (subscribed) {
      console.log('[BundleRealtime] Already subscribed to bundle:', bundleId);
      return;
    }
    try {
      console.log('[BundleRealtime] Subscribing to bundle channel with connectionId:', connId);
      const response = await fetch(`/api/sse/subscribe/bundle/${bundleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ connectionId: connId })
      });
      
      if (response.ok) {
        console.log('[BundleRealtime] Successfully subscribed to bundle:', bundleId);
        subscribed = true;
      } else {
        console.warn('[BundleRealtime] Failed to subscribe to bundle:', response.status, response.statusText);
      }
    } catch (e) {
      console.error('[BundleRealtime] Error subscribing to bundle:', e);
    }
  }

  const existingConnId = sseStore.connectionId;
  if (existingConnId) {
    console.log('[BundleRealtime] Using existing connectionId:', existingConnId);
    subscribeNow(existingConnId);
  } else {
    console.log('[BundleRealtime] No existing connection, waiting for connected event');
  }

  unsubConnected = sseStore.on('connected', (msg: any) => {
    const connId = msg?.data?.connectionId;
    console.log('[BundleRealtime] SSE connected event received, connectionId:', connId);
    if (connId) subscribeNow(connId);
  });

  unsubWave = sseStore.on('bundle:waveStatus', (msg: any) => {
    console.log('[BundleRealtime] bundle:waveStatus event received:', msg);
    const payload = msg?.data?.payload || msg?.data;
    console.log('[BundleRealtime] Extracted payload:', payload);
    
    if (!payload || payload?.waveId == null) {
      console.log('[BundleRealtime] Invalid payload, skipping:', { payload, hasWaveId: !!payload?.waveId });
      return;
    }
    
    console.log('[BundleRealtime] Calling onWaveUpdate with payload:', payload);
    try { 
      onWaveUpdate(payload as WaveStatusPayload); 
      console.log('[BundleRealtime] onWaveUpdate completed successfully');
    } catch (e) {
      console.error('[BundleRealtime] Error in onWaveUpdate callback:', e);
    }
  });

  return () => {
    console.log('[BundleRealtime] Cleaning up subscriptions for bundle:', bundleId);
    try { unsubConnected && unsubConnected(); } catch (e) { console.warn('[BundleRealtime] Error unsubscribing from connected:', e); }
    try { unsubWave && unsubWave(); } catch (e) { console.warn('[BundleRealtime] Error unsubscribing from wave:', e); }
    subscribed = false; // Reset subscription flag for next call
    console.log('[BundleRealtime] Cleanup completed');
  };
}


