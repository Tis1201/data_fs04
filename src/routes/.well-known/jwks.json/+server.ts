import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';

/**
 * GET handler for JWKS endpoint
 * Returns the public keys for JWT validation
 */
export const GET: RequestHandler = async ({ locals }) => {
  try {
    // Get active signing keys from the database
    const signingKeys = await locals.prisma.jwtSigningKey.findMany({
      where: {
        keyType: 'ACCESS',
        isActive: true
      },
      select: {
        keyId: true,
        publicKey: true,
        algorithm: true
      }
    });
    
    if (!signingKeys.length) {
      logger.warn('No active signing keys found');
      // Return empty JWKS if no keys found
      return json({ keys: [] });
    }
    
    // Format keys as JWKS
    const keys = signingKeys.map(key => {
      // In a real implementation, we would parse the public key
      // and extract the modulus and exponent for RSA keys
      // For now, we'll use a simplified format
      return {
        kty: "RSA",
        use: "sig",
        kid: key.keyId,
        alg: key.algorithm,
        n: "base64_encoded_modulus", // This would be extracted from the public key
        e: "AQAB" // Standard RSA exponent
      };
    });
    
    return json({ keys });
  } catch (error) {
    logger.error('Error retrieving JWKS', { error });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
