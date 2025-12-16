import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { MqttClient } from 'mqtt';

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
const MINT_ENDPOINT = '/api/user/mqtt/mint';

const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

let mqttModulePromise: Promise<any> | null = null;

async function loadMqtt() {
    if (!mqttModulePromise) {
        mqttModulePromise = import('mqtt');
    }
    return mqttModulePromise;
}

function matchesTopic(filter: string, topic: string): boolean {
    if (!filter) return false;
    if (filter === '*' || filter === topic) {
        return true;
    }

    const filterLevels = filter.split('/');
    const topicLevels = topic.split('/');

    for (let i = 0; i < filterLevels.length; i++) {
        const filterLevel = filterLevels[i];
        const topicLevel = topicLevels[i];

        if (filterLevel === '#') {
            return true;
        }

        if (filterLevel === '+') {
            if (topicLevel === undefined) {
                return false;
            }
            continue;
        }

        if (filterLevel !== topicLevel) {
            return false;
        }
    }

    return filterLevels.length === topicLevels.length;
}

function parsePayload(payload: Uint8Array): { raw: string; parsed: unknown } {
    if (!payload || payload.length === 0) {
        return { raw: '', parsed: null };
    }

    const decoder = textDecoder ?? new TextDecoder();
    const raw = decoder.decode(payload);

    if (!raw) {
        return { raw: '', parsed: null };
    }

    try {
        return { raw, parsed: JSON.parse(raw) };
    } catch {
        return { raw, parsed: raw };
    }
}

function resolveBrokerUrl(explicitUrl?: string, mintedUrl?: string | null): string | null {
    if (explicitUrl) return explicitUrl;
    if (mintedUrl) return mintedUrl ?? null;
    return null;
}

