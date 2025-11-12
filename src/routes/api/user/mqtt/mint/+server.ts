import { json, type RequestHandler } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { env as privateEnv } from '$env/dynamic/private';
import jwt, { type Algorithm } from 'jsonwebtoken';

import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';

export const POST: RequestHandler = restrict(async ({ locals, auth }) => {
  const user = auth.user;
  logger.info(`[UserMqttMintAPI] Received request for user: ${String(user.id)}`);

  const signingKey = await locals.prisma.jwtSigningKey.findFirst({
    where: {
      keyType: 'LINK',
      isPrimary: true,
      isActive: true
    }
  });

  if (!signingKey) {
    logger.error('[UserMqttMintAPI] No active signing key found');
    return json(
      createErrorResponse('No active signing key found', {
        details: 'Missing signing key'
      }),
      { status: 500 }
    );
  }

  try {
    const algorithm = (signingKey.algorithm ?? 'HS256') as Algorithm;

    const token = jwt.sign(
      {
        userId: user.id,
        accountId: user.primaryAccountId ?? null,
        username: user.email,
        name: user.name
      },
      signingKey.privateKey,
      {
        algorithm,
        expiresIn: '1h',
        issuer: 'fs04',
        audience: 'https://fs04.datarealities.com',
        subject: user.id,
        keyid: signingKey.id
      }
    );

    const brokerUrl = privateEnv.MQTT_BROKER_URL;

    if (!brokerUrl) {
      logger.error('[UserMqttMintAPI] MQTT_BROKER_URL is not configured');
      return json(
        createErrorResponse('MQTT broker URL is not configured', {
          details: 'Set MQTT_BROKER_URL in the server environment'
        }),
        { status: 500 }
      );
    }

    return json(createSuccessResponse({
      jwt: token,
      brokerUrl
    }));
  } catch (err) {
    logger.error(`[UserMqttMintAPI] Error: ${String(err)}`);
    return json(createErrorResponse('Internal server error'), { status: 500 });
  }
});
