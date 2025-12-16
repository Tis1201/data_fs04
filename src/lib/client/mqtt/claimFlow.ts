import { browser } from '$app/environment';
import { mqttStore } from '$lib/stores/mqtt-store';
import { decodeNotificationJwtPayload } from './notificationUtils';

interface ClaimConfirmation {
  deviceId: string;
  factoryDeviceId?: string;
  accountId?: string | null;
}

interface WaitForClaimOptions {
  timeoutMs?: number;
}

export async function waitForClaimConfirmation(
  flowId: string,
  options: WaitForClaimOptions = {}
): Promise<ClaimConfirmation> {
  if (!browser) {
    throw new Error('MQTT claim confirmation is only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 15000;

  if (mqttStore.status !== 'OPEN') {
    await mqttStore.connect();
  }

  const sub = mqttStore.subject;
  if (!sub) {
    throw new Error('MQTT subject not available; user MQTT not connected');
  }

  const notificationsTopic = `user/${sub}/notifications`;

  return new Promise<ClaimConfirmation>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error(`Timed out waiting for claim confirmation (flowId=${flowId})`));
    }, timeoutMs);

    const unsubscribe = mqttStore.on(notificationsTopic, (message) => {
      const payload = message.payload as any;
      const ticket = payload?.ticket;
      if (!ticket || typeof ticket !== 'string') return;

      const claims = decodeNotificationJwtPayload(ticket);
      if (!claims) return;

      const notifFlowId = claims.flowId as string | undefined;
      const type = claims.type as string | undefined;
      const params = (claims.params ?? {}) as {
        deviceId?: string;
        factoryDeviceId?: string;
        accountId?: string | null;
      };

      if (!notifFlowId || notifFlowId !== flowId) return;

      // For claim confirmation we expect a reply:claim type
      if (!type || !type.startsWith('reply:')) return;

      const deviceId = params.deviceId;
      if (!deviceId) return;

      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();

      resolve({
        deviceId,
        factoryDeviceId: params.factoryDeviceId,
        accountId: params.accountId
      });
    });
  });
}
