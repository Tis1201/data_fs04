import { extractAndDecodeJwtFromRequest } from '$lib/utils/JwtHelper';
import jwt from 'jsonwebtoken';
import { logger } from '$lib/server/logger';
import {
  createErrorResponse,
  ResponseCategory,
  ResponseStatus,
  toResponse
} from '$lib/shared/response_format';

export type FactoryJWTClaims = {
  iss?: string;
  aud?: string;
  typ?: string;
  scope?: string | string[];
  jti?: string;
  iat?: number;
  exp?: number;
  sub?: string;
  [k: string]: unknown;
};

export async function logFactoryJWTClaims(locals: App.Locals, request: Request): Promise<FactoryJWTClaims> {
  // Use shared helper to extract, decode, and log
  const { claims } = extractAndDecodeJwtFromRequest(request, 'Factory JWT');
  return claims as FactoryJWTClaims;
}

/**
 * Verify Factory JWT using active FACTORY signing keys and required claims.
 * - Requires header.kid to locate key in database
 * - Verifies signature (RS/ES algorithms per stored key)
 * - Enforces aud: 'device-register', typ: 'factory', scope: includes 'device:register'
 * - Relies on jsonwebtoken to validate exp/iat
 */
export async function verifyFactoryJWT(locals: App.Locals, request: Request): Promise<FactoryJWTClaims> {
  try {
    const { token, header } = extractAndDecodeJwtFromRequest(request, 'Factory JWT');

    const kid = header.kid;
    if (!kid) {
      throw new Error('JWT missing kid');
    }

    // Fetch signing key by composite unique (keyType, keyId)
    const key = await locals.prisma.jwtSigningKey.findUnique({
      where: { keyType_keyId: { keyType: 'FACTORY', keyId: kid } }
    });
    if (!key || !key.isActive || key.keyType !== 'FACTORY') {
      throw new Error('Invalid or inactive factory signing key');
    }

    // Verify signature and audience
    const verified = jwt.verify(token, key.publicKey, {
      algorithms: [key.algorithm as jwt.Algorithm],
      audience: 'device-register'
    });

    const payload = typeof verified === 'string' ? {} : (verified as Record<string, unknown>);

    // Additional claim checks
    const typ = payload['typ'];
    if (typ !== 'factory') {
      throw new Error('Invalid typ');
    }
    const scope = payload['scope'] as unknown;
    const hasScope = Array.isArray(scope)
      ? scope.includes('device:register')
      : scope === 'device:register';
    if (!hasScope) {
      throw new Error('Missing required scope');
    }

    logger.debug('Factory JWT verified successfully');
    return payload as FactoryJWTClaims;
  } catch (err) {
    logger.warn(
      `Factory JWT verification failed: ${err instanceof Error ? err.message : String(err)}`
    );
    throw toResponse(
      createErrorResponse({
        error: 'Unauthorized',
        message: 'Invalid or unauthorized factory token',
        status: ResponseStatus.UNAUTHORIZED,
        category: ResponseCategory.DEVICE
      })
    );
  }
}