import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { logger } from '$lib/server/logger';
import { registerMqttTransport } from '$lib/server/mqtt/core/transport';
import { registerDeviceHandlers } from '$lib/server/mqtt/handlers/device';
import { registerWebHandlers } from '$lib/server/mqtt/handlers/web';
import { subscribeToQueue } from '$lib/server/mqtt/core/queue';
import { sendNotificationWithTicket } from '$lib/server/mqtt/core/publish';
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
  logger.info('[MQTT Transport] Worker starting up...');
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

      const payloadStr = typeof payload === 'string' ? payload : payload.toString();
      logger.info(`[MQTT Transport] Publishing message to ${topic} (qos=${options.qos ?? 0}, payloadLength=${payloadStr.length}, connected=${client.connected})`);
      
      if (!client.connected) {
        const err = new Error(`MQTT client not connected. connected=${client.connected}`);
        logger.error(`[MQTT Transport] Cannot publish: ${err.message}`);
        throw err;
      }

      await new Promise<void>((resolve, reject) => {
        client!.publish(topic, payload, options, (err) => {
          if (err) {
            logger.error(`[MQTT Transport] Failed to publish on ${topic}: ${err.message}`);
            reject(err);
            return;
          }
          logger.info(`[MQTT Transport] Published message on ${topic} (qos=${options.qos ?? 0}, payloadLength=${payloadStr.length}) - publish callback called`);
          resolve();
        });
      });
    }
  });

  (async () => {
    await connectWorkerClient();

    // Subscribe to Redis queue for cross-process MQTT notifications
    logger.info('[MQTT Transport] Setting up Redis queue subscription...');
    await subscribeToQueue(async (notification) => {
      try {
        logger.info(`[MQTT Queue] Processing notification: type=${notification.type}, recipient=${notification.recipient}`);
        
        // Send the queued notification via MQTT
        await sendNotificationWithTicket({
          prisma: adminPrisma,
          sub: notification.sub,
          recipient: notification.recipient,
          type: notification.type,
          flowId: notification.flowId,
          params: notification.params,
          expiresIn: notification.expiresIn
        });
        
        logger.debug(`[MQTT Queue] Successfully sent notification: type=${notification.type}`);
      } catch (error) {
        logger.error(`[MQTT Queue] Failed to send notification: ${String(error)}`);
      }
    });
    logger.info('[MQTT Transport] Redis queue subscription active');

    // Reconcile device presence after a short delay to ensure MQTT transport is ready
    setTimeout(async () => {
      try {
        logger.info('[MQTT Transport] Starting device presence reconciliation...');
        const { reconcileDevicePresence } = await import('$lib/server/mqtt/utils/reconciliation');
        await reconcileDevicePresence();
        logger.info('[MQTT Transport] Device presence reconciliation completed');
      } catch (err) {
        logger.error(
          `[MQTT Transport] Device presence reconciliation failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }, 5000); // Wait 5 seconds for MQTT transport to be fully ready

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
