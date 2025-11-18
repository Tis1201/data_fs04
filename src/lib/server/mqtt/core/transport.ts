import type mqtt from 'mqtt';

export interface MqttTransport {
    publish: (topic: string, payload: string | Buffer, options?: mqtt.IClientPublishOptions) => Promise<void>;
}

let activeTransport: MqttTransport | null = null;

export function registerMqttTransport(transport: MqttTransport): void {
    activeTransport = transport;
}

export function getMqttTransport(): MqttTransport {
    if (!activeTransport) {
        throw new Error('MQTT transport has not been registered. Ensure the worker has started.');
    }

    return activeTransport;
}
