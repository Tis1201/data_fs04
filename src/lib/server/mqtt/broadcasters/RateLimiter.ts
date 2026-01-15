import { logger } from '$lib/server/logger';

/**
 * Rate limiter for MQTT broadcasts using token bucket algorithm.
 * Prevents broker overload by limiting broadcast rate per device/user/global.
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  
  private deviceBuckets = new Map<string, TokenBucket>();
  private userBuckets = new Map<string, TokenBucket>();
  private globalBucket: TokenBucket;
  
  private readonly DEVICE_CAPACITY = 10;
  private readonly DEVICE_REFILL_RATE = 10;
  private readonly USER_CAPACITY = 50;
  private readonly USER_REFILL_RATE = 50;
  private readonly GLOBAL_CAPACITY = 1000;
  private readonly GLOBAL_REFILL_RATE = 1000;
  
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60000;
  private readonly BUCKET_TTL_MS = 300000;

  private constructor() {
    this.globalBucket = {
      tokens: this.GLOBAL_CAPACITY,
      lastRefill: Date.now(),
      capacity: this.GLOBAL_CAPACITY,
      refillRate: this.GLOBAL_REFILL_RATE
    };

    this.startCleanup();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  async checkLimit(deviceId: string, userId: string): Promise<boolean> {
    const now = Date.now();

    if (!this.consumeToken(this.globalBucket, now)) {
      logger.warn('[RateLimiter] Global rate limit exceeded');
      return false;
    }

    const deviceBucket = this.getOrCreateBucket(
      this.deviceBuckets,
      deviceId,
      this.DEVICE_CAPACITY,
      this.DEVICE_REFILL_RATE
    );
    if (!this.consumeToken(deviceBucket, now)) {
      logger.warn('[RateLimiter] Device rate limit exceeded', { deviceId });
      this.globalBucket.tokens++;
      return false;
    }

    const userBucket = this.getOrCreateBucket(
      this.userBuckets,
      userId,
      this.USER_CAPACITY,
      this.USER_REFILL_RATE
    );
    if (!this.consumeToken(userBucket, now)) {
      logger.warn('[RateLimiter] User rate limit exceeded', { userId });
      this.globalBucket.tokens++;
      deviceBucket.tokens++;
      return false;
    }

    return true;
  }

  private getOrCreateBucket(
    buckets: Map<string, TokenBucket>,
    key: string,
    capacity: number,
    refillRate: number
  ): TokenBucket {
    let bucket = buckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: Date.now(),
        capacity,
        refillRate
      };
      buckets.set(key, bucket);
    }

    return bucket;
  }

  private consumeToken(bucket: TokenBucket, now: number): boolean {
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * bucket.refillRate;
    
    bucket.tokens = Math.min(
      bucket.capacity,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, bucket] of this.deviceBuckets.entries()) {
      if (now - bucket.lastRefill > this.BUCKET_TTL_MS) {
        this.deviceBuckets.delete(key);
        cleaned++;
      }
    }

    for (const [key, bucket] of this.userBuckets.entries()) {
      if (now - bucket.lastRefill > this.BUCKET_TTL_MS) {
        this.userBuckets.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('[RateLimiter] Cleaned up stale buckets', {
        cleaned,
        remaining: this.deviceBuckets.size + this.userBuckets.size
      });
    }
  }

  getStats() {
    return {
      deviceBuckets: this.deviceBuckets.size,
      userBuckets: this.userBuckets.size,
      globalTokens: this.globalBucket.tokens,
      globalCapacity: this.globalBucket.capacity,
      limits: {
        device: {
          capacity: this.DEVICE_CAPACITY,
          refillRate: this.DEVICE_REFILL_RATE
        },
        user: {
          capacity: this.USER_CAPACITY,
          refillRate: this.USER_REFILL_RATE
        },
        global: {
          capacity: this.GLOBAL_CAPACITY,
          refillRate: this.GLOBAL_REFILL_RATE
        }
      }
    };
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.deviceBuckets.clear();
    this.userBuckets.clear();
  }
}
