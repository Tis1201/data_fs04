import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { getMqttTransport } from '../../core/transport';

import { registerHandler } from '../index';

const DEVICE_TOPIC_PREFIX = 'device/';

type DeviceTopicDetails = {
    deviceId: string | null;
    channel: 'requests' | 'events' | string | null;
};

function parseDeviceTopic(topic: string): DeviceTopicDetails {
    const segments = topic.split('/');
    const [, , deviceId, channel] = segments;

    return {
        deviceId: deviceId ?? null,
        channel: (channel as DeviceTopicDetails['channel']) ?? null
    };
}

export function registerDeviceHandlers(prisma: PrismaClient): void {
    registerHandler(
        DEVICE_TOPIC_PREFIX,
        async ({ topic, envelope }) => {
            const { deviceId, channel } = parseDeviceTopic(topic);

            logger.info(
                `[MQTT Device Handler] Received device message ${JSON.stringify({
                    topic,
                    deviceId,
                    channel,
                    eventId: envelope.eventId,
                    type: envelope.type
                })}`
            );

            // TODO: route to specific claim/pre-claim/device control handlers
            if (!deviceId || !channel) {
                logger.warn(
                    `[MQTT Device Handler] Unable to determine deviceId/channel from topic ${JSON.stringify({ topic })}`
                );
                return;
            }

            if (channel === 'requests') {
                // Handle RPC requests
                await handleDeviceRequest(deviceId, envelope);
            } else if (channel === 'events') {
                // Placeholder for device event stream handling
                logger.debug(
                    `[MQTT Device Handler] Processing device event ${JSON.stringify({ deviceId, eventId: envelope.eventId })}`
                );
            } else {
                logger.warn(
                    `[MQTT Device Handler] Unhandled channel ${JSON.stringify({ deviceId, channel })}`
                );
            }
        },
        prisma
    );
}

async function handleDeviceRequest(deviceId: string, envelope: any): Promise<void> {
    const { requestId, op, params } = envelope.payload || {};

    if (!requestId || !op) {
        logger.warn(`[MQTT Device Handler] Invalid RPC request: ${JSON.stringify(envelope.payload)}`);
        return;
    }

    let result: any = null;
    let error: string | undefined;

    try {
        switch (op) {
            case 'ping':
                result = { message: `pong: ${params?.message || ''}` };
                break;
            case 'echo':
                result = params || {};
                break;
            case 'add':
                const a = Number(params?.a) || 0;
                const b = Number(params?.b) || 0;
                result = { sum: a + b };
                break;
            default:
                error = `Unknown operation: ${op}`;
        }
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    const response = {
        requestId,
        op,
        result,
        error
    };

    const responseTopic = `mqtt/device/${deviceId}/response`;
    const transport = getMqttTransport();

    try {
        await transport.publish(responseTopic, JSON.stringify(response), { qos: 1 });
        logger.info(`[MQTT Device Handler] Published RPC response to ${responseTopic}: ${JSON.stringify(response)}`);
    } catch (err) {
        logger.error(`[MQTT Device Handler] Failed to publish RPC response: ${err}`);
    }
}
