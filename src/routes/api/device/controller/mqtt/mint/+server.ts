import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { buildMqttMintPayload, getMqttBrokerUrl, mintIoTCoreCredentials } from '$lib/server/mqtt/utils/mint';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';

/**
 * POST /api/device/controller/mqtt/mint
 *
 * Mints MQTT credentials for a specific controller.
 *
 * IMPORTANT: This endpoint requires an existing controller.
 * Use GET /api/device/controller?type=<type> to retrieve/create controllers first.
 *
 * Request Body:
 * - type: Controller type (radar, camera, ble, etc.)
 * - controllerId: ID of the controller (required)
 */
export const POST: RequestHandler = restrictDevice(async ({ device, locals, request }) => {
    logger.info(`[ControllerMqttMintAPI] Received MQTT mint request for device: ${String(device.id)}`);

    const brokerUrl = getMqttBrokerUrl();
    if (!brokerUrl) {
        logger.error('[ControllerMqttMintAPI] MQTT_BROKER_URL is not configured');
        return json(
            createErrorResponse('MQTT broker URL is not configured', {
                details: 'Set MQTT_BROKER_URL in the server environment'
            }),
            { status: 500 }
        );
    }

    try {
        // Parse request body
        const body = await request.json();
        const { type, controllerId } = body;

        if (!type) {
            return json(
                createErrorResponse('Missing required field: type', {
                    details: 'Request body must include "type" field (e.g., "radar", "camera")'
                }),
                { status: 400 }
            );
        }

        if (!controllerId) {
            return json(
                createErrorResponse('Missing required field: controllerId', {
                    details: 'Request body must include "controllerId". Use GET /api/device/controller?type=<type> to retrieve/create a controller first.'
                }),
                { status: 400 }
            );
        }

        // Validate that the controller exists and belongs to this device
        const controller = await locals.prisma.controller.findFirst({
            where: {
                id: controllerId,
                deviceId: device.id,
                type: type,
                isDeleted: false
            }
        });

        if (!controller) {
            logger.warn(
                `[ControllerMqttMintAPI] Controller not found: controllerId=${controllerId}, deviceId=${device.id}, type=${type}`
            );
            return json(
                createErrorResponse('Controller not found', {
                    details: `No ${type} controller with ID ${controllerId} found for this device. Use GET /api/device/controller?type=${type} to retrieve/create one.`
                }),
                { status: 404 }
            );
        }

        logger.info(
            `[ControllerMqttMintAPI] Validated controller: ${controller.id} (${controller.type}) for device ${device.id}`
        );

        // Build MQTT username and topic patterns
        const mqttUsername = `device:${device.id}`;
        const topicPrefix = `${mqttUsername}/controller/${type}:${controllerId}`;

        const mintData = await mintIoTCoreCredentials({
            username: mqttUsername,
            pubTopics: [
                `${topicPrefix}/replies`,
                `${topicPrefix}/requests`,
                `${topicPrefix}/data`,
                `${topicPrefix}/loopback`
            ],
            subTopics: [
                `${topicPrefix}/response`,
                `${topicPrefix}/notifications`,
                `${topicPrefix}/loopback`
            ]
        });

        if (!mintData) {
            return json(
                createErrorResponse('Failed to mint MQTT credentials from IoT Core', {
                    details: 'See server logs for IoT Core mint failure details'
                }),
                { status: 502 }
            );
        }

        const { token, clientId, username } = mintData;

        logger.info(
            `[ControllerMqttMintAPI] Minted MQTT credential for controller ${controllerId} (type=${type}, clientId=${clientId})`
        );

        const effectiveUsername = username ?? mqttUsername;

        const payload = buildMqttMintPayload({
            brokerUrl,
            clientId,
            token,
            username: effectiveUsername,
            includeLegacyMqttUsername: true
        });

        // Include the controller ID in the response
        return json(
            createSuccessResponse({
                ...payload,
                controllerId: controller.id
            })
        );
    } catch (err) {
        logger.error(`[ControllerMqttMintAPI] Error: ${String(err)}`);
        return json(createErrorResponse('Internal server error'), { status: 500 });
    }
});
