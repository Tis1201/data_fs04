import type mqtt from 'mqtt';

/********************************************************************************************
 * Contract for the worker-owned transport used by MQTT helpers.
 ********************************************************************************************/
export interface MqttTransport {
    publish: (topic: string, payload: string | Buffer, options?: mqtt.IClientPublishOptions) => Promise<void>;
}

let activeTransport: MqttTransport | null = null;

/********************************************************************************************
 * Register the concrete transport (called once after MQTT client connects).
 ********************************************************************************************/
export function registerMqttTransport(transport: MqttTransport): void {
    activeTransport = transport;
}

/********************************************************************************************
 * Check if MQTT transport is available (e.g. in worker process). In the web app it is not.
 ********************************************************************************************/
export function isMqttTransportAvailable(): boolean {
    return activeTransport != null;
}

/********************************************************************************************
 * Retrieve the active transport; errors if the worker is not connected yet.
 ********************************************************************************************/
export function getMqttTransport(): MqttTransport {
    if (!activeTransport) {
        throw new Error('MQTT transport has not been registered. Ensure the worker has started.');
    }

    return activeTransport;
}
