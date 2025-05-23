import { generateJwtKeyPair } from './generator';
import type { PrismaClient } from '@prisma/client';
import type { 
  JwtSigningKey, 
  CreateJwtKeyOptions, 
  RotateJwtKeyOptions,
  JwtKeyOperationResult,
  JwtKeyType
} from './types';

/**
 * Service for managing JWT signing keys
 */
class JwtKeyService {
  /**
   * Creates a new JWT signing key
   */
  async createKey(prisma: PrismaClient, options: CreateJwtKeyOptions): Promise<JwtKeyOperationResult> {
    try {
      // Generate a new key pair
      const keyPair = await generateJwtKeyPair(options.algorithm);
      
      // If this is set to be primary, deactivate other primary keys of the same type
      if (options.isPrimary) {
        await prisma.jwtSigningKey.updateMany({
          where: { 
            keyType: options.keyType,
            isPrimary: true,
            isActive: true
          },
          data: { 
            isPrimary: false,
            updatedAt: new Date()
          },
        });
      }

      // Calculate expiration date if specified
      const expiresAt = options.expiresInDays 
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      // Create the new key
      const newKey = await prisma.jwtSigningKey.create({
        data: {
          keyId: keyPair.keyId,
          keyType: options.keyType,
          algorithm: keyPair.algorithm,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          isActive: options.isActive ?? true,
          isPrimary: options.isPrimary ?? false,
          expiresAt,
          createdById: options.createdById,
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
        message: `${options.keyType} key created successfully`,
        key: newKey,
      };
    } catch (error) {
      console.error('Error creating JWT key:', error);
      return {
        success: false,
        error: {
          message: 'Failed to create JWT key',
          code: 'KEY_CREATION_FAILED',
          details: error,
        },
      };
    }
  }

  /**
   * Rotates an existing JWT signing key
   */
  async rotateKey(prisma: PrismaClient, options: RotateJwtKeyOptions): Promise<JwtKeyOperationResult> {
    try {
      // Find the existing key
      const existingKey = await prisma.jwtSigningKey.findUnique({
        where: { id: options.keyId },
      });

      if (!existingKey) {
        return {
          success: false,
          error: {
            message: 'Key not found',
            code: 'KEY_NOT_FOUND',
          },
        };
      }

      // Generate a new key pair
      const keyPair = await generateJwtKeyPair(options.algorithm as 'RS256' | 'ES256' || existingKey.algorithm as 'RS256' | 'ES256');

      // Calculate expiration date if specified
      const expiresAt = options.expiresInDays 
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      try {
        // First update the existing key to not be primary
        await prisma.jwtSigningKey.update({
          where: { id: options.keyId },
          data: {
            isPrimary: false,
            isActive: options.deactivateOldKey === false,
            rotatedAt: new Date(),
          },
        });

        // Then create the new key
        const newKey = await prisma.jwtSigningKey.create({
          data: {
            keyId: keyPair.keyId,
            keyType: existingKey.keyType as JwtKeyType,
            algorithm: keyPair.algorithm,
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey,
            isActive: true,
            isPrimary: true,
            expiresAt,
            createdById: options.updatedById,
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
          message: `${existingKey.keyType} key rotated successfully`,
          key: newKey,
        };
      } catch (error) {
        console.error('Error in key rotation:', error);
        return {
          success: false,
          error: {
            message: 'Failed to rotate JWT key',
            code: error.code || 'KEY_ROTATION_FAILED',
            details: error.message,
          },
        };
      }
    } catch (error) {
      console.error('Error rotating JWT key:', error);
      return {
        success: false,
        error: {
          message: 'Failed to rotate JWT key',
          code: 'KEY_ROTATION_FAILED',
          details: error,
        },
      };
    }
  }

  /**
   * Gets the active primary key for a key type
   */
  async getActivePrimaryKey(prisma: PrismaClient, keyType: JwtKeyType): Promise<JwtSigningKey | null> {
    return prisma.jwtSigningKey.findFirst({
      where: {
        keyType,
        isActive: true,
        isPrimary: true,
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
  }

  /**
   * Lists all keys of a specific type
   */
  async listKeys(prisma: PrismaClient, keyType?: JwtKeyType): Promise<JwtSigningKey[]> {
    const where = keyType ? { keyType } : {};
    
    return prisma.jwtSigningKey.findMany({
      where,
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

  /**
   * Gets a key by ID
   */
  async getKeyById(prisma: PrismaClient, id: string): Promise<JwtSigningKey | null> {
    return prisma.jwtSigningKey.findUnique({
      where: { id },
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

  /**
   * Gets a key by keyId
   */
  async getKeyByKeyId(prisma: PrismaClient, keyId: string): Promise<JwtSigningKey | null> {
    return prisma.jwtSigningKey.findUnique({
      where: { keyId },
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
}

export const jwtKeyService = new JwtKeyService();
