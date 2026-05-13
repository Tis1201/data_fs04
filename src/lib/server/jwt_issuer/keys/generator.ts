import { randomUUID } from 'node:crypto';
import { generateKeyPair, KeyObject } from 'node:crypto';
import { promisify } from 'node:util';
import type { JwtKeyPair } from './types';

const generateKeyPairAsync = promisify(generateKeyPair);

/**
 * Generates a new JWT key pair
 * @param algorithm - The algorithm to use (RS256 or ES256)
 * @returns Promise that resolves to a JWT key pair
 */
export async function generateJwtKeyPair(algorithm: 'RS256' | 'ES256' = 'RS256'): Promise<JwtKeyPair> {
  let publicKey: string;
  let privateKey: string;

  if (algorithm === 'RS256') {
    const result = await generateKeyPairAsync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem' as const,
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem' as const,
      },
    });
    publicKey = result.publicKey.toString();
    privateKey = result.privateKey.toString();
  } else {
    const result = await generateKeyPairAsync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem' as const,
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem' as const,
      },
    });
    publicKey = result.publicKey.toString();
    privateKey = result.privateKey.toString();
  }
  
  return {
    publicKey,
    privateKey,
    keyId: randomUUID(),
    algorithm,
  };
}

/**
 * Gets a human-readable description for a key type
 * @param keyType - The key type
 * @returns A description of the key type
 */
export function getKeyTypeDescription(keyType: string): string {
  switch (keyType) {
    case 'FACTORY':
      return 'Factory Key - Used for device provisioning and initial setup';
    case 'TOKEN':
      return 'Token Key - Used for API and access token signing';
    case 'LINK':
      return 'Link Key - Used for invitation and password reset links';
    default:
      return 'Unknown Key Type';
  }
}

/**
 * Validates if a string is a valid JWT key type
 * @param keyType - The key type to validate
 * @returns True if the key type is valid
 */
export function validateKeyType(keyType: string): keyType is 'FACTORY' | 'TOKEN' | 'LINK' {
  return ['FACTORY', 'TOKEN', 'LINK'].includes(keyType);
}
