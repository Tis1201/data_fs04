import { json } from '@sveltejs/kit';
import { getRedisService } from '$lib/server/services/redisService';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

/**
 * Example endpoint to demonstrate Redis usage
 * GET /api/redis-example?key=mykey
 */
export const GET = restrict(
    async ({ url, locals, auth }: any) => {
        try {
            // Get the key from the query parameters
            const key = url.searchParams.get('key');
            
            if (!key) {
                return json({ error: 'Key parameter is required' }, { status: 400 });
            }
            
            // Get Redis service from locals
            const redisService = getRedisService(locals);
            
            if (!redisService) {
                return json({ error: 'Redis service not available. Make sure USE_PUSHPIN=true in your .env file.' }, { status: 503 });
            }
            
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
    async ({ request, locals, auth }: any) => {
        try {
            // Parse the request body
            const body = await request.json();
            const { key, value, ttl, command } = body;
            
            if (!key) {
                return json({ error: 'Key is required' }, { status: 400 });
            }
            
            // Get Redis service from locals
            const redisService = getRedisService(locals);
            
            if (!redisService) {
                return json({ error: 'Redis service not available. Make sure USE_PUSHPIN=true in your .env file.' }, { status: 503 });
            }
            
            // Handle special commands
            if (command === 'keys') {
                // For security, only allow certain patterns
                if (!key.startsWith('device:') && !key.startsWith('presence:device:')) {
                    return json({ error: 'Only device: and presence:device: key patterns are allowed for security reasons' }, { status: 403 });
                }
                
                // Use the Redis client directly for the KEYS command
                const keys = await redisService.client.keys(key);
                logger.debug(`User ${auth.user.id} executed KEYS command with pattern: ${key}`);
                
                return json({
                    success: true,
                    keys
                });
            } else if (command === 'hgetall') {
                // For security, only allow certain patterns
                if (!key.startsWith('device:') && !key.startsWith('presence:device:')) {
                    return json({ error: 'Only device: and presence:device: key patterns are allowed for security reasons' }, { status: 403 });
                }
                
                // Use the Redis client directly for the HGETALL command
                const result = await redisService.client.hgetall(key);
                logger.debug(`User ${auth.user.id} executed HGETALL command on key: ${key}`);
                
                return json({
                    success: true,
                    result
                });
            } else if (command === 'ttl') {
                // For security, only allow certain patterns
                if (!key.startsWith('device:') && !key.startsWith('presence:device:')) {
                    return json({ error: 'Only device: and presence:device: key patterns are allowed for security reasons' }, { status: 403 });
                }
                
                // Use the Redis client directly for the TTL command
                const result = await redisService.client.ttl(key);
                logger.debug(`User ${auth.user.id} executed TTL command on key: ${key}`);
                
                return json({
                    success: true,
                    result
                });
            } else if (command === 'publish') {
                // Handle publishing messages to devices via the messages channel
                // This follows the Pushpin Connection Tracker format
                
                try {
                    // Extract the device ID directly from the request body
                    const deviceId = key;
                    const messageContent = value;
                    
                    if (!deviceId || !messageContent) {
                        return json({ error: 'Message must contain device ID and content' }, { status: 400 });
                    }
                    
                    // Format the message according to the Pushpin Connection Tracker format
                    const messageObj = {
                        channel: deviceId,
                        payload: messageContent
                    };
                    
                    // Publish the message to the messages channel
                    // The Go tracker will relay this to the appropriate Pushpin channel
                    const result = await redisService.publish('messages', JSON.stringify(messageObj));
                    
                    logger.debug(`User ${auth.user.id} published message to device: ${deviceId}`);
                    
                    return json({
                        success: true,
                        recipients: result,
                        channel: deviceId
                    });
                } catch (error) {
                    logger.error(`Error publishing message: ${JSON.stringify(error)}`);
                    return json({ error: 'Invalid message format. Must be valid JSON with channel and content properties.' }, { status: 400 });
                }
            } else if (command === 'lrange') {
                // For security, only allow certain patterns
                if (!key.startsWith('device:')) {
                    return json({ error: 'Only device: key patterns are allowed for security reasons' }, { status: 403 });
                }
                
                // Parse range parameters
                const [start, stop] = value.split(' ').map(v => parseInt(v));
                
                // Use the Redis client directly for the LRANGE command
                const result = await redisService.client.lrange(key, start, stop);
                logger.debug(`User ${auth.user.id} executed LRANGE command on key: ${key}`);
                
                return json({
                    success: true,
                    result
                });
            } else {
                // Default behavior: set a value
                if (value === undefined) {
                    return json({ error: 'Value is required for SET operation' }, { status: 400 });
                }
                
                // Set the value in Redis with optional TTL
                const result = await redisService.set(key, value, ttl);
                
                // Log the authenticated user and action
                logger.debug(`User ${auth.user.id} set Redis key: ${key}`);
                
                return json({
                    success: result === 'OK',
                    key,
                    ttl: ttl || null
                });
            }
        } catch (error) {
            logger.error(`Redis example error: ${JSON.stringify(error)}`);
            return json({ error: 'Failed to set Redis value' }, { status: 500 });
        }
    },
    [SystemRole.ADMIN] // Restrict to admin users
);

/**
 * Delete a key from Redis
 * DELETE /admin/debug/redis with body { key: 'mykey' }
 */
export const DELETE = restrict(
    async ({ request, locals, auth }: any) => {
        try {
            // Parse the request body
            const body = await request.json();
            const { key } = body;
            
            if (!key) {
                return json({ error: 'Key is required' }, { status: 400 });
            }
            
            // Get Redis service from locals
            const redisService = getRedisService(locals);
            
            if (!redisService) {
                return json({ error: 'Redis service not available. Make sure USE_PUSHPIN=true in your .env file.' }, { status: 503 });
            }
            
            // Delete the key from Redis
            const result = await redisService.del(key);
            
            // Log the authenticated user and action
            logger.debug(`User ${auth.user.id} deleted Redis key: ${key}`);
            
            return json({
                success: result > 0,
                key,
                deleted: result > 0
            });
        } catch (error) {
            logger.error(`Redis delete error: ${JSON.stringify(error)}`);
            return json({ error: 'Failed to delete Redis key' }, { status: 500 });
        }
    },
    [SystemRole.ADMIN] // Restrict to admin users
);
