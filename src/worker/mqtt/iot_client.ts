import 'dotenv/config';
import mqtt, { type IClientOptions, type IConnackPacket, type MqttClient } from 'mqtt';

type QoS = 0 | 1 | 2;
import os from 'node:os';
import process from 'node:process';
import { logger } from '$lib/server/logger';
import { handleIncoming } from '$lib/server/mqtt/handlers';
import { getWorkerSubscriptions } from '$lib/server/mqtt/core/subscriptions';
import { mintIoTCoreCredentials } from '$lib/server/mqtt/utils/mint';
import { PrismaClient } from '@prisma/client';
import { MessageQueue } from './message-queue';

// Use raw Prisma client for the worker (no Zenstack enhancement)
// Zenstack codegen artifacts aren't available when running outside SvelteKit
export const adminPrisma = new PrismaClient();

// Message queue for concurrent processing with backpressure
export const messageQueue = new MessageQueue();

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
    keepalive: Number(process.env.MQTT_WORKER_KEEPALIVE ?? '10'),
    reconnectPeriod: 0,
    clientId: process.env.MQTT_WORKER_CLIENT_ID ?? defaultClientId,
    username: process.env.MQTT_SERVER_USERNAME,
    password: process.env.MQTT_SERVER_PASSWORD,
    path: process.env.MQTT_WORKER_PATH ?? '/mqtt'
};

/*****************************************************************
 * Mints new MQTT credentials via the IoT Core API.
 * Returns null if configuration is missing or minting fails.
 *****************************************************************/
async function mintWorkerCredentials(): Promise<
    { clientId: string; username: string; password: string } | null
