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
  const keyType = algorithm === 'RS256' ? 'rsa' : 'ec';
  const options = {
    modulusLength: algorithm === 'RS256' ? 2048 : undefined,
    namedCurve: algorithm === 'ES256' ? 'prime256v1' : undefined,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem' as const,
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem' as const,
    },
  };

  const { publicKey, privateKey } = await generateKeyPairAsync(keyType, options);
  
  return {
    publicKey: publicKey.toString(),
    privateKey: privateKey.toString(),
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
