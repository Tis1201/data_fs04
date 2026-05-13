import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { MqttClient } from 'mqtt';
import { matchesTopic, parsePayload, subscribeWithAuthRetry } from '$lib/client/mqtt/utils';
import { mintConnectionJwt, resolveBrokerUrl } from '$lib/client/mqtt/mintClient';
import { attachStreamDiagnostics } from '$lib/client/mqtt/streamDiagnostics';
import { createHeartbeatAndRefresh } from '$lib/client/mqtt/heartbeatAndRefresh';
import { createMqttConnection } from '$lib/client/mqtt/connectionFactory';

export type MQTTStatus = 'CONNECTING' | 'OPEN' | 'CLOSED' | 'ERROR';

export interface MQTTMessage {
    topic: string;
    payload: unknown;
    raw: string;
    receivedAt: string;
}

interface MQTTConnectionInfo {
    url: string;
    clientId?: string;
    status: MQTTStatus;
}

interface MQTTState {
    status: MQTTStatus;
    error: Error | null;
    connection: MQTTConnectionInfo | null;
    messages: MQTTMessage[];
}

type TopicCallback = (message: MQTTMessage) => void;

const BASE_RECONNECT_INTERVAL = 2000;
const MAX_RECONNECT_INTERVAL = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_KEEP_ALIVE = 120;
const TOKEN_REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

let mqttModulePromise: Promise<any> | null = null;

async function loadMqtt() {
    if (!mqttModulePromise) {
        mqttModulePromise = import('mqtt');
    }
    return mqttModulePromise;
}

export interface ConnectOptions {
    url?: string;
    topics?: string[];
    keepAlive?: number;
    clean?: boolean;
    clientId?: string;
}

