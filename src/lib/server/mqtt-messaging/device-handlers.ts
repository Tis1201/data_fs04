import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

import { registerHandler } from './handlers';

const DEVICE_TOPIC_PREFIX = 'mqtt/device/';

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
                // Placeholder for request processing pipeline
                logger.debug(
                    `[MQTT Device Handler] Processing device request ${JSON.stringify({ deviceId, eventId: envelope.eventId })}`
                );
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
