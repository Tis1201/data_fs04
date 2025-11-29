import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { logger } from '../lib/server/logger';
import { registerMqttTransport } from '../lib/server/mqtt/core/transport';
import { registerDeviceHandlers } from '../lib/server/mqtt/handlers/device';
import { registerWebHandlers } from '../lib/server/mqtt/handlers/web';
import {
  client,
  connectWorkerClient,
  started,
  setStarted,
  setClient,
  adminPrisma,
  publishMqttMessage as clientPublishMqttMessage
} from './iot_client';

// Re-export for compatibility if needed, though usually index.ts is the entry point
export { publishMqttMessage } from './iot_client';

registerDeviceHandlers(adminPrisma);
registerWebHandlers(adminPrisma);

const brokerUrl = process.env.MQTT_BROKER_URL;

export function startMqttListener(): void {
  if (started) {
    logger.info('[MQTT Transport] Service already running');
    return;
  }

  if (!brokerUrl) {
    logger.warn('[MQTT Transport] Missing MQTT_WORKER_URL or MQTT_BROKER_URL, service not started');
    return;
  }

  setStarted(true);

  registerMqttTransport({
    publish: async (topic, payload, options = {}) => {
      if (!client) {
        throw new Error('MQTT transport is not connected. Ensure startMqttTransport() has run.');
      }

      await new Promise<void>((resolve, reject) => {
        client!.publish(topic, payload, options, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }
  });

  (async () => {
    await connectWorkerClient();

    const shutdown = (signal: NodeJS.Signals) => {
      logger.info(`[MQTT Transport] Caught ${signal}, shutting down service`);
      client?.end(false, {}, () => {
        setStarted(false);
        setClient(null);
        // Note: reconnectTimer cleanup is internal to iot_client, 
        // we might need to expose a stop/shutdown method there if we want to be clean.
        // For now, setting client to null and started to false should be enough 
        // as scheduleReconnect checks them.
      });
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  })().catch((err) => {
    logger.error(
      `[MQTT Transport] Failed to start worker MQTT listener: ${err instanceof Error ? err.message : String(err)
      }`
    );
  });
}

export function startMqttTransport(): void {
  startMqttListener();
}

if (process.argv[1]) {
  const entryHref = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryHref) {
    startMqttTransport();
  }
}
