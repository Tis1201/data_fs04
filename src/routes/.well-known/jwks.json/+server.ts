import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPublicKey } from 'crypto';
import { logger } from '$lib/server/logger';
import { getEnhancedPrisma } from '$lib/server/prisma';

const prisma = getEnhancedPrisma({
  id: 'system',  // or get from the actual user context
  systemRole: 'ADMIN'  // or get from the actual user context
});

const CACHE_MAX_AGE = 300;

interface JwkPublicKey {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
  key_ops?: string[];
}

function pemToJwk(pemKey: string, keyId: string, algorithm: string): JwkPublicKey | null {
  try {
    const publicKey = createPublicKey({ key: pemKey, format: 'pem' });
    const jwk = publicKey.export({ format: 'jwk' }) as any;

    return {
      kty: jwk.kty || 'RSA',
      n: jwk.n || '',
      e: jwk.e || 'AQAB',
      kid: keyId,
      use: 'sig',
      alg: algorithm,
      key_ops: ['verify']
    };
  } catch (error) {
    logger.error('Failed to convert PEM to JWK', {
      error: error instanceof Error ? error.message : String(error),
      keyId
    });
    return null;
  }
}

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  try {
    setHeaders({
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}`,
      'Content-Type': 'application/jwk-set+json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    logger.debug('Serving JWKS using primary active FACTORY key');

    const signingKey = await prisma.jwtSigningKey.findFirst({
      where: {
        keyType: 'TOKEN',
        isPrimary: true,
        isActive: true
      }
    });

    logger.debug(`signingKey: ${JSON.stringify(signingKey)}`);

    if (!signingKey) {
      logger.warn('No active primary FACTORY key found');
      return json({ keys: [] });
    }

    const jwk = pemToJwk(signingKey.publicKey, signingKey.keyId, signingKey.algorithm);
    if (!jwk) {
      logger.error(`Failed to generate JWK for keyId ${signingKey.keyId}`);
      return json({ keys: [] });
    }

    logger.debug(`Returning 1 JWK with kid=${jwk.kid}`);
    return json({ keys: [jwk] });

  } catch (error) {
    logger.error('Error serving JWKS endpoint', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return json(
      { keys: [] },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type': 'application/jwk-set+json'
        }
      }
    );
  }
};
