import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional: Custom key generator function */
  keyGenerator?: (event: RequestEvent) => string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  total: number;
}

/**
 * Simple in-memory rate limiter (fallback when Redis is unavailable)
 */
class MemoryRateLimiter {
  private storage: Map<string, { count: number; resetAt: number }> = new Map();

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    
    let record = this.storage.get(key);
    
    // Clean up expired entries periodically
    if (record && record.resetAt < now) {
      this.storage.delete(key);
      record = undefined;
    }
    
    if (!record) {
      record = {
        count: 0,
        resetAt: now + windowMs
      };
    }
    
    record.count++;
    this.storage.set(key, record);
    
    const allowed = record.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - record.count);
    
    return {
      allowed,
      remaining,
      resetAt: new Date(record.resetAt),
      total: config.maxRequests
    };
  }

  // Cleanup old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      if (record.resetAt < now) {
        this.storage.delete(key);
      }
    }
  }
}

/**
 * Redis-based rate limiter (preferred when Redis is available)
 */
class RedisRateLimiter {
  async check(
    redis: any,
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const redisKey = `rate_limit:${key}`;
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();
      
      // Increment the counter
      pipeline.incr(redisKey);
      
      // Get TTL to check if key exists
      pipeline.ttl(redisKey);
      
      const results = await pipeline.exec();
      
      const count = results[0][1] as number;
      const ttl = results[1][1] as number;
      
      // If TTL is -1, the key exists but has no expiration, set it
      if (ttl === -1) {
        await redis.expire(redisKey, config.windowSeconds);
      }
      // If TTL is -2, the key doesn't exist (shouldn't happen after incr)
      else if (ttl === -2) {
        await redis.expire(redisKey, config.windowSeconds);
      }
      
      const resetAt = new Date(now + (ttl > 0 ? ttl * 1000 : windowMs));
      const allowed = count <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - count);
      
      return {
        allowed,
        remaining,
        resetAt,
        total: config.maxRequests
      };
      
    } catch (error) {
      logger.error('Redis rate limit check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Fallback to allowing the request if Redis fails
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(now + windowMs),
        total: config.maxRequests
      };
    }
  }
}

// Singleton instances
const memoryLimiter = new MemoryRateLimiter();
const redisLimiter = new RedisRateLimiter();

// Cleanup memory limiter every minute
setInterval(() => memoryLimiter.cleanup(), 60000);

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(event: RequestEvent): string {
  const forwardedFor = event.request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || event.getClientAddress();
  return ip;
}

/**
 * Apply rate limiting to a request
 * @param event The request event
 * @param config Rate limit configuration
 * @returns Rate limit result or throws Response if rate limit exceeded
 */
export async function checkRateLimit(
  event: RequestEvent,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;
  const key = keyGenerator(event);
  
  let result: RateLimitResult;
  
  // Use Redis if available, otherwise fall back to memory
  if (event.locals.redis) {
    result = await redisLimiter.check(event.locals.redis, key, config);
  } else {
    result = await memoryLimiter.check(key, config);
  }
  
  return result;
}

/**
 * Middleware wrapper for rate limiting
 * @param config Rate limit configuration
 * @param handler The handler function to protect
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit<T>(
  config: RateLimitConfig,
  handler: (event: RequestEvent) => Promise<T>
) {
  return async (event: RequestEvent): Promise<T | Response> => {
    const result = await checkRateLimit(event, config);
    
    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': result.total.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.toISOString()
    };
    
    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        ip: defaultKeyGenerator(event),
        path: event.url.pathname,
        limit: result.total,
        resetAt: result.resetAt
      });
      
      return json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${result.resetAt.toISOString()}`,
          retryAfter: result.resetAt.toISOString()
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString()
          }
        }
      );
    }
    
    // Execute the handler
    const response = await handler(event);
    
    // If response is a Response object, add headers
    if (response instanceof Response) {
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    
    return response;
  };
}

/**
 * Create a key generator based on JWT device ID
 * Useful for rate limiting per device instead of per IP
 */
export function deviceIdKeyGenerator(event: RequestEvent & { deviceId?: string }): string {
  return event.deviceId || defaultKeyGenerator(event);
}

/**
 * Create a key generator based on user ID
 */
export function userIdKeyGenerator(event: RequestEvent & { auth?: { user?: { id?: string } } }): string {
  return event.auth?.user?.id || defaultKeyGenerator(event);
}

