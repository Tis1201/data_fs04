import { browser } from '$app/environment';
import { mqttStore } from '$lib/stores/mqtt-store';
import { decodeNotificationJwtPayload } from './notificationUtils';

interface WaitForFlowOptions {
  timeoutMs?: number;
}

interface ScreenshotResult {
  data: string;
  format?: string;
  width?: number;
  height?: number;
}

export async function waitForScreenshotResult(
  flowId: string,
  options: WaitForFlowOptions = {}
): Promise<ScreenshotResult> {
  if (!browser) {
    throw new Error('MQTT screenshot flow is only available in the browser');
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

  return new Promise<ScreenshotResult>((resolve, reject) => {
    let settled = false;

    console.log('[MQTT ScreenshotFlow] Waiting for screenshot result', {
      flowId,
      notificationsTopic,
      timeoutMs
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      console.warn('[MQTT ScreenshotFlow] Timeout waiting for screenshot result', {
        flowId,
        timeoutMs
      });
      reject(new Error(`Timed out waiting for screenshot result (flowId=${flowId})`));
    }, timeoutMs);

    const unsubscribe = mqttStore.on(notificationsTopic, (message) => {
      const payload = message.payload as any;
      const ticket = payload?.ticket;
      if (!ticket || typeof ticket !== 'string') {
        console.log('[MQTT ScreenshotFlow] Notification without ticket, ignoring', {
          flowId,
          notificationsTopic,
          rawPayload: payload
        });
        return;
      }

      const claims = decodeNotificationJwtPayload(ticket);
      if (!claims) {
        console.log('[MQTT ScreenshotFlow] Failed to decode screenshot ticket, ignoring', {
          flowId,
          notificationsTopic
        });
        return;
      }

      const notifFlowId = claims.flowId as string | undefined;
      const type = claims.type as string | undefined;
      const params = (claims.params ?? {}) as {
        data?: string;
        format?: string;
        width?: number;
        height?: number;
      };

      console.log('[MQTT ScreenshotFlow] Decoded screenshot notification', {
        expectedFlowId: flowId,
        notifFlowId,
        type,
        hasData: typeof params.data === 'string',
        dataLength: typeof params.data === 'string' ? params.data.length : 0,
        format: params.format,
        width: params.width,
        height: params.height
      });

      if (!notifFlowId || notifFlowId !== flowId) {
        return;
      }

      if (!type || type !== 'device.screenshot') {
        return;
      }

      const data = params.data;
      if (!data) return;

      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();

      console.log('[MQTT ScreenshotFlow] Resolving screenshot result', {
        flowId,
        format: params.format,
        width: params.width,
        height: params.height,
        dataLength: typeof data === 'string' ? data.length : 0
      });

      resolve({
        data,
        format: params.format,
        width: params.width,
        height: params.height
      });
    });
  });
}
