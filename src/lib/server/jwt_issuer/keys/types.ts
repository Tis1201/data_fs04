import type { JwtSigningKey as PrismaJwtSigningKey } from '@prisma/client';

export type JwtKeyType = 'FACTORY' | 'TOKEN' | 'LINK';

/**
 * Represents a JWT signing key in the database
 * @property {string} id - Unique identifier for the key
 * @property {string} keyId - Unique identifier for the key pair
 * @property {JwtKeyType} keyType - Type of the key (FACTORY, TOKEN, LINK)
 * @property {string} algorithm - Signing algorithm (e.g., 'RS256')
 * @property {boolean} isActive - Whether the key is currently active
 * @property {boolean} isPrimary - Whether this is the primary key for its type
 * @property {Date} createdAt - When the key was created
 * @property {Date} updatedAt - When the key was last updated
 * @property {Date | null} rotatedAt - When the key was rotated (if applicable)
 */
export interface JwtSigningKey {
  id: string;
  keyId: string;
  keyType: string; // Using string to match the schema definition
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
  updatedById?: string | null;
  updatedBy?: {
    id: string;
    name?: string;
    email?: string;
  } | null;
}

/**
 * Options for creating a new JWT key
 */
export interface CreateJwtKeyOptions {
  keyType: JwtKeyType;
  algorithm: 'RS256' | 'ES256';
  expiresInDays?: number | null;
  isActive?: boolean;
  isPrimary?: boolean;
  createdById: string;
}

/**
 * Options for rotating a JWT key
 */
export interface RotateJwtKeyOptions {
  keyId: string;
  algorithm?: 'RS256' | 'ES256';
  expiresInDays?: number | null;
  deactivateOldKey?: boolean;
  updatedById?: string;
}

/**
 * Result of a JWT key operation
 */
export interface JwtKeyOperationResult {
  success: boolean;
  message?: string;
  key?: JwtSigningKey;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

/**
 * Key pair for JWT signing
 */
export interface JwtKeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  algorithm: 'RS256' | 'ES256';
}
