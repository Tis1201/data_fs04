/**
 * System Job: Cleanup Expired Tokens
 * 
 * Removes expired refresh tokens and sessions from the database.
 */

import type { Job } from 'bullmq';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

export interface CleanupTokensData {
    olderThanDays?: number;
}

export interface CleanupTokensResult {
    deletedTokens: number;
    deletedSessions: number;
}

export async function cleanupExpiredTokens(
    data: CleanupTokensData,
    job: Job<CleanupTokensData, CleanupTokensResult>
): Promise<CleanupTokensResult> {
    const olderThanDays = data.olderThanDays ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    logger.info(`[Jobs/cleanup-tokens] Starting cleanup (cutoff: ${cutoffDate.toISOString()})`);

    // Delete expired refresh tokens
    const prisma = getAdminPrisma();

    // Delete expired refresh tokens
    const deletedTokens = await prisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { isRevoked: true, revokedAt: { lt: cutoffDate } },
            ],
        },
    });

    // Delete expired sessions
    const deletedSessions = await prisma.session.deleteMany({
        where: {
            expiresAt: { lt: new Date() },
        },
    });

    const result: CleanupTokensResult = {
        deletedTokens: deletedTokens.count,
        deletedSessions: deletedSessions.count,
    };

    logger.info(
        `[Jobs/cleanup-tokens] Completed: deleted ${result.deletedTokens} tokens, ${result.deletedSessions} sessions`
    );

    return result;
}
