import 'dotenv/config';
import mqtt, { type IClientOptions, type IConnackPacket, type MqttClient } from 'mqtt';
import os from 'node:os';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { logger } from '../lib/server/logger';
import { handleIncoming } from '../lib/server/mqtt/handlers';
import { registerMqttTransport } from '../lib/server/mqtt/core/transport';
import { getWorkerSubscriptions } from '../lib/server/mqtt/core/subscriptions';
import { registerDeviceHandlers } from '../lib/server/mqtt/handlers/device';
import { registerWebHandlers } from '../lib/server/mqtt/handlers/web';
import { mintIoTCoreCredentials } from '../lib/server/mqtt/mint';
import { PrismaClient } from '@prisma/client';

// Use raw Prisma client for the worker (no Zenstack enhancement)
// Zenstack codegen artifacts aren't available when running outside SvelteKit
const adminPrisma = new PrismaClient();

registerDeviceHandlers(adminPrisma);
registerWebHandlers(adminPrisma);

let client: MqttClient | null = null;
let started = false;

const brokerUrl = process.env.MQTT_BROKER_URL;

// Use shared group from MQTT_SHARED_GROUP (see core/subscriptions.ts),
// falling back to its internal default when not set.
const topics = getWorkerSubscriptions();

const defaultClientId = `fs04-worker-${os.hostname()}-${Date.now()}`;

const BASE_RECONNECT_MS = Number(process.env.MQTT_WORKER_BASE_RECONNECT_MS ?? '2000');
const MAX_RECONNECT_MS = Number(process.env.MQTT_WORKER_MAX_RECONNECT_MS ?? '60000');

const connectionOptions: IClientOptions = {
  protocolVersion: 5,
  clean: process.env.MQTT_WORKER_CLEAN_SESSION !== 'false',
  keepalive: Number(process.env.MQTT_WORKER_KEEPALIVE ?? '60'),
  reconnectPeriod: 0,
  clientId: process.env.MQTT_WORKER_CLIENT_ID ?? defaultClientId,
  username: process.env.MQTT_SERVER_USERNAME,
  password: process.env.MQTT_SERVER_PASSWORD,
  path: process.env.MQTT_WORKER_PATH ?? '/mqtt'
};

async function mintWorkerCredentials(): Promise<
  { clientId: string; username: string; password: string } | null
> {
  const workerUsername = process.env.MQTT_WORKER_USERNAME ?? 'server:fs04-worker';

  const data = await mintIoTCoreCredentials({
    username: workerUsername,
    pubTopics: ['#'],
    subTopics: ['#']
  });

  if (!data) {
    logger.info('[MQTT Transport] IoT Core minting not configured or failed; using static MQTT_SERVER_USERNAME/PASSWORD');
    return null;
  }

  logger.info(
    `[MQTT Transport] Minted worker MQTT credentials via IoT Core (clientId=${data.clientId})`
  );

  return {
    clientId: data.clientId,
    username: data.username ?? workerUsername,
    password: data.token
  };
}

let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