> {
    const workerUsername = process.env.MQTT_WORKER_USERNAME ?? 'server:fs04-worker';

    const data = await mintIoTCoreCredentials(
        {
            username: workerUsername,
            tier: {
                kind: 'server',
                role: workerUsername.startsWith('server:') ? workerUsername.slice('server:'.length) : 'fs04-worker'
            },
            pubTopics: ['#'],
            subTopics: ['#']
        },
        adminPrisma
    );

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
let credentialRefreshTimer: NodeJS.Timeout | null = null;

/**
 * How long before JWT expiry to schedule a proactive reconnect (in ms).
 * JWT is minted with expiresIn: '1h' (3600s). Reconnect at 50 minutes to
 * leave a 10-minute safety margin.
 */
const JWT_REFRESH_BEFORE_EXPIRY_MS = Number(
    process.env.MQTT_WORKER_JWT_REFRESH_BEFORE_EXPIRY_MS ?? String(10 * 60 * 1000)
);
const JWT_EXPIRY_MS = Number(
    process.env.MQTT_WORKER_JWT_EXPIRY_MS ?? String(60 * 60 * 1000)
);

/*****************************************************************
 * Schedules a proactive reconnect before the JWT expires.
 * Called after a successful connect with minted credentials.
 *****************************************************************/
function scheduleCredentialRefresh(usedMintedCredentials: boolean) {
    clearCredentialRefreshTimer();

    if (!usedMintedCredentials) {
        // Static credentials don't expire; no refresh needed
        return;
    }

    const refreshIn = Math.max(JWT_EXPIRY_MS - JWT_REFRESH_BEFORE_EXPIRY_MS, 30_000);
    logger.info(
        `[MQTT Transport] Scheduling credential refresh in ${Math.round(refreshIn / 1000)}s ` +
        `(JWT expiry=${JWT_EXPIRY_MS / 1000}s, refreshBefore=${JWT_REFRESH_BEFORE_EXPIRY_MS / 1000}s)`
    );

    credentialRefreshTimer = setTimeout(() => {
        credentialRefreshTimer = null;
        logger.info('[MQTT Transport] JWT credential refresh triggered — reconnecting with fresh credentials');
        triggerReconnect();
    }, refreshIn);
}

function clearCredentialRefreshTimer() {
    if (credentialRefreshTimer) {
        clearTimeout(credentialRefreshTimer);
        credentialRefreshTimer = null;
    }
}

/*****************************************************************
 * Triggers a clean reconnect: ends the current client and
 * calls connectWorkerClient() which will mint fresh credentials.
 * Exported so index.ts can also trigger reconnect on auth errors.
 *****************************************************************/
export function triggerReconnect() {
    // Reset reconnect attempts so we reconnect immediately (not with backoff)
    reconnectAttempts = 0;
    stopHeartbeat();
    clearCredentialRefreshTimer();
    scheduleReconnect();
}

/*****************************************************
 * Sends a heartbeat message to the 'heartbeat' topic.
 *****************************************************/
function sendHeartbeat() {
    if (client && client.connected) {
        client.publish('heartbeat', JSON.stringify({ timestamp: Date.now() }), { qos: 0 }, (err) => {
            if (err) logger.error(`[MQTT Transport] Failed to send heartbeat: ${err.message}`);
        });
    }
}

/*******************************************************
 * Starts the heartbeat interval if not already running.
 *******************************************************/
function startHeartbeat() {
    if (heartbeatTimer) return;
    logger.info('[MQTT Transport] Starting heartbeat');

    // Send immediately
    sendHeartbeat();

    heartbeatTimer = setInterval(() => {
        sendHeartbeat();
    }, 60000);
}

/********************************
 * Stops the heartbeat interval.
 ********************************/
function stopHeartbeat() {
    if (heartbeatTimer) {
        logger.info('[MQTT Transport] Stopping heartbeat');
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}


/*************************************************************************
 * Connects the worker MQTT client.
 * Mints credentials, sets up event listeners, and handles subscriptions.
 *************************************************************************/
export async function connectWorkerClient(): Promise<void> {
    // Clear any pending credential refresh from previous connection
    clearCredentialRefreshTimer();

    const minted = await mintWorkerCredentials();
    const usedMintedCredentials = minted !== null;

    const finalOptions: IClientOptions = {
        ...connectionOptions,
        clientId: minted?.clientId ?? connectionOptions.clientId ?? defaultClientId,
        username: minted?.username ?? connectionOptions.username,
        password: minted?.password ?? connectionOptions.password
    };

    const clientId = finalOptions.clientId ?? defaultClientId;

    logger.info(
        `[MQTT Transport] Connecting to ${brokerUrl} with clientId ${clientId} (username=${finalOptions.username ?? 'n/a'
        }, mintedCredentials=${usedMintedCredentials})`
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

        // Schedule credential refresh before JWT expires
        scheduleCredentialRefresh(usedMintedCredentials);

        if (topics.length === 0) {
            logger.warn('[MQTT Transport] Connected but no topics configured via MQTT_WORKER_TOPICS');
            return;
        }

        activeClient.subscribe(
            topics,
            { qos: Number(process.env.MQTT_WORKER_QOS ?? '1') as QoS },
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
        // Only log non-data, non-heartbeat topics to reduce spam (high-frequency)
        if (!topic.endsWith('/data') && !topic.endsWith('/heartbeat')) {
            logger.debug(`[MQTT Transport] Received message on ${topic}`);
        } else if (topic.endsWith('/data')) {
            // TEMP DEBUG: Log data topic messages to diagnose radar preview issue
            logger.info(`[MQTT Transport] [DEBUG] Received /data message on ${topic}, payload length=${payload.length}`);
        }
        
        // Enqueue message for concurrent processing with backpressure
        await messageQueue.enqueue(
            () => handleIncoming(topic, payload, adminPrisma),
            { topic }
        );
    });

    activeClient.on('error', (err) => {
        logger.error(`[MQTT Transport] Client error: ${err.message}`, {
            stack: err?.stack
        });
        stopHeartbeat();
        clearCredentialRefreshTimer();
        scheduleReconnect();
    });

    activeClient.on('disconnect', (packet: any) => {
        logger.warn(
            `[MQTT Transport] Broker sent disconnect (reasonCode=${packet?.reasonCode ?? 'n/a'
            }, reasonString=${packet?.properties?.reasonString ?? 'n/a'})`
        );
        stopHeartbeat();
        clearCredentialRefreshTimer();
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
        clearCredentialRefreshTimer();
        scheduleReconnect();
    });

    activeClient.on('offline', () => {
        logger.warn('[MQTT Transport] Client offline');
        stopHeartbeat();
        clearCredentialRefreshTimer();
        scheduleReconnect();
    });
}

/***********************************************************
 * Schedules a reconnect attempt with exponential backoff.
 ***********************************************************/
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

/*****************************************
 * Sets the started state of the worker.
 *****************************************/
export function setStarted(value: boolean) {
    started = value;
}

/*************************************************************
 * Manually sets the MQTT client instance (mainly for testing).
 *************************************************************/
export function setClient(value: MqttClient | null) {
    client = value;
}


/********************************************************
 * Publishes an MQTT message using the active client.
 * Throws if the client is not connected.
 ********************************************************/
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
                const payloadStr = typeof payload === 'string' ? payload : payload.toString();
                logger.info(`[MQTT Transport] Publishing message to ${topic} (qos=${options.qos ?? 0}, payloadLength=${payloadStr.length}, connected=${client?.connected ?? false})`);
                if (!client || !client.connected) {
                    const err = new Error(`MQTT client not connected. connected=${client?.connected ?? false}`);
                    logger.error(`[MQTT Transport] Cannot publish: ${err.message}`);
                    reject(err);
                    return;
                }
                client.publish(topic, payload, options, (err) => {
                    if (err) {
                        logger.error(`[MQTT Transport] Failed to publish on ${topic}: ${err.message}`);

                        // Detect expired JWT / auth failure and trigger reconnect with fresh credentials
                        if (err.message?.toLowerCase().includes('not authorized')) {
                            logger.warn('[MQTT Transport] Publish rejected as "Not authorized" — JWT likely expired, triggering reconnect');
                            triggerReconnect();
                        }

                        reject(err);
                    } else {
                        logger.info(`[MQTT Transport] Published message on ${topic} (qos=${options.qos ?? 0}, payloadLength=${payloadStr.length}) - callback called`);
                        resolve();
                    }
                });
            });
        }
    };

    await transport.publish(topic, payload, options);
}

