import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { logger } from '$lib/server/logger';
import { registerMqttTransport } from '$lib/server/mqtt/core/transport';
import { registerDeviceHandlers } from '$lib/server/mqtt/handlers/device';
import { registerWebHandlers } from '$lib/server/mqtt/handlers/web';
import { subscribeToQueue, ACTION_LOG_BROADCAST_TYPE } from '$lib/server/mqtt/core/queue';
import { sendNotificationWithTicket } from '$lib/server/mqtt/core/publish';
import { ActionLogEventBroadcaster } from '$lib/server/mqtt/broadcasters/actionLogEventBroadcaster';
import {
  client,
  connectWorkerClient,
  started,
  setStarted,
  setClient,
  adminPrisma,
  publishMqttMessage as clientPublishMqttMessage,
  triggerReconnect
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

            // Detect expired JWT / auth failure and trigger reconnect with fresh credentials
            if (err.message?.toLowerCase().includes('not authorized')) {
              logger.warn('[MQTT Transport] Publish rejected as "Not authorized" — JWT likely expired, triggering reconnect');
              triggerReconnect();
            }

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

        if (notification.type === ACTION_LOG_BROADCAST_TYPE) {
          const { logId, eventType } = (notification.params || {}) as { logId?: string; eventType?: 'created' | 'updated' };
          if (logId && eventType) {
            await ActionLogEventBroadcaster.runBroadcastFromQueue(adminPrisma, logId, eventType);
            logger.debug(`[MQTT Queue] Successfully broadcast action log: ${logId}`);
          }
          return;
        }

        // device:unclaimed is sent as plain JSON — no JWT ticket required
        if (notification.type === 'device:unclaimed') {
          const deviceId = notification.recipient.replace(/^device:/, '');
          const topic = `device/device:${deviceId}/notifications`;
          const payload = JSON.stringify({
            type: 'device:unclaimed',
            params: notification.params ?? {}
          });
          await clientPublishMqttMessage(topic, payload, { qos: 1 });
          logger.info(`[MQTT Queue] Published device:unclaimed directly to ${topic}`);
          return;
        }

        // Send the queued notification via MQTT (device/user notifications)
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

    // Fast startup sync: Bulk-refresh Redis from MQTT broker as quickly as possible
    // This provides immediate presence data without waiting for full reconciliation
    setTimeout(async () => {
      try {
        logger.info('[MQTT Transport] Starting fast startup sync...');
        const { fastStartupSync } = await import('$lib/server/mqtt/utils/reconciliation');
        await fastStartupSync();
        logger.info('[MQTT Transport] Fast startup sync completed');
      } catch (err) {
        logger.error(
          `[MQTT Transport] Fast startup sync failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }, 1000); // Start after 1 second (quick!)

    // Full reconciliation after fast sync to update DB and send notifications
    setTimeout(async () => {
      try {
        logger.info('[MQTT Transport] Starting full device presence reconciliation...');
        const { reconcileDevicePresence } = await import('$lib/server/mqtt/utils/reconciliation');
        await reconcileDevicePresence();
        logger.info('[MQTT Transport] Device presence reconciliation completed');
      } catch (err) {
        logger.error(
          `[MQTT Transport] Device presence reconciliation failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }, 3000); // Full reconciliation after 3 seconds

    // Frequent reconciliation during first 5 minutes after startup
    // This ensures quick sync if there were any missed events during downtime
    const STARTUP_RECONCILE_INTERVAL_MS = 30 * 1000; // 30 seconds
    const startupReconcileInterval = setInterval(async () => {
      try {
        const { reconcileDevicePresence } = await import('$lib/server/mqtt/utils/reconciliation');
        await reconcileDevicePresence();
        logger.debug('[MQTT Transport] Startup reconciliation cycle completed');
      } catch (err) {
        logger.error(
          `[MQTT Transport] Startup reconciliation failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }, STARTUP_RECONCILE_INTERVAL_MS);

    // Stop frequent startup reconciliation after 5 minutes
    setTimeout(() => {
      clearInterval(startupReconcileInterval);
      logger.info('[MQTT Transport] Startup reconciliation period ended, switching to normal interval');
    }, 5 * 60 * 1000); // 5 minutes

    // Set up periodic TTL refresh for connected devices (every 2 minutes)
    // This prevents devices from appearing offline when they're still connected
    const PRESENCE_REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
    const presenceRefreshInterval = setInterval(async () => {
      try {
        const { reconcileDevicePresence } = await import('$lib/server/mqtt/utils/reconciliation');
        await reconcileDevicePresence();
        logger.debug('[MQTT Transport] Periodic device presence TTL refresh completed');
      } catch (err) {
        logger.error(
          `[MQTT Transport] Periodic presence refresh failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }, PRESENCE_REFRESH_INTERVAL_MS);
    
    // Clean up intervals on shutdown
    const originalShutdown = (signal: NodeJS.Signals) => {
      clearInterval(startupReconcileInterval);
      clearInterval(presenceRefreshInterval);
      shutdown(signal);
    };

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

    process.once('SIGINT', originalShutdown);
    process.once('SIGTERM', originalShutdown);
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