function scheduleReconnect() {
  if (reconnectTimer || !client) {
    return;
  }

  reconnectAttempts += 1;
  const exponentialDelay = Math.min(
    BASE_RECONNECT_MS * Math.pow(2, reconnectAttempts - 1),
    MAX_RECONNECT_MS
  );
  const jitter = Math.floor(Math.random() * 1000);
  const delay = exponentialDelay + jitter;

  logger.warn(
    `[MQTT Transport] Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!client) {
      return;
    }
    logger.info(
      `[MQTT Transport] Triggering reconnect to ${brokerUrl ?? 'undefined'} (attempt ${reconnectAttempts})`
    );
    client.reconnect();
  }, delay);
}

export function startMqttListener(): void {
  if (started) {
    logger.info('[MQTT Transport] Service already running');
    return;
  }

  if (!brokerUrl) {
    logger.warn('[MQTT Transport] Missing MQTT_WORKER_URL or MQTT_BROKER_URL, service not started');
    return;
  }

  started = true;

  (async () => {
    const minted = await mintWorkerCredentials();

    const finalOptions: IClientOptions = {
      ...connectionOptions,
      clientId: minted?.clientId ?? connectionOptions.clientId ?? defaultClientId,
      username: minted?.username ?? connectionOptions.username,
      password: minted?.password ?? connectionOptions.password
    };

    const clientId = finalOptions.clientId ?? defaultClientId;

    logger.info(
      `[MQTT Transport] Connecting to ${brokerUrl} with clientId ${clientId} (username=${finalOptions.username ?? 'n/a'})`
    );

    client = mqtt.connect(brokerUrl, finalOptions);

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

    client.on('connect', (connack: IConnackPacket) => {
    const reason = connack.reasonCode ?? connack.returnCode;
    logger.info(
      `[MQTT Transport] Connected as ${clientId} (sessionPresent=${connack.sessionPresent}, reason=${reason ?? 'n/a'})`
    );

    if (connack.properties?.assignedClientIdentifier) {
      logger.debug(
        `[MQTT Transport] Broker assigned clientId ${connack.properties.assignedClientIdentifier}`
      );
    }

    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (topics.length === 0) {
      logger.warn('[MQTT Transport] Connected but no topics configured via MQTT_WORKER_TOPICS');
      return;
    }

    client?.subscribe(topics, { qos: Number(process.env.MQTT_WORKER_QOS ?? '0') }, (err, granted) => {
      if (err) {
        logger.error(`[MQTT Transport] Failed to subscribe: ${err.message}`);
        return;
      }

      const grantedTopics = granted?.map((g) => g.topic) ?? topics;
      logger.info(`[MQTT Transport] Subscribed to topics: ${grantedTopics.join(', ')}`);
    });
  });

    client.on('message', async (topic, payload) => {
    logger.debug(`[MQTT Transport] Received message on ${topic}`);

    // try {
      await handleIncoming(topic, payload, adminPrisma);
    // } catch (err) {
    //   const error = err instanceof Error ? err.message : String(err);
    //   logger.error(`[MQTT Transport] Error processing message on ${topic}: ${error}`);
    // }
  });

    client.on('error', (err) => {
    logger.error(`[MQTT Transport] Client error: ${err.message}`, {
      stack: err?.stack
    });
    scheduleReconnect();
  });

    client.on('disconnect', (packet: any) => {
    logger.warn(
      `[MQTT Transport] Broker sent disconnect (reasonCode=${packet?.reasonCode ?? 'n/a'}, reasonString=${packet?.properties?.reasonString ?? 'n/a'})`
    );
    scheduleReconnect();
  });

    client.on('reconnect', () => {
    logger.warn('[MQTT Transport] Client attempting immediate reconnect');
  });

    client.on('close', () => {
    const status = client
      ? `connected=${client.connected}, disconnecting=${client.disconnecting}, reconnecting=${client.reconnecting}`
      : 'client=null';
    logger.warn(`[MQTT Transport] Connection closed (${status})`);
    scheduleReconnect();
  });

    client.on('offline', () => {
    logger.warn('[MQTT Transport] Client offline');
    scheduleReconnect();
  });

    const shutdown = (signal: NodeJS.Signals) => {
    logger.info(`[MQTT Transport] Caught ${signal}, shutting down service`);
    client?.end(false, {}, () => {
      started = false;
      client = null;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempts = 0;
    });
  };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  })().catch((err) => {
    logger.error(
      `[MQTT Transport] Failed to start worker MQTT listener: ${
        err instanceof Error ? err.message : String(err)
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

export async function publishMqttMessage(
  topic: string,
  payload: string | Buffer,
  options: mqtt.IClientPublishOptions = {}
): Promise<void> {
  const transport = {
    publish: async (topic: string, payload: string | Buffer, options: mqtt.IClientPublishOptions = {}) => {
      if (!client) {
        throw new Error('MQTT transport is not connected. Ensure startMqttTransport() has run.');
      }

      return new Promise<void>((resolve, reject) => {
        client!.publish(topic, payload, options, (err) => {
          if (err) {
            logger.error(`[MQTT Transport] Failed to publish on ${topic}: ${err.message}`);
            reject(err);
          } else {
            logger.debug(`[MQTT Transport] Published message on ${topic}`);
            resolve();
          }
        });
      });
    }
  };

  await transport.publish(topic, payload, options);
}
