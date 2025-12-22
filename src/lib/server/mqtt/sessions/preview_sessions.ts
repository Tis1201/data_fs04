/********************************************************************************************
 * In-memory session management for sensor previews.
 * 
 * Preview sessions track active data streams from controllers to users.
 * The worker uses these to route data frames to the correct user topic.
 ********************************************************************************************/
import { logger } from '$lib/server/logger';

export type PreviewSession = {
    sessionId: string;
    flowId: string;
    userId: string;
    accountId: string;
    deviceId: string;
    controllerId: string;
    sensorId: string;
    startedAt: Date;
    expiresAt: Date;
    userTopic: string;  // user/<userId>:<accountId>/notifications
};

// In-memory session storage
const activePreviews = new Map<string, PreviewSession>();

/**
 * Create a new preview session
 */
export function createPreviewSession(session: PreviewSession): void {
    activePreviews.set(session.sessionId, session);
    logger.info('[PreviewSession] Created session', {
        sessionId: session.sessionId,
        flowId: session.flowId,
        controllerId: session.controllerId,
        sensorId: session.sensorId,
        expiresAt: session.expiresAt
    });
}

/**
 * Get a preview session by sessionId
 */
export function getPreviewSession(sessionId: string): PreviewSession | undefined {
    return activePreviews.get(sessionId);
}

/**
 * Get all active preview sessions for a controller
 */
export function getPreviewSessionsForController(controllerId: string): PreviewSession[] {
    const sessions: PreviewSession[] = [];
    for (const session of activePreviews.values()) {
        if (session.controllerId === controllerId && session.expiresAt > new Date()) {
            sessions.push(session);
        }
    }
    return sessions;
}

/**
 * Remove a preview session
 */
export function removePreviewSession(sessionId: string): boolean {
    const removed = activePreviews.delete(sessionId);
    if (removed) {
        logger.info('[PreviewSession] Removed session', { sessionId });
    }
    return removed;
}

/**
 * Check if a session is expired and remove it if so
 */
export function isSessionExpired(sessionId: string): boolean {
    const session = activePreviews.get(sessionId);
    if (!session) return true;

    if (session.expiresAt <= new Date()) {
        activePreviews.delete(sessionId);
        logger.info('[PreviewSession] Session expired', { sessionId });
        return true;
    }
    return false;
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of activePreviews.entries()) {
        if (session.expiresAt <= now) {
            activePreviews.delete(sessionId);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        logger.info('[PreviewSession] Cleaned up expired sessions', { count: cleanedCount });
    }

    return cleanedCount;
}

/**
 * Get total number of active sessions
 */
export function getActiveSessionCount(): number {
    return activePreviews.size;
}

/**
 * Get active sessions for a user (for rate limiting)
 */
export function getActiveSessionsForUser(userId: string): number {
    let count = 0;
    for (const session of activePreviews.values()) {
        if (session.userId === userId && session.expiresAt > new Date()) {
            count++;
        }
    }
    return count;
}
