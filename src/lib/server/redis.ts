import Redis from 'ioredis';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';

// Check if Pushpin is enabled
const isPushpinEnabled = process.env.USE_PUSHPIN === 'true';

// Global instance for development to prevent multiple connections
declare global {
    var redisClient: Redis | undefined;
}

// Create Redis client with error handling
function createRedisClient(): Redis | null {
    // Only create Redis client if Pushpin is enabled
    if (!isPushpinEnabled) {
        logger.info('Redis client not created because USE_PUSHPIN is not set to true');
        return null;
    }
    
    // Use specific Redis configuration from .env if available
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD;
    
    logger.info(`Creating Redis client for ${host}:${port}`);
    
    const client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });

    // Error handling
    client.on('error', (err) => {
        logger.error(`Redis client error: ${err.message}`, { 
            error: err.message, 
            stack: err.stack 
        });
    });

    client.on('connect', () => {
        logger.info('Redis client connected');
    });

    client.on('reconnecting', () => {
        logger.warn('Redis client reconnecting');
    });

    return client;
}

// Use a singleton pattern similar to Prisma
const redis = global.redisClient || createRedisClient();

// In development, save to global to prevent multiple connections
if (dev && redis) {
    global.redisClient = redis;
}

export default redis;
