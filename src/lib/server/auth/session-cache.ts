import { lucia } from './lucia';
import redis from '../redis';
import { logger } from '../logger';

const SESSION_CACHE_PREFIX = 'session:';
const SESSION_CACHE_TTL_BUFFER = 60; // Cache expires 60 seconds before session expires

/**
 * Validate session with Redis caching
 * Falls back to database if Redis is not available
 * Returns the same type as lucia.validateSession()
 */
export async function validateSessionWithCache(sessionId: string) {
    const cacheKey = `${SESSION_CACHE_PREFIX}${sessionId}`;
    
    // Try to get from cache first
    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Convert expiresAt back to Date object
                if (parsed.session) {
                    parsed.session.expiresAt = new Date(parsed.session.expiresAt);
                }
                logger.debug(`[SessionCache] Cache hit for session: ${sessionId}`);
                // Return in the same format as lucia.validateSession
                return {
                    session: parsed.session,
                    user: parsed.user
                };
            }
        } catch (error) {
            logger.warn(`[SessionCache] Error reading from cache: ${error instanceof Error ? error.message : String(error)}`);
            // Fall through to database query
        }
    }
    
    // Cache miss or Redis unavailable - query database
    logger.debug(`[SessionCache] Cache miss for session: ${sessionId}, querying database`);
    const result = await lucia.validateSession(sessionId);
    
    // Cache the result if Redis is available and session is valid
    if (redis && result.session) {
        try {
            // Calculate TTL: time until session expires minus buffer
            const expiresAt = result.session.expiresAt.getTime();
            const now = Date.now();
            const ttl = Math.max(0, Math.floor((expiresAt - now) / 1000) - SESSION_CACHE_TTL_BUFFER);
            
            if (ttl > 0) {
                // Serialize for storage (convert Date to ISO string)
                const toCache = {
                    session: {
                        ...result.session,
                        expiresAt: result.session.expiresAt.toISOString()
                    },
                    user: result.user
                };
                
                await redis.setex(cacheKey, ttl, JSON.stringify(toCache));
                logger.debug(`[SessionCache] Cached session: ${sessionId} with TTL: ${ttl}s`);
            }
        } catch (error) {
            // Don't fail the request if caching fails
            logger.warn(`[SessionCache] Error caching session: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    return result;
}

/**
 * Invalidate session cache (call when session is deleted or updated)
 */
export async function invalidateSessionCache(sessionId: string): Promise<void> {
    if (!redis) return;
    
    const cacheKey = `${SESSION_CACHE_PREFIX}${sessionId}`;
    try {
        await redis.del(cacheKey);
        logger.debug(`[SessionCache] Invalidated cache for session: ${sessionId}`);
    } catch (error) {
        logger.warn(`[SessionCache] Error invalidating cache: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Invalidate all sessions for a user (useful when user is updated or deleted)
 */
export async function invalidateUserSessionsCache(userId: string): Promise<void> {
    if (!redis) return;
    
    try {
        // Find all session keys for this user
        const pattern = `${SESSION_CACHE_PREFIX}*`;
        let cursor = '0';
        const keysToDelete: string[] = [];
        
        do {
            const [nextCursor, keys] = await redis.scan(
                cursor,
                'MATCH',
                pattern,
                'COUNT',
                100
            );
            
            cursor = nextCursor;
            
            // Check each key to see if it belongs to this user
            for (const key of keys) {
                try {
                    const cached = await redis.get(key);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (parsed.session?.userId === userId) {
                            keysToDelete.push(key);
                        }
                    }
                } catch {
                    // Skip invalid cache entries
                }
            }
        } while (cursor !== '0');
        
        // Delete all matching keys
        if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete);
            logger.debug(`[SessionCache] Invalidated ${keysToDelete.length} sessions for user: ${userId}`);
        }
    } catch (error) {
        logger.warn(`[SessionCache] Error invalidating user sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
}