async function mintConnectionJwt(): Promise<{ token: string; brokerUrl: string | null; username: string | null; clientId: string | null }> {
    const response = await fetch(MINT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to mint MQTT credential: ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data ?? payload;
    const token = data?.jwt ?? payload?.jwt;
    const brokerUrl = data?.brokerUrl ?? payload?.brokerUrl ?? null;
    let clientId: string | null = data?.clientId ?? payload?.clientId ?? null;

    if (!token) {
        throw new Error('Minted MQTT credential response missing jwt');
    }

    // Prefer explicit username from mint response (aligned with /api/user/mqtt/mint)
    let derivedUsername: string | null = data?.username ?? payload?.username ?? null;

    console.log('[MQTT] Minted JWT credential');
    if (brokerUrl) {
        console.log('[MQTT] Minted broker URL:', brokerUrl);
    }
    if (derivedUsername) {
        console.log('[MQTT] Minted username from response:', derivedUsername);
    }
    if (clientId) {
        console.log('[MQTT] Minted clientId from response:', clientId);
    }

    // Backwards-compatible fallback: derive username/clientId from JWT payload if not provided
    if (!derivedUsername || !clientId) {
        try {
            const [, payloadSegment] = token.split('.');
            if (payloadSegment) {
                const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
                const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
                const decodedPayload = JSON.parse(atob(padded));
                console.debug('[MQTT] JWT payload:', decodedPayload);
                if (!derivedUsername) {
                    derivedUsername =
                        decodedPayload?.email ??
                        decodedPayload?.name ??
                        decodedPayload?.username ??
                        decodedPayload?.userId ??
                        null;
                }
                if (!clientId) {
                    clientId = decodedPayload?.client_id ?? decodedPayload?.clientId ?? null;
                }
            } else {
                console.warn('[MQTT] Unable to decode JWT payload: missing segment');
            }
        } catch (err) {
            console.warn('[MQTT] Failed to decode JWT payload', err);
        }
    }

    return { token: token as string, brokerUrl, username: derivedUsername, clientId };
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
    let detachStreamDiagnostics: (() => void) | null = null;
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

    const topicListeners = new Map<string, Set<TopicCallback>>();
    const wildcardListeners = new Set<TopicCallback>();
    const pendingTopics = new Set<string>();

    const detachDiagnostics = () => {
        if (detachStreamDiagnostics) {
            try {
                detachStreamDiagnostics();
            } catch (err) {
                console.warn('[MQTT] Failed detaching stream diagnostics', err);
            }
            detachStreamDiagnostics = null;
        }
    };

    const attachStreamDiagnostics = (client: MqttClient) => {
        const stream = (client as any)?.stream;
        const cleanupFns: (() => void)[] = [];

        if (!stream) {
            return () => { };
        }

        if (typeof stream.addEventListener === 'function') {
            const handleClose = (event: Event) => {
                const closeEvent = event as CloseEvent;
                console.error('[MQTT] WebSocket close event', {
                    code: closeEvent.code,
                    reason: closeEvent.reason,
                    wasClean: closeEvent.wasClean
                });
            };
            const handleError = (event: Event) => {
                const errorEvent = event as ErrorEvent;
                const message = errorEvent?.message ?? (event as any)?.message ?? event.type ?? 'unknown';
                console.error('[MQTT] WebSocket error event', message, event);
            };

            stream.addEventListener('close', handleClose);
            stream.addEventListener('error', handleError);

            cleanupFns.push(() => {
                stream.removeEventListener('close', handleClose);
                stream.removeEventListener('error', handleError);
            });
        } else if (typeof stream.on === 'function') {
            const handleClose = (code?: number, reason?: Buffer | string) => {
                console.error('[MQTT] Stream close event', {
                    code,
                    reason: typeof reason === 'string' ? reason : reason?.toString('utf8')
                });
            };
            const handleError = (error: Error) => {
                console.error('[MQTT] Stream error event', error);
            };

            stream.on('close', handleClose);
            stream.on('error', handleError);

            cleanupFns.push(() => {
                if (typeof stream.off === 'function') {
                    stream.off('close', handleClose);
                    stream.off('error', handleError);
                } else if (typeof stream.removeListener === 'function') {
                    stream.removeListener('close', handleClose);
                    stream.removeListener('error', handleError);
                }
            });
        }

        return () => {
            cleanupFns.forEach((fn) => {
                try {
                    fn();
                } catch (err) {
                    console.warn('[MQTT] Failed to remove diagnostics listener', err);
                }
            });
        };
    };

    const teardownClient = () => {
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

    const sendHeartbeat = () => {
        if (currentClient && currentClient.connected && lastUsername) {
            const topic = `user/${lastUsername}/heartbeat`;
            const payload = JSON.stringify({ timestamp: Date.now() });
            currentClient.publish(topic, payload, { qos: 0 }, (err) => {
                if (err) {
                    console.error('[MQTT] Failed to send heartbeat', err);
                }
            });
        }
    };

    const startHeartbeat = () => {
        if (heartbeatTimer) return;
        console.log('[MQTT] Starting heartbeat');
        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, 60000);
    };

    const stopHeartbeat = () => {
        if (heartbeatTimer) {
            console.log('[MQTT] Stopping heartbeat');
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
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
                // Force fresh JWT on reconnection attempts to avoid using stale/expiring tokens
                const forceRefresh = reconnectAttempts > 0;
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

                const mqttModule = await loadMqtt();
                const potentialConnect =
                    mqttModule.connect ??
                    (typeof mqttModule.default === 'function' ? mqttModule.default : mqttModule.default?.connect);

                if (typeof potentialConnect !== 'function') {
                    console.error('[MQTT] Unable to resolve mqtt.connect function from module export', mqttModule);
                    throw new Error('mqtt.connect function unavailable');
                }

                const mqttConnect = potentialConnect;

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
                if (resolvedUsername) {
                    connectionOptions.username = resolvedUsername;
                }

                const resolvedClientId = clientId ?? lastClientId ?? options.clientId;
                if (resolvedClientId) {
                    connectionOptions.clientId = resolvedClientId;
                }

                if (token) {
                    connectionOptions.password = token;
                }

                const client = mqttConnect(brokerUrl, connectionOptions);

                currentClient = client;
                currentUrl = brokerUrl;
                reconnectAttempts = 0;
                detachDiagnostics();
                detachStreamDiagnostics = attachStreamDiagnostics(client);

                client.on('connect', () => {
                    console.log('[MQTT] Connected');
                    updateState({
                        status: 'OPEN',
                        connection: {
                            url: brokerUrl,
                            clientId: client.options.clientId,
                            status: 'OPEN'
                        }
                    });

                    startHeartbeat();

                    if (pendingTopics.size > 0) {
                        pendingTopics.forEach(topic => {
                            client.subscribe(topic, (err) => {
                                if (err) {
                                    console.error('[MQTT] Failed to subscribe topic', topic, err);
                                }
                            });
                        });
                        pendingTopics.clear();
                    }
                });

                client.on('message', (topic: string, payload: Buffer) => {
                    handleMessage(topic, payload);
                });

                client.on('close', (err?: Error) => {
                    detachDiagnostics();
                    stopHeartbeat();
                    if (err) {
                        console.error('[MQTT] Connection closed due to error', err);
                    } else {
                        console.log('[MQTT] Connection closed');
                    }
                    updateState({ status: 'CLOSED' });
                    scheduleReconnect();
                });

                client.on('offline', () => {
                    console.log('[MQTT] Connection offline');
                    stopHeartbeat();
                    updateState({ status: 'CONNECTING' });
                });

                client.on('error', (err: Error) => {
                    console.error('[MQTT] Error', err);
                    stopHeartbeat();
                    updateState({ status: 'ERROR', error: err });
                });
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
            for (const topic of options.topics) {
                currentClient.subscribe(topic, (err: Error | null) => {
                    if (err) {
                        console.error('[MQTT] Failed to subscribe', topic, err);
                    }
                });
            }
        }
    }

    function disconnect() {
        console.log('[MQTT] Disconnect requested');
        stopHeartbeat();
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
                currentClient.subscribe(topicFilter, (err) => {
                    if (err) {
                        console.error('[MQTT] Failed to subscribe to filter', topicFilter, err);
                    }
                });
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
