import Redis, { type RedisOptions } from 'ioredis';
import { logger } from '$lib/server/logger';

// Use Node.js environment check instead of SvelteKit's $app/environment
// This allows the module to work in both SvelteKit and standalone contexts
const dev = process.env.NODE_ENV !== 'production';

// Global instance for development to prevent multiple connections
declare global {
    var redisClient: Redis | undefined;
}

// Create Redis client with error handling
// Redis is used for MQTT queue, device presence, and other features
function createRedisClient(): Redis | null {
    // Use specific Redis configuration from .env if available
    const connectionUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD;
    
    // If no Redis configuration is provided, return null
    if (!connectionUrl && !host) {
        logger.info('Redis client not created - no Redis configuration found');
        return null;
    }

    logger.info(connectionUrl ? `Creating Redis client from URL` : `Creating Redis client for ${host}:${port}`);

    const options: RedisOptions = {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    };

    const client = connectionUrl
        ? new Redis(connectionUrl, options)
        : new Redis({
            host,
            port,
            password: password || undefined,
            ...options
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