export function createMQTTStore() {
    if (!browser) {
        const { subscribe } = writable<MQTTState>({
            status: 'CLOSED',
            error: null,
            connection: null,
            messages: []
        });

        return {
            subscribe,
            connect: async () => { },
            disconnect: () => { },
            resetForNewUser: () => { },
            setAuthEnabled: () => { },
            publish: async () => {
                throw new Error('MQTT unavailable during SSR');
            },
            on: () => () => { },
            clearMessages: () => { }
        };
    }

    const { subscribe, set, update } = writable<MQTTState>({
        status: 'CLOSED',
        error: null,
        connection: null,
        messages: []
    });

    let allowConnections = true;
    let currentClient: MqttClient | null = null;
    let currentUrl: string | null = null;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectPromise: Promise<void> | null = null;
    let lastJwt: string | null = null;
    let lastJwtExpiry = 0;
    let lastBrokerUrl: string | null = null;
    let lastUsername: string | null = null;
    let lastClientId: string | null = null;
    let streamDiagnosticsCleanup: (() => void) | null = null;
    let forceTokenRefreshOnNextConnect = false;

    const topicListeners = new Map<string, Set<TopicCallback>>();
    const wildcardListeners = new Set<TopicCallback>();
    const pendingTopics = new Set<string>();

    const detachDiagnostics = () => {
        if (streamDiagnosticsCleanup) {
            try {
                streamDiagnosticsCleanup();
            } catch (err) {
                console.warn('[MQTT] Failed detaching stream diagnostics', err);
            }
            streamDiagnosticsCleanup = null;
        }
    };

    const teardownClient = () => {
        heartbeatApi.clearTokenRefreshTimer();
        detachDiagnostics();
        if (!currentClient) return;
        try {
            currentClient.removeAllListeners();
            currentClient.end(true);
        } catch (err) {
            console.warn('[MQTT] Error closing client', err);
        }
        currentClient = null;
    };

    const updateState = (partial: Partial<MQTTState>) => {
        update(state => ({ ...state, ...partial }));
    };

    const handleMessage = (topic: string, payload: Buffer) => {
        const { raw, parsed } = parsePayload(new Uint8Array(payload));

        const message: MQTTMessage = {
            topic,
            payload: parsed,
            raw,
            receivedAt: new Date().toISOString()
        };

        update(state => ({
            ...state,
            messages: [...state.messages, message]
        }));

        topicListeners.forEach((listeners, filter) => {
            if (matchesTopic(filter, topic)) {
                listeners.forEach(listener => {
                    try {
                        listener(message);
                    } catch (err) {
                        console.error('[MQTT] Listener error:', err);
                    }
                });
            }
        });

        wildcardListeners.forEach(listener => {
            try {
                listener(message);
            } catch (err) {
                console.error('[MQTT] Wildcard listener error:', err);
            }
        });
    };

    const scheduleReconnect = () => {
        if (!allowConnections) {
            return;
        }

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            const error = new Error(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
            console.error('[MQTT]', error.message);
            updateState({ status: 'ERROR', error });
            return;
        }

        if (reconnectTimer) {
            return;
        }

        reconnectAttempts++;
        const baseDelay = Math.min(
            BASE_RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts - 1),
            MAX_RECONNECT_INTERVAL
        );
        const jitter = Math.random() * 1000;
        const delay = Math.floor(baseDelay + jitter);

        console.log(`[MQTT] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`);

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (currentUrl) {
                connect({ url: currentUrl });
            }
        }, delay);
    };

    const mintIfNeeded = async (forceRefresh = false): Promise<{ token: string; brokerUrl: string | null; username: string | null; clientId: string | null }> => {
        const now = Date.now();
        if (!forceRefresh && lastJwt && lastJwtExpiry && now < lastJwtExpiry - 30_000) {
            return {
                token: lastJwt,
                brokerUrl: lastBrokerUrl,
                username: lastUsername,
                clientId: lastClientId
            };
        }

        const { token, brokerUrl, username, clientId } = await mintConnectionJwt();
        lastJwt = token;
        lastBrokerUrl = brokerUrl ?? lastBrokerUrl;
        lastUsername = username ?? lastUsername;
        lastClientId = clientId ?? lastClientId;

        try {
            const [, payloadSegment] = token.split('.');
            if (payloadSegment) {
                const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
                const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
                const decoded = JSON.parse(atob(padded));
                if (decoded?.exp) {
                    lastJwtExpiry = decoded.exp * 1000;
                }
            }
        } catch (err) {
            console.warn('[MQTT] Failed to decode JWT expiry', err);
            lastJwtExpiry = Date.now() + 50 * 60 * 1000; // fallback 50min
        }

        return {
            token,
            brokerUrl: lastBrokerUrl,
            username: lastUsername,
            clientId: lastClientId
        };
    };

    const ensureConnected = async (options: ConnectOptions = {}) => {
        if (connectPromise) {
            return connectPromise;
        }

        connectPromise = (async () => {
            if (!allowConnections) {
                console.log('[MQTT] Connections disabled, skipping connect');
                return;
            }

            try {
                // Force fresh JWT on reconnection or when broker rejected subscribe (e.g. "Not authorized")
                const forceRefresh = reconnectAttempts > 0 || forceTokenRefreshOnNextConnect;
                if (forceTokenRefreshOnNextConnect) forceTokenRefreshOnNextConnect = false;
                const { token, brokerUrl: mintedBrokerUrl, username, clientId } = await mintIfNeeded(forceRefresh);
                const brokerUrl = resolveBrokerUrl(options.url, mintedBrokerUrl);
                if (!brokerUrl) {
                    throw new Error('MQTT broker URL is not available from mint response');
                }

                updateState({
                    status: 'CONNECTING',
                    error: null,
                    connection: {
                        url: brokerUrl,
                        clientId: options.clientId,
                        status: 'CONNECTING'
                    },
                    messages: []
                });

                teardownClient();

                const connectionOptions: Record<string, unknown> = {
                    clean: options.clean ?? true,
                    keepalive: options.keepAlive ?? DEFAULT_KEEP_ALIVE,
                    reconnectPeriod: 0,
                    resubscribe: true,
                    path: '/mqtt',
                    protocolVersion: 5
                };

                const resolvedUsername = username ?? lastUsername;
                if (resolvedUsername) connectionOptions.username = resolvedUsername;

                const resolvedClientId = clientId ?? lastClientId ?? options.clientId;
                if (resolvedClientId) connectionOptions.clientId = resolvedClientId;

                if (token) connectionOptions.password = token;

                const { client, streamCleanup } = await createMqttConnection({
                    brokerUrl,
                    connectionOptions,
                    loadMqtt,
                    attachStreamDiagnostics,
                    onConnect: (c) => {
                        console.log('[MQTT] Connected');
                        updateState({
                            status: 'OPEN',
                            connection: {
                                url: brokerUrl,
                                clientId: c.options.clientId,
                                status: 'OPEN'
                            }
                        });
                        heartbeatApi.startHeartbeat();
                        heartbeatApi.scheduleTokenRefresh();

                        // Re-subscribe to ALL registered topics on every connect/reconnect.
                        // This covers two cases:
                        //   1. Topics added to pendingTopics while currentClient was null.
                        //   2. Topics added to topicListeners while currentClient existed but
                        //      the subscription failed (e.g. connection torn down mid-handshake).
                        const handleAuthError = () => {
                            forceTokenRefreshOnNextConnect = true;
                            teardownClient();
                            connectPromise = null;
                            scheduleReconnect();
                        };
                        const topicsToSubscribe = new Set([
                            ...pendingTopics,
                            ...topicListeners.keys()
                        ]);
                        topicsToSubscribe.forEach(topic => {
                            subscribeWithAuthRetry(c, topic, handleAuthError).catch(() => {});
                        });
                        pendingTopics.clear();
                    },
                    onMessage: handleMessage,
                    onClose: (err?: Error) => {
                        detachDiagnostics();
                        heartbeatApi.stopHeartbeat();
                        if (err) console.error('[MQTT] Connection closed due to error', err);
                        else console.log('[MQTT] Connection closed');
                        updateState({ status: 'CLOSED' });
                        scheduleReconnect();
                    },
                    onOffline: () => {
                        console.log('[MQTT] Connection offline');
                        heartbeatApi.stopHeartbeat();
                        updateState({ status: 'CONNECTING' });
                    },
                    onError: (err: Error) => {
                        console.error('[MQTT] Error', err);
                        heartbeatApi.stopHeartbeat();
                        updateState({ status: 'ERROR', error: err });
                    }
                });

                currentClient = client;
                currentUrl = brokerUrl;
                reconnectAttempts = 0;
                streamDiagnosticsCleanup = streamCleanup;
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                console.error('[MQTT] Failed to connect', error);
                updateState({ status: 'ERROR', error });
                scheduleReconnect();
                throw error;
            }
        })().finally(() => {
            connectPromise = null;
        });

        return connectPromise;
    };

    async function connect(options: ConnectOptions = {}) {
        if (!allowConnections) {
            console.log('[MQTT] Connections disabled, skipping connect');
            return;
        }

        await ensureConnected(options);

        if (options.topics?.length && currentClient) {
            const handleAuthError = () => {
                forceTokenRefreshOnNextConnect = true;
                teardownClient();
                connectPromise = null;
                scheduleReconnect();
            };
            for (const topic of options.topics) {
                subscribeWithAuthRetry(currentClient, topic, handleAuthError).catch(() => {});
            }
        }
    }

    // Create heartbeatApi after connect/teardownClient are defined so onTokenRefreshDue can reference them
    const heartbeatApi = createHeartbeatAndRefresh({
        getClient: () => currentClient,
        getUsername: () => lastUsername,
        getJwtExpiry: () => lastJwtExpiry,
        beforeExpiryMs: TOKEN_REFRESH_BEFORE_EXPIRY_MS,
        onTokenRefreshDue: () => {
            teardownClient();
            connectPromise = null;
            forceTokenRefreshOnNextConnect = true;
            if (currentUrl && allowConnections) connect({ url: currentUrl });
        }
    });

    function disconnect() {
        console.log('[MQTT] Disconnect requested');
        heartbeatApi.stopHeartbeat();
        heartbeatApi.clearTokenRefreshTimer();
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        reconnectAttempts = 0;
        connectPromise = null;
        teardownClient();
        updateState({ status: 'CLOSED', connection: null });
    }

    function resetForNewUser() {
        console.log('[MQTT] Resetting connection for new user');
        lastJwt = null;
        lastJwtExpiry = 0;
        disconnect();
        lastUsername = null;
        updateState({
            error: null,
            messages: [],
            connection: null
        });
    }

    function setAuthEnabled(enabled: boolean) {
        allowConnections = enabled;
        if (!enabled) {
            console.log('[MQTT] Disabling connections due to auth state');
            disconnect();
        }
    }

    async function publish(topic: string, payload: unknown, options: { qos?: 0 | 1 | 2; retain?: boolean } = {}) {
        if (!currentClient) {
            throw new Error('MQTT client not connected');
        }

        const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        return new Promise<void>((resolve, reject) => {
            currentClient!.publish(topic, message, options, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    function on(topicFilter: string, callback: TopicCallback) {
        if (!topicFilter) {
            throw new Error('Topic filter is required');
        }

        const isWildcard = topicFilter.includes('*');

        if (isWildcard) {
            wildcardListeners.add(callback);
        } else {
            let listeners = topicListeners.get(topicFilter);
            if (!listeners) {
                listeners = new Set();
                topicListeners.set(topicFilter, listeners);
            }
            listeners.add(callback);

            if (currentClient && topicFilter !== '*') {
                const handleAuthError = () => {
                    forceTokenRefreshOnNextConnect = true;
                    teardownClient();
                    connectPromise = null;
                    scheduleReconnect();
                };
                subscribeWithAuthRetry(currentClient, topicFilter, handleAuthError).catch(() => {});
            } else if (!currentClient) {
                pendingTopics.add(topicFilter);
            }
        }

        return () => {
            if (isWildcard) {
                wildcardListeners.delete(callback);
            } else {
                const listeners = topicListeners.get(topicFilter);
                if (listeners) {
                    listeners.delete(callback);
                    if (listeners.size === 0) {
                        topicListeners.delete(topicFilter);
                        if (currentClient) {
                            currentClient.unsubscribe(topicFilter, (err) => {
                                if (err) {
                                    console.error('[MQTT] Failed to unsubscribe', topicFilter, err);
                                }
                            });
                        }
                    }
                }
            }
        };
    }

    function clearMessages() {
        update(state => ({
            ...state,
            messages: []
        }));
    }

    return {
        subscribe,
        connect,
        disconnect,
        resetForNewUser,
        setAuthEnabled,
        publish,
        on,
        clearMessages,
        get status() {
            let current: MQTTStatus = 'CLOSED';
            const unsubscribe = subscribe(state => {
                current = state.status;
            });
            unsubscribe();
            return current;
        },
        get subject() {
            return lastUsername;
        }
    };

}

export const mqttStore = createMQTTStore();
