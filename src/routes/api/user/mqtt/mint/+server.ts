import { json, type RequestHandler } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { buildMqttMintPayload, getMqttBrokerUrl, mintIoTCoreCredentials } from '$lib/server/mqtt/mint';

import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';

export const POST: RequestHandler = restrict(async ({ locals, auth }) => {
  const user = auth.user;
  logger.info(`[UserMqttMintAPI] Received request for user: ${String(user.id)}`);

  try {
    const accountId = auth.currentAccount?.account.id ?? user.primaryAccountId ?? null;

    const mqttUsername = `user:${user.id}:${accountId}`;
    const brokerUrl = getMqttBrokerUrl();
    if (!brokerUrl) {
      logger.error('[UserMqttMintAPI] MQTT_BROKER_URL is not configured');
      return json(
        createErrorResponse('MQTT broker URL is not configured', {
          details: 'Set MQTT_BROKER_URL in the server environment'
        }),
        { status: 500 }
      );
    }

    const mintData = await mintIoTCoreCredentials({
      username: mqttUsername,
      pubTopics: [
        `user/${mqttUsername}/requests`,
        `user/${mqttUsername}/replies`,
        `user/${mqttUsername}/loopback`,
        `user/${mqttUsername}/heartbeat`
      ],
      subTopics: [
        `user/${mqttUsername}/response`,
        `user/${mqttUsername}/notifications`,
        `user/${mqttUsername}/loopback`
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

    const { token, clientId } = mintData;

    const payload = buildMqttMintPayload({
      brokerUrl,
      clientId,
      token,
      username: mqttUsername
    });

    return json(createSuccessResponse(payload));
  } catch (err) {
    logger.error(`[UserMqttMintAPI] Error: ${String(err)}`);
    return json(createErrorResponse('Internal server error'), { status: 500 });
  }
}, ['ADMIN', 'USER']);
