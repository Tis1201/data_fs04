/**
 * Session Helper with Cronjob Integration
 * 
 * Wraps lucia session creation to automatically create expiration cronjobs
 */

import { lucia } from './lucia';
import { upsertEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

/**
 * Create a session and automatically set up expiration cronjob
 * 
 * @param userId - User ID for the session
 * @param attributes - Session attributes
 * @param prisma - Prisma client instance
 * @returns Created session
 */
export async function createSessionWithCronjob(
    userId: string,
    attributes: Record<string, any>,
    prisma: PrismaClient
) {
    // Create session using lucia
    const session = await lucia.createSession(userId, attributes);

    // Create cronjob for session expiration
    try {
        await upsertEntityExpirationCronjob(prisma, {
            entityType: 'session',
            entityId: session.id,
            expiresAt: session.expiresAt,
            action: 'delete',
            userId: userId
        });
        
        logger.debug(`[SessionHelper] Created expiration cronjob for session ${session.id}`);
    } catch (error) {
        // Don't fail session creation if cronjob creation fails
        logger.error(`[SessionHelper] Failed to create expiration cronjob for session ${session.id}:`, {
            error: error instanceof Error ? error.message : String(error)
        });
    }

    return session;
}

