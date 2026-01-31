/**
 * Create MQTT client and wire connect/message/close/offline/error events via callbacks.
 * Caller owns the client and cleanup; this module only does the create + subscribe.
 */

import type { MqttClient } from 'mqtt';

export interface CreateMqttConnectionParams {
    brokerUrl: string;
    connectionOptions: Record<string, unknown>;
    loadMqtt: () => Promise<{
        connect?: (url: string, options: Record<string, unknown>) => MqttClient;
        default?: 
            | ((url: string, options: Record<string, unknown>) => MqttClient)
            | { connect?: (url: string, options: Record<string, unknown>) => MqttClient };
    }>;
    attachStreamDiagnostics: (client: MqttClient) => () => void;
    onConnect: (client: MqttClient) => void;
    onMessage: (topic: string, payload: Buffer) => void;
    onClose: (err?: Error) => void;
    onOffline: () => void;
    onError: (err: Error) => void;
}

export interface CreateMqttConnectionResult {
    client: MqttClient;
    streamCleanup: () => void;
}

export async function createMqttConnection(
    params: CreateMqttConnectionParams
): Promise<CreateMqttConnectionResult> {
    const {
        brokerUrl,
        connectionOptions,
        loadMqtt,
        attachStreamDiagnostics: attachDiagnostics,
        onConnect,
        onMessage,
        onClose,
        onOffline,
        onError
    } = params;

    const mqttModule = await loadMqtt();
    const potentialConnect =
        mqttModule.connect ??
        (typeof mqttModule.default === 'function' ? mqttModule.default : mqttModule.default?.connect);

    if (typeof potentialConnect !== 'function') {
        throw new Error('mqtt.connect function unavailable');
    }

    const client = potentialConnect(brokerUrl, connectionOptions);
    const streamCleanup = attachDiagnostics(client);

    client.on('connect', () => onConnect(client));
    client.on('message', (topic: string, payload: Buffer) => onMessage(topic, payload));
    client.on('close', (err?: Error) => onClose(err));
    client.on('offline', () => onOffline());
    client.on('error', (err: Error) => onError(err));

    return { client, streamCleanup };
}
