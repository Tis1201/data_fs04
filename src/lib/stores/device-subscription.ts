// src/lib/stores/device-subscription.ts
// Device subscription management - now handled automatically via MQTT

/**
 * Subscribe to device updates based on user role and context.
 * 
 * @deprecated Device subscriptions are now handled automatically via MQTT.
 * MQTT client automatically receives device notifications based on user permissions.
 * This function is kept for backward compatibility but is a no-op.
 * 
 * @param userRole - User's system role (e.g., 'SUPER_ADMIN', 'ADMIN', 'MEMBER')
 * @param accountId - Optional account ID for account-level subscription
 * @returns Promise<boolean> - Always returns true (MQTT handles subscriptions automatically)
 */
export async function subscribeToDeviceUpdates(
  userRole: string,
  accountId?: string | null
): Promise<boolean> {
  // Device subscriptions are now handled automatically via MQTT
  // MQTT client receives device notifications based on user permissions
  // No manual subscription needed
  console.log('[DeviceSubscription] Device subscriptions handled automatically via MQTT', {
    userRole,
    accountId
  });
  return true;
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

