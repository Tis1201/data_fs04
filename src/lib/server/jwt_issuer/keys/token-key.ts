import { logger } from '$lib/server/logger';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Gets the active TOKEN signing key for license signing
 * @param prisma - Prisma client instance
 * @returns Active TOKEN signing key
 * @throws Error if no active TOKEN key is found
 */
export async function getActiveTokenKey(prisma: PrismaClient | Prisma.TransactionClient) {
    try {
        const tokenKey = await prisma.jwtSigningKey.findFirst({
            where: {
                keyType: 'TOKEN',
                isActive: true,
                isPrimary: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!tokenKey) {
            logger.error('No active TOKEN signing key found');
            throw new Error(
                'No active TOKEN signing key found. Please create a TOKEN signing key first.'
            );
        }

        logger.debug(`Using TOKEN signing key: ${tokenKey.keyId}`);
        return tokenKey;
    } catch (error) {
        logger.error('Error fetching active TOKEN key:', error as Record<string, any>);
        throw error;
    }
}

/**
 * Gets all active TOKEN signing keys (for verification)
 * @param prisma - Prisma client instance
 * @returns Array of active TOKEN signing keys
 */
export async function getActiveTokenKeys(prisma: PrismaClient | Prisma.TransactionClient) {
    try {
        const tokenKeys = await prisma.jwtSigningKey.findMany({
            where: {
                keyType: 'TOKEN',
                isActive: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return tokenKeys;
    } catch (error) {
        logger.error('Error fetching active TOKEN keys:', error as Record<string, any>);
        throw error;
    }
}



