// src/lib/stores/device-subscription.ts
// Simplified device subscription management using account/admin level subscriptions

import { sseStore } from '$lib/stores/sse-store';

/**
 * Subscribe to device updates based on user role and context.
 * 
 * This replaces per-device subscriptions with account-level or admin-level subscriptions,
 * making it scalable for large device lists (100k+).
 * 
 * @param userRole - User's system role (e.g., 'SUPER_ADMIN', 'ADMIN', 'MEMBER')
 * @param accountId - Optional account ID for account-level subscription
 * @returns Promise<boolean> - true if subscription succeeded
 */
export async function subscribeToDeviceUpdates(
  userRole: string,
  accountId?: string | null
): Promise<boolean> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DeviceSubscription] 🚀 Starting subscription process');
  console.log('[DeviceSubscription] Parameters:', { userRole, accountId });
  
  try {
    // Get SSE connection ID
    const connId = sseStore.connectionId;
    console.log('[DeviceSubscription] Current connectionId:', connId);
    console.log('[DeviceSubscription] SSE store state:', {
      connectionId: sseStore.connectionId,
      isConnected: sseStore.isConnected
    });
    
    if (!connId) {
      console.warn('[DeviceSubscription] ⏳ No SSE connection ID available, waiting for connection...');
      
      // Wait for connection to be established
      return new Promise((resolve) => {
        console.log('[DeviceSubscription] Setting up listener for "connected" event');
        const unsubOnce = sseStore.on('connected', async (m: any) => {
          try { unsubOnce(); } catch {}
          console.log('[DeviceSubscription] 📡 "connected" event received:', m);
          const id = m?.data?.connectionId || m?.connectionId || null;
          console.log('[DeviceSubscription] Extracted connectionId from event:', id);
          
          if (!id) {
            console.error('[DeviceSubscription] ❌ No connectionId in connected event');
            resolve(false);
            return;
          }
          
          console.log('[DeviceSubscription] Retrying subscription with connectionId:', id);
          const result = await subscribeToDeviceUpdates(userRole, accountId);
          resolve(result);
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          console.error('[DeviceSubscription] ❌ Timeout waiting for SSE connection');
          resolve(false);
        }, 10000);
      });
    }
    
    // Determine subscription endpoint based on user role
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
    console.log('[DeviceSubscription] Role check:', { userRole, isAdmin });
    
    if (isAdmin) {
      // Admin users: subscribe to ALL devices
      console.log('[DeviceSubscription] 👑 Admin user detected - subscribing to ALL devices');
      console.log('[DeviceSubscription] Making POST request to /api/sse/subscribe/admin/devices');
      console.log('[DeviceSubscription] Request body:', { connectionId: connId });
      
      const response = await fetch('/api/sse/subscribe/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ connectionId: connId })
      });
      
      console.log('[DeviceSubscription] Response status:', response.status);
      console.log('[DeviceSubscription] Response ok:', response.ok);
      
      const result = await response.json();
      console.log('[DeviceSubscription] Response body:', result);
      
      if (result.success) {
        console.log('[DeviceSubscription] ✅ Successfully subscribed to admin devices channel');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return true;
      } else {
        console.error('[DeviceSubscription] ❌ Failed to subscribe to admin devices:', result.error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return false;
      }
    } else if (accountId) {
      // Regular users: subscribe to their account's devices
      console.log(`[DeviceSubscription] 👤 Regular user - subscribing to account ${accountId} devices`);
      console.log(`[DeviceSubscription] Making POST request to /api/sse/subscribe/account/${accountId}/devices`);
      console.log('[DeviceSubscription] Request body:', { connectionId: connId });
      
      const response = await fetch(`/api/sse/subscribe/account/${accountId}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ connectionId: connId })
      });
      
      console.log('[DeviceSubscription] Response status:', response.status);
      console.log('[DeviceSubscription] Response ok:', response.ok);
      
      const result = await response.json();
      console.log('[DeviceSubscription] Response body:', result);
      
      if (result.success) {
        console.log(`[DeviceSubscription] ✅ Successfully subscribed to account ${accountId} devices`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return true;
      } else {
        console.error('[DeviceSubscription] ❌ Failed to subscribe to account devices:', result.error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return false;
      }
    } else {
      console.warn('[DeviceSubscription] ⚠️  No accountId provided for non-admin user');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return false;
    }
  } catch (error) {
    console.error('[DeviceSubscription] ❌ Subscription error:', error);
    console.error('[DeviceSubscription] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return false;
  }
}

/**
 * Handle device connection/disconnection events from SSE.
 * 
 * @param records - Array of device records to update
 * @param deviceId - ID of the device that changed status
 * @param connected - New connection status
 * @returns Updated device records array
 */
export function updateDeviceStatus<T extends { id: string; connected?: boolean }>(
  records: T[],
  deviceId: string,
  connected: boolean
): T[] {
  return records.map((record) =>
    record.id === deviceId
      ? { ...record, connected }
      : record
  );
}

