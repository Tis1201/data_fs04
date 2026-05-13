import { browser } from '$app/environment';
import { mqttStore } from '$lib/stores/mqtt-store';

interface RpcCallOptions {
  timeoutMs?: number;
}

export async function callUserRpc<T = any>(
  op: string,
  params: Record<string, any>,
  options: RpcCallOptions = {}
): Promise<T> {
  if (!browser) {
    throw new Error('MQTT RPC is only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 5000;

  // Best-effort ensure connection; AuthStateHandler should already manage this
  if (mqttStore.status !== 'OPEN') {
    await mqttStore.connect();
  }

  const sub = mqttStore.subject;
  if (!sub) {
    throw new Error('MQTT subject not available; user MQTT not connected');
  }

  const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req_${Math.random().toString(36).slice(2, 10)}`;

  const requestTopic = `user/${sub}/requests`;
  const responseFilter = `user/${sub}/response`;

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error(`MQTT RPC ${op} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const unsubscribe = mqttStore.on(responseFilter, (message) => {
      const data = message.payload as any;
      if (!data || data.requestId !== requestId) return;

      if (settled) return;
      settled = true;

      clearTimeout(timer);
      unsubscribe();

      if (data.error) {
        reject(new Error(String(data.error)));
        return;
      }

      resolve(data.result as T);
    });

    mqttStore
      .publish(requestTopic, {
        requestId,
        op,
        params,
        timestamp: new Date().toISOString()
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        reject(err);
      });
  });
}
