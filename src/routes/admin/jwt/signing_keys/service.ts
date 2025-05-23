import { randomUUID } from 'node:crypto';
import { generateKeyPair } from 'node:crypto';
import { promisify } from 'node:util';
import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';

// Types
export type JwtKeyType = 'FACTORY' | 'TOKEN' | 'LINK';

export interface JwtSigningKey {
  id: string;
  keyId: string;
  keyType: string;
  algorithm: string;
  publicKey: string;
  privateKey: string;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt?: Date | null;
  expiresAt?: Date | null;
  createdById: string;
  createdBy?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export interface JwtKeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  algorithm: 'RS256' | 'ES256';
}

export interface CreateKeyResult {
  success: boolean;
  message?: string;
  key?: JwtSigningKey;
  error?: {
    message: string;
    code: string;
  };
}

// Helper to promisify the generateKeyPair function
const generateKeyPairAsync = promisify(generateKeyPair);

/**
 * Generates a new JWT key pair
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

  try {
    const { publicKey, privateKey } = await generateKeyPairAsync(keyType, options);
    
    return {
      publicKey: publicKey.toString(),
      privateKey: privateKey.toString(),
      keyId: randomUUID(),
      algorithm,
    };
  } catch (error) {
    logger.error('Error generating key pair:', error);
    throw error;
  }
}

/**
 * Creates a new JWT signing key
 */
export async function createKey(
  prisma: PrismaClient, 
  keyType: JwtKeyType, 
  userId: string
): Promise<CreateKeyResult> {
  try {
    // Generate a new key pair
    const keyPair = await generateJwtKeyPair('RS256');
    
    // 1. First, find all primary keys of this type
    const primaryKeys = await prisma.jwtSigningKey.findMany({
      where: { 
        keyType,
        isPrimary: true 
      }
    });
    
    // 2. Update each primary key individually to not be primary
    for (const key of primaryKeys) {
      await prisma.jwtSigningKey.update({
        where: { id: key.id },
        data: { isPrimary: false }
      });
    }
    
    // 3. Create a new key as primary
    const newKey = await prisma.jwtSigningKey.create({
      data: {
        keyId: keyPair.keyId,
        keyType: keyType,
        algorithm: keyPair.algorithm,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        isActive: true,
        isPrimary: true,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    return {
      success: true,
      message: `${keyType} key created successfully`,
      key: newKey,
    };
  } catch (error) {
    // Log detailed error information
    logger.error('Error creating JWT key:', error);
    
    // For P2002 errors, log the specific constraint that was violated
    if (error.code === 'P2002') {
      logger.error('Unique constraint violation details:', {
        constraint: error.meta?.target || 'Unknown',
        keyType: keyType
      });
    }
    
    return {
      success: false,
      error: {
        message: 'Failed to create JWT key',
        code: error.code || 'KEY_CREATION_FAILED',
        details: error.message,
        meta: error.meta
      },
    };
  }
}

/**
 * Rotates an existing JWT signing key
 */
export async function rotateKey(
  prisma: PrismaClient, 
  keyId: string, 
  userId: string
): Promise<CreateKeyResult> {
  try {
    console.log('Starting key rotation for keyId:', keyId);
    
    // Find the existing key
    const existingKey = await prisma.jwtSigningKey.findUnique({
      where: { id: keyId },
    });

    if (!existingKey) {
      console.log('Key not found with ID:', keyId);
      return {
        success: false,
        error: {
          message: 'Key not found',
          code: 'KEY_NOT_FOUND',
        },
      };
    }

    console.log('Found existing key:', {
      id: existingKey.id,
      keyType: existingKey.keyType,
      isPrimary: existingKey.isPrimary,
      isActive: existingKey.isActive
    });

    // Store the key type for later use
    const keyType = existingKey.keyType;
    
    // Generate a new key pair
    const keyPair = await generateJwtKeyPair('RS256');
    console.log('Generated new key pair with ID:', keyPair.keyId);
    
    try {
      // 1. First, update the existing key to not be primary and mark as rotated
      await prisma.jwtSigningKey.update({
        where: { id: keyId },
        data: { 
          isPrimary: false,
          rotatedAt: new Date() 
        }
      });
      
      console.log('Updated existing key to not be primary');
      
      // 2. Create a new key as primary
      const newKey = await prisma.jwtSigningKey.create({
        data: {
          keyId: keyPair.keyId,
          keyType: keyType as JwtKeyType,
          algorithm: keyPair.algorithm,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          isActive: true,
          isPrimary: true,
          createdById: userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      
      console.log('Created new primary key with ID:', newKey.id);
      
      return {
        success: true,
        message: `${keyType} key rotated successfully`,
        key: newKey,
      };
    } catch (innerError) {
      console.error('Error during key rotation operations:', innerError);
      throw innerError;
    }
  } catch (error) {
    // Log detailed error information
    logger.error('Error rotating JWT key:', error);
    
    // For P2002 errors, log the specific constraint that was violated
    if (error.code === 'P2002') {
      logger.error('Unique constraint violation details:', {
        constraint: error.meta?.target || 'Unknown'
      });
    }
    
    return {
      success: false,
      error: {
        message: 'Failed to rotate JWT key',
        code: error.code || 'KEY_ROTATION_FAILED',
        details: error.message,
        meta: error.meta
      },
    };
  }
}

/**
 * Lists all keys, optionally filtered by key type
 */
export async function listKeys(prisma: PrismaClient, keyType?: JwtKeyType): Promise<JwtSigningKey[]> {
  return prisma.jwtSigningKey.findMany({
    where: keyType ? { keyType } : undefined,
    orderBy: [
      { isPrimary: 'desc' },
      { isActive: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
