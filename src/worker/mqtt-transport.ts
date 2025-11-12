import 'dotenv/config';
import mqtt, { type IClientOptions, type IConnackPacket, type MqttClient } from 'mqtt';
import os from 'node:os';
import process from 'node:process';

import { logger } from '$lib/server/logger';

let client: MqttClient | null = null;
let started = false;

const brokerUrl = process.env.MQTT_BROKER_URL;
const sharedGroup = 'server';

const topics = [
  `$share/${sharedGroup}/device/+/requests`,
  `$share/${sharedGroup}/device/+/events`,
  `$share/${sharedGroup}/user/+/requests`,
  `$share/${sharedGroup}/user/+/events`
];

const defaultClientId = `fs04-worker-${os.hostname()}-${Date.now()}`;

const BASE_RECONNECT_MS = Number(process.env.MQTT_WORKER_BASE_RECONNECT_MS ?? '2000');
const MAX_RECONNECT_MS = Number(process.env.MQTT_WORKER_MAX_RECONNECT_MS ?? '60000');

const connectionOptions: IClientOptions = {
  protocolVersion: 5,
  clean: process.env.MQTT_WORKER_CLEAN_SESSION !== 'false',
  keepalive: Number(process.env.MQTT_WORKER_KEEPALIVE ?? '60'),
  reconnectPeriod: 0,
  clientId: process.env.MQTT_WORKER_CLIENT_ID ?? defaultClientId,
  username: process.env.MQTT_WORKER_USERNAME,
  password: process.env.MQTT_WORKER_PASSWORD,
  path: process.env.MQTT_WORKER_PATH ?? '/mqtt'
};

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

  const clientId = connectionOptions.clientId ?? defaultClientId;

  logger.info(
    `[MQTT Transport] Connecting to ${brokerUrl} with clientId ${clientId} (username=${connectionOptions.username ?? 'n/a'})`
  );

  client = mqtt.connect(brokerUrl, connectionOptions);

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
    const messageText = payload.toString('utf8');

    logger.debug(`[MQTT Transport] Received message on ${topic}: ${messageText}`);

    try {
      // Placeholder: add business logic here (persist, forward via Pushpin, etc.)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(`[MQTT Transport] Error processing message on ${topic}: ${error}`);
    }
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
}

export function startMqttTransport(): void {
  startMqttListener();
}

export async function publishMqttMessage(
  topic: string,
  payload: string | Buffer,
  options: mqtt.IClientPublishOptions = {}
): Promise<void> {
  if (!client) {
    throw new Error('MQTT transport is not connected. Ensure startMqttTransport() has run.');
  }

  return new Promise((resolve, reject) => {
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
