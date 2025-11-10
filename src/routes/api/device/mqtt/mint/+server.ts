import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import jwt, { type Algorithm } from 'jsonwebtoken';

import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';

export const POST: RequestHandler = restrictDevice(async ({ locals, device, userInfo }) => {
  logger.info(`[MqttMintAPI] Received request for device: ${String(userInfo.id)}`);

  const signingKey = await locals.prisma.jwtSigningKey.findFirst({
    where: {
      keyType: 'LINK',
      isPrimary: true,
      isActive: true
    }
  });

  if (!signingKey) {
    logger.error('No active signing key found');
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
        deviceId: device.id,
        accountId: device.accountId,
        userId: userInfo.id,
        deviceName: device.name
      },
      signingKey.privateKey,
      {
        algorithm,
        expiresIn: '1h',
        issuer: 'fs04',
        audience: 'https://fs04.datarealities.com',
        subject: device.id,
        keyid: signingKey.id
      }
    );

    return json(createSuccessResponse({
      jwt: token
    }));
  } catch (err) {
    logger.error(`[MqttMintAPI] Error: ${String(err)}`);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});