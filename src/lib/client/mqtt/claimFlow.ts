import { browser } from '$app/environment';
import { mqttClient } from './mqttClient';

interface ClaimConfirmation {
  deviceId: string;
  factoryDeviceId?: string;
  accountId?: string | null;
}

interface ClaimDeviceOptions {
  rpcTimeoutMs?: number;
  confirmTimeoutMs?: number;
}

/**
 * Claim a device by PIN using mqttClient (the primary MQTT connection).
 *
 * This uses mqttClient rather than mqttStore because mqttClient is already
 * connected and subscribed to user/.../notifications from login. This avoids
 * the race condition where a second connection (mqttStore) needs to establish
 * and subscribe before the server publishes the reply:claim notification.
 *
 * The notification listener is registered BEFORE the RPC is sent, so even if
 * the device confirms instantly, the reply:claim notification is captured.
 */
export async function claimDevice(
  pin: string,
  options: ClaimDeviceOptions = {}
): Promise<ClaimConfirmation> {
  if (!browser) {
    throw new Error('claimDevice is only available in the browser');
  }

  const rpcTimeoutMs = options.rpcTimeoutMs ?? 15000;
  const confirmTimeoutMs = options.confirmTimeoutMs ?? 20000;

  await mqttClient.connect();

  let settled = false;

  const cleanup = { unsub: null as (() => void) | null, timer: null as ReturnType<typeof setTimeout> | null };

  const settle = () => {
    settled = true;
    if (cleanup.timer) clearTimeout(cleanup.timer);
    if (cleanup.unsub) cleanup.unsub();
  };

  const confirmationPromise = new Promise<ClaimConfirmation>((resolve, reject) => {
    cleanup.timer = setTimeout(() => {
      if (settled) return;
      settle();
      reject(new Error('Timed out waiting for claim confirmation'));
    }, confirmTimeoutMs);

    // Register the listener BEFORE the RPC is sent.
    // mqttClient is already subscribed to user/.../notifications, so this
    // just adds an in-memory handler — no broker subscribe needed.
    cleanup.unsub = mqttClient.onNotification('reply:claim', (payload: any) => {
      if (settled) return;
      const deviceId = payload?.deviceId;
      if (!deviceId) return;

      settle();
      resolve({
        deviceId,
        factoryDeviceId: payload?.factoryDeviceId,
        accountId: payload?.accountId ?? null
      });
    });
  });

  // Send the claim RPC. If it fails, clean up the listener.
  try {
    await mqttClient.request('device.claim', { pin }, { timeoutMs: rpcTimeoutMs });
  } catch (err) {
    if (!settled) settle();
    throw err;
  }

  return confirmationPromise;
}
