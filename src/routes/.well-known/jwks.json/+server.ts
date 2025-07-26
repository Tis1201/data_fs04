import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { createPublicKey, type KeyObject } from 'crypto';

// Cache for 5 minutes (300 seconds)
const CACHE_MAX_AGE = 300;

/**
 * JWK Public Key Interface
 * Based on RFC 7517 JSON Web Key (JWK) specification
 * @see https://datatracker.ietf.org/doc/html/rfc7517
 */
interface JwkPublicKey {
  // Required JWK parameters
  kty: string;      // Key Type (e.g., "RSA")
  use: string;      // Public Key Use (e.g., "sig" for signature)
  kid: string;      // Key ID
  alg: string;      // Algorithm (e.g., "RS256")
  
  // RSA-specific parameters
  n: string;        // Modulus
  e: string;        // Exponent
  
  // Optional parameters
  key_ops?: string[]; // Key Operations
  x5c?: string[];     // X.509 Certificate Chain
  x5t?: string;       // X.509 Certificate SHA-1 Thumbprint
  'x5t#S256'?: string; // X.509 Certificate SHA-256 Thumbprint
}

/**
 * Converts a PEM-formatted public key to a JWK (JSON Web Key)
 * @param pemKey PEM-formatted public key
 * @param keyId Key ID to use in the JWK
 * @param algorithm Algorithm to use in the JWK
 * @param isPrimary Whether this is the primary key
 * @returns JWK object with the public key components
 */
function pemToJwk(pemKey: string, keyId: string, algorithm: string, isPrimary: boolean): JwkPublicKey | null {
  try {
    // Create a KeyObject from the PEM key
    const publicKey = createPublicKey({
      key: pemKey,
      format: 'pem'
    });
    
    // Export as JWK to get the components
    const jwkExport = publicKey.export({
      format: 'jwk'
    }) as any; // Using any because the Node.js types are incomplete
    
    // Create a standard JWK object
    return {
      kty: jwkExport.kty || 'RSA',
      n: jwkExport.n || '',
      e: jwkExport.e || 'AQAB',
      kid: keyId,
      use: 'sig',
      alg: algorithm,
      key_ops: isPrimary ? ['verify'] : undefined
    };
  } catch (error) {
    logger.error('Error converting PEM to JWK', {
      error: error instanceof Error ? error.message : 'Unknown error',
      keyId
    });
    return null;
  }
}

/**
 * GET handler for JWKS endpoint
 * Returns the public keys for JWT validation
 * This is a public endpoint intended for client consumption
 */
export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  try {
    // Set cache control and security headers for public consumption
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
    
    logger.debug('Serving JWKS for public consumption');
    
    // First check if we have any keys at all to help diagnose issues
    const keyCount = await locals.prisma.jwtSigningKey.count();
    logger.debug(`Total signing keys in database: ${keyCount}`);
    
    // Get active signing keys from the database
    const signingKeys = await locals.prisma.jwtSigningKey.findMany({
      where: {
        keyType: 'TOKEN',
        isActive: true
      },
      select: {
        keyId: true,
        publicKey: true,
        algorithm: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc' // Newest first
      }
    });
    
    if (!signingKeys.length) {
      logger.warn('No active signing keys found for JWKS endpoint');
      // Return empty JWKS if no keys found
      return json({ keys: [] });
    }
    
    // Log the first key's public key format for debugging
    if (signingKeys.length > 0) {
      logger.debug('First key public key format sample', {
        keyId: signingKeys[0].keyId,
        publicKeyPreview: signingKeys[0].publicKey.substring(0, 50) + '...',
        publicKeyLength: signingKeys[0].publicKey.length
      });
    }
    
    // Transform keys to JWKS format - only include public components
    const jwks = {
      keys: signingKeys.map((key, index) => {
        try {
          // Convert PEM public key to JWK
          // The public key is stored in PEM format based on the generateJwtKeyPair function
          const isPrimary = index === 0;
          const jwk = pemToJwk(key.publicKey, key.keyId, key.algorithm, isPrimary);
          
          if (!jwk) {
            logger.error(`Failed to convert public key to JWK for key ${key.keyId}`);
            return null;
          }
          
          return jwk;
        } catch (error) {
          logger.error('Error processing public key for JWKS endpoint', { 
            keyId: key.keyId,
            error: error instanceof Error ? error.message : 'Unknown error',
            publicKeyPreview: key.publicKey.substring(0, 30) + '...'
          });
          return null;
        }
      }).filter(Boolean) // Remove null entries
    };

    logger.debug(`Returning ${jwks.keys.length} public keys in JWKS format`);
    return json(jwks);
  } catch (error) {
    // Log detailed error information for debugging
    logger.error('Error serving JWKS endpoint', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      context: 'jwks-endpoint'
    });
    
    // Return empty keyset on error to prevent breaking clients
    // This ensures the endpoint doesn't break clients even when there's an error
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
