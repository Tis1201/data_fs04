import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

/**
 * Result of account API key validation
 */
export interface AccountApiKeyAuth {
  valid: boolean;
  accountId: string | null;
  apiKeyId: string | null;
  error?: string;
}

/**
 * Validate an account-level API key
 * 
 * This function:
 * 1. Checks if the API key exists in the database
 * 2. Verifies the key is active
 * 3. Checks if the key has expired
 * 4. Ensures the key is associated with an account (account-level key)
 * 5. Updates the lastUsedAt timestamp
 * 
 * @param apiKey - The API key to validate
 * @param prismaClient - Prisma client instance (defaults to global prisma)
 * @returns AccountApiKeyAuth object with validation result
 */
export async function validateAccountApiKey(
  apiKey: string,
  prismaClient?: PrismaClient
): Promise<AccountApiKeyAuth> {
  const client = prismaClient || prisma;

  try {
    // Check if API key is provided
    if (!apiKey || apiKey.trim() === '') {
      logger.warn('[Account API Auth] No API key provided');
      return {
        valid: false,
        accountId: null,
        apiKeyId: null,
        error: 'API key is required'
      };
    }

    // Find API key in database
    const apiKeyRecord = await client.apiKey.findUnique({
      where: { key: apiKey },
      select: {
        id: true,
        active: true,
        expiresAt: true,
        accountId: true,
        lastUsedAt: true,
        name: true
      }
    });

    // Check if key exists
    if (!apiKeyRecord) {
      logger.warn('[Account API Auth] Invalid API key provided', {
        keyPrefix: apiKey.substring(0, 8) + '...'
      });
      return {
        valid: false,
        accountId: null,
        apiKeyId: null,
        error: 'Invalid API key'
      };
    }

    // Check if key is active
    if (!apiKeyRecord.active) {
      logger.warn('[Account API Auth] Inactive API key attempted', {
        apiKeyId: apiKeyRecord.id,
        keyName: apiKeyRecord.name
      });
      return {
        valid: false,
        accountId: null,
        apiKeyId: null,
        error: 'API key is inactive'
      };
    }

    // Check if key is expired
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      logger.warn('[Account API Auth] Expired API key attempted', {
        apiKeyId: apiKeyRecord.id,
        keyName: apiKeyRecord.name,
        expiresAt: apiKeyRecord.expiresAt
      });
      return {
        valid: false,
        accountId: null,
        apiKeyId: null,
        error: 'API key has expired'
      };
    }

    // Check if key has accountId (must be account-level key)
    if (!apiKeyRecord.accountId) {
      logger.warn('[Account API Auth] API key is not account-level', {
        apiKeyId: apiKeyRecord.id,
        keyName: apiKeyRecord.name
      });
      return {
        valid: false,
        accountId: null,
        apiKeyId: null,
        error: 'API key is not associated with an account'
      };
    }

    // Update lastUsedAt timestamp (fire and forget - don't wait for it)
    client.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() }
    }).catch((error) => {
      // Log error but don't fail the request
      logger.error('[Account API Auth] Error updating lastUsedAt', {
        apiKeyId: apiKeyRecord.id,
        error
      });
    });

    logger.info('[Account API Auth] API key validated successfully', {
      apiKeyId: apiKeyRecord.id,
      accountId: apiKeyRecord.accountId,
      keyName: apiKeyRecord.name
    });

    return {
      valid: true,
      accountId: apiKeyRecord.accountId,
      apiKeyId: apiKeyRecord.id
    };
  } catch (error) {
    logger.error('[Account API Auth] Error validating API key', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      valid: false,
      accountId: null,
      apiKeyId: null,
      error: 'Error validating API key'
    };
  }
}

