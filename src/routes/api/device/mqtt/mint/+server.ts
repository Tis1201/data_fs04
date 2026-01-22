import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { buildMqttMintPayload, getMqttBrokerWsUrl, mintIoTCoreCredentials } from '$lib/server/mqtt/utils/mint';

import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';

export const POST: RequestHandler = restrictDevice(async ({ device }) => {
  logger.info(`[DeviceMqttMintAPI] Received MQTT mint request for device: ${String(device.id)}`);

  const brokerUrl = getMqttBrokerWsUrl();
  if (!brokerUrl) {
    logger.error('[DeviceMqttMintAPI] MQTT_BROKER_URL_EXTERNAL is not configured');
    return json(
      createErrorResponse('MQTT broker URL is not configured', {
        details: 'Set MQTT_BROKER_URL_EXTERNAL in the server environment'
      }),
      { status: 500 }
    );
  }

  try {
    const mqttUsername = `device:${device.id}`;

    const mintData = await mintIoTCoreCredentials({
      username: mqttUsername,
      pubTopics: [
        `device/${mqttUsername}/replies`,
        `device/${mqttUsername}/requests`,
        `device/${mqttUsername}/loopback`,
        `device/${mqttUsername}/heartbeat`
      ],
      subTopics: [
        `device/${mqttUsername}/response`,
        `device/${mqttUsername}/notifications`,
        `device/${mqttUsername}/loopback`,
        `device/${mqttUsername}/heartbeat`
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
      `[DeviceMqttMintAPI] Minted MQTT credential via IoT Core for device ${device.id} (clientId=${clientId})`
    );

    const effectiveUsername = username ?? mqttUsername;

    const payload = buildMqttMintPayload({
      brokerUrl,
      clientId,
      token,
      username: effectiveUsername,
      includeLegacyMqttUsername: true
    });

    return json(createSuccessResponse(payload));
  } catch (err) {
    logger.error(`[DeviceMqttMintAPI] Error: ${String(err)}`);
    return json(createErrorResponse('Internal server error'), { status: 500 });
  }
});