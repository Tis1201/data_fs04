import { getMqttTransport } from '../core/transport.js';

export interface PublishEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
    eventId: string;
    payload: TPayload;
    correlationId?: string;
    source?: string;
}

export async function publishEnvelope(topic: string, envelope: PublishEnvelope): Promise<void> {
    const transport = getMqttTransport();
    await transport.publish(topic, JSON.stringify(envelope));
}
