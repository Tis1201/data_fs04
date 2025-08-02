import { json } from '@sveltejs/kit';
import { getRedisService } from '$lib/server/services/redisService';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/auth/restrict';
import { SystemRole } from '$lib/shared/roles';

/**
 * Example endpoint to demonstrate Redis usage
 * GET /api/redis-example?key=mykey
 */
export const GET = restrict(
    async ({ url, locals, auth }) => {
        try {
            // Get the key from the query parameters
            const key = url.searchParams.get('key');
            
            if (!key) {
                return json({ error: 'Key parameter is required' }, { status: 400 });
            }
            
            // Get Redis service from locals
            const redisService = getRedisService(locals);
            
            // Get the value from Redis
            const value = await redisService.get(key);
            
            // Log the authenticated user and action
            logger.debug(`User ${auth.user.id} retrieved Redis key: ${key}`);
            
            return json({
                key,
                value,
                exists: value !== null
            });
        } catch (error) {
            logger.error(`Redis example error: ${JSON.stringify(error)}`);
            return json({ error: 'Failed to access Redis' }, { status: 500 });
        }
    },
    [SystemRole.ADMIN] // Restrict to admin users
);

/**
 * Example endpoint to set a Redis value
 * POST /api/redis-example with body { key: 'mykey', value: 'myvalue', ttl: 3600 }
 */
export const POST = restrict(
    async ({ request, locals, auth }) => {
        try {
            // Parse the request body
            const body = await request.json();
            const { key, value, ttl } = body;
            
            if (!key || value === undefined) {
                return json({ error: 'Key and value are required' }, { status: 400 });
            }
            
            // Get Redis service from locals
            const redisService = getRedisService(locals);
            
            // Set the value in Redis with optional TTL
            const result = await redisService.set(key, value, ttl);
            
            // Log the authenticated user and action
            logger.debug(`User ${auth.user.id} set Redis key: ${key}`);
            
            return json({
                success: result === 'OK',
                key,
                ttl: ttl || null
            });
        } catch (error) {
            logger.error(`Redis example error: ${JSON.stringify(error)}`);
            return json({ error: 'Failed to set Redis value' }, { status: 500 });
        }
    },
    [SystemRole.ADMIN] // Restrict to admin users
);
