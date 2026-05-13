import { json, type RequestHandler } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { buildMqttMintPayload, getMqttBrokerWsUrl, mintIoTCoreCredentials } from '$lib/server/mqtt/utils/mint';

import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';

export const POST: RequestHandler = restrict(async (event) => {
  const { locals, auth, cookies } = event;
  const user = auth.user;
  logger.info(`[UserMqttMintAPI] Received request for user: ${String(user.id)}`);

  try {
    // Prefer current account (switch-account aware)
    const accountId =
      (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
      cookies.get('current_account_id') ??
      auth.currentAccount?.account?.id ??
      (user as { primaryAccountId?: string }).primaryAccountId ??
      null;

    const mqttUsername = `user:${user.id}:${accountId}`;
    // Use WebSocket URL for browser clients
    const brokerUrl = getMqttBrokerWsUrl();
    if (!brokerUrl) {
      logger.error('[UserMqttMintAPI] MQTT WebSocket URL is not configured');
      return json(
        createErrorResponse('MQTT broker WebSocket URL is not configured', {
          details: 'Set MQTT_BROKER_URL or MQTT_BROKER_WS_URL in the server environment'
        }),
        { status: 500 }
      );
    }

    const mintData = await mintIoTCoreCredentials({
      username: mqttUsername,
      tier: { kind: 'user', userId: user.id, accountId: accountId ?? null },
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
      logger.error('[UserMqttMintAPI] Failed to mint credentials - likely missing LINK signing key');
      return json(
        createErrorResponse('Failed to mint MQTT credentials from IoT Core', {
          code: 'INTERNAL_ERROR',
          details: 'No active primary LINK signing key found. Please create a LINK signing key in Admin → JWT → Signing Keys → Link Key. This error does not affect page loading, but MQTT real-time features will be unavailable.',
          helpUrl: '/admin/jwt/signing_keys/link'
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
