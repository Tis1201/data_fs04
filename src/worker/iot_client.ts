import 'dotenv/config';
import mqtt, { type IClientOptions, type IConnackPacket, type MqttClient } from 'mqtt';

type QoS = 0 | 1 | 2;
import os from 'node:os';
import process from 'node:process';
import { logger } from '../lib/server/logger';
import { handleIncoming } from '../lib/server/mqtt/handlers';
import { getWorkerSubscriptions } from '../lib/server/mqtt/core/subscriptions';
import { mintIoTCoreCredentials } from '../lib/server/mqtt/mint';
import { PrismaClient } from '@prisma/client';

// Use raw Prisma client for the worker (no Zenstack enhancement)
// Zenstack codegen artifacts aren't available when running outside SvelteKit
export const adminPrisma = new PrismaClient();

export let client: MqttClient | null = null;
export let started = false;

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
let heartbeatTimer: NodeJS.Timeout | null = null;

function sendHeartbeat() {
    if (client && client.connected) {
        client.publish('heartbeat', JSON.stringify({ timestamp: Date.now() }), { qos: 0 }, (err) => {
            if (err) logger.error(`[MQTT Transport] Failed to send heartbeat: ${err.message}`);
        });
    }
}

function startHeartbeat() {
    if (heartbeatTimer) return;
    logger.info('[MQTT Transport] Starting heartbeat');

    // Send immediately
    sendHeartbeat();

    heartbeatTimer = setInterval(() => {
        sendHeartbeat();
    }, 60000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        logger.info('[MQTT Transport] Stopping heartbeat');
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}


export async function connectWorkerClient(): Promise<void> {
    const minted = await mintWorkerCredentials();

    const finalOptions: IClientOptions = {
        ...connectionOptions,
        clientId: minted?.clientId ?? connectionOptions.clientId ?? defaultClientId,
        username: minted?.username ?? connectionOptions.username,
        password: minted?.password ?? connectionOptions.password
    };

    const clientId = finalOptions.clientId ?? defaultClientId;

    logger.info(
        `[MQTT Transport] Connecting to ${brokerUrl} with clientId ${clientId} (username=${finalOptions.username ?? 'n/a'
        })`
    );

    client = mqtt.connect(brokerUrl!, finalOptions);

    const activeClient = client;

    activeClient.on('connect', (connack: IConnackPacket) => {
        const reason = connack.reasonCode ?? connack.returnCode;
        logger.info(
            `[MQTT Transport] Connected as ${clientId} (sessionPresent=${connack.sessionPresent}, reason=${reason ?? 'n/a'
            })`
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

        activeClient.subscribe(
            topics,
            { qos: Number(process.env.MQTT_WORKER_QOS ?? '0') as QoS },
            (err, granted) => {
                if (err) {
                    logger.error(`[MQTT Transport] Failed to subscribe: ${err.message}`);
                    return;
                }

                const grantedTopics = granted?.map((g) => g.topic) ?? topics;
                logger.info(`[MQTT Transport] Subscribed to topics: ${grantedTopics.join(', ')}`);
            }
        );

        startHeartbeat();
    });

    activeClient.on('message', async (topic, payload) => {
        logger.debug(`[MQTT Transport] Received message on ${topic}`);
        await handleIncoming(topic, payload, adminPrisma);
    });

    activeClient.on('error', (err) => {
        logger.error(`[MQTT Transport] Client error: ${err.message}`, {
            stack: err?.stack
        });
        stopHeartbeat();
        scheduleReconnect();
    });

    activeClient.on('disconnect', (packet: any) => {
        logger.warn(
            `[MQTT Transport] Broker sent disconnect (reasonCode=${packet?.reasonCode ?? 'n/a'
            }, reasonString=${packet?.properties?.reasonString ?? 'n/a'})`
        );
        stopHeartbeat();
        scheduleReconnect();
    });

    activeClient.on('reconnect', () => {
        logger.warn('[MQTT Transport] Client attempting immediate reconnect');
    });

    activeClient.on('close', () => {
        const status = activeClient
            ? `connected=${activeClient.connected}, disconnecting=${activeClient.disconnecting}, reconnecting=${activeClient.reconnecting}`
            : 'client=null';
        logger.warn(`[MQTT Transport] Connection closed (${status})`);
        stopHeartbeat();
        scheduleReconnect();
    });

    activeClient.on('offline', () => {
        logger.warn('[MQTT Transport] Client offline');
        stopHeartbeat();
        scheduleReconnect();
    });
}

function scheduleReconnect() {
    if (reconnectTimer) {
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

        // We need to check 'started' but it's exported.
        // However, 'started' is managed in index.ts usually?
        // Wait, in the original code 'started' was local.
        // I should export 'setStarted' or similar if I want to control it from outside,
        // or just keep it here if it's only used for reconnect logic.
        // Actually, 'started' is used in 'startMqttListener' to prevent double start.
        // And 'scheduleReconnect' checks it to stop reconnecting if stopped.
        // So I should probably keep 'started' here and export a way to set it, or just export it.
        // I exported it above.

        if (!started || !brokerUrl) {
            return;
        }

        logger.info(
            `[MQTT Transport] Triggering reconnect to ${brokerUrl ?? 'undefined'} (attempt ${reconnectAttempts})`
        );

        const current = client;
        if (current) {
            current.end(true, () => {
                client = null;
                connectWorkerClient().catch((err) => {
                    logger.error(
                        `[MQTT Transport] Failed to reconnect MQTT worker: ${err instanceof Error ? err.message : String(err)
                        }`
                    );
                });
            });
        } else {
            connectWorkerClient().catch((err) => {
                logger.error(
                    `[MQTT Transport] Failed to reconnect MQTT worker: ${err instanceof Error ? err.message : String(err)
                    }`
                );
            });
        }
    }, delay);
}

export function setStarted(value: boolean) {
    started = value;
}

export function setClient(value: MqttClient | null) {
    client = value;
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

