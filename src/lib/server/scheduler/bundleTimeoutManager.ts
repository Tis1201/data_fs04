import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { SystemUser } from '$lib/server/messaging/interfaces/message';
import { checkAndAutoStartNextWave } from '$lib/server/messaging/handlers/device/bundleUtils';
import { updateBundleStatus } from './bundleEventProcessor';
import { getStateManager } from '$lib/server/state/stateManagerFactory';
import { TimeoutConfig, calculateBundleTimeout, getTimeoutMinutes } from '$lib/server/config/timeoutConfig';

// In-memory cache for wave timeout tracking
interface WaveTimeoutInfo {
  waveId: string;
  bundleId: string;
  startTime: number;
  timeoutMs: number;
  lastChecked: number;
}

// Hybrid cache: Redis for distributed, in-memory for single server
const waveTimeoutCache = new Map<string, WaveTimeoutInfo>();
const bundleTimeoutSettings = new Map<string, number>(); // bundleId -> timeoutMs

// Redis keys for distributed timeout tracking
const REDIS_KEYS = {
  WAVE_TIMEOUT: 'timeout:wave:',
  BUNDLE_TIMEOUT: 'timeout:bundle:',
  WAVE_TIMEOUT_SET: 'timeout:waves:active'
};

// Check if Redis is available for distributed caching
function isRedisAvailable(): boolean {
  try {
    const stateManager = getStateManager() as any;
    return stateManager && stateManager.redisClient && typeof stateManager.redisClient.sMembers === 'function';
  } catch {
    return false;
  }
}

// Cache management functions
export async function registerWaveTimeout(waveId: string, bundleId: string, startTime: Date, timeoutMs?: number) {
  const defaultTimeout = bundleTimeoutSettings.get(bundleId) || TimeoutConfig.BUNDLE_WAVE;
  const timeout = timeoutMs || defaultTimeout;
  
  const waveInfo: WaveTimeoutInfo = {
    waveId,
    bundleId,
    startTime: startTime.getTime(),
    timeoutMs: timeout,
    lastChecked: Date.now()
  };
  
  if (isRedisAvailable()) {
    // Use Redis for distributed caching
    try {
      const stateManager = getStateManager() as any;
      const redis = stateManager.redisClient;
      
      // Store wave timeout info in Redis with TTL
      const key = `${REDIS_KEYS.WAVE_TIMEOUT}${waveId}`;
      await redis.setEx(key, Math.ceil(timeout / 1000) + 300, JSON.stringify(waveInfo)); // TTL = timeout + 5min buffer
      
      // Add to active waves set
      await redis.sAdd(REDIS_KEYS.WAVE_TIMEOUT_SET, waveId);
      
      logger.info(`[BundleTimeoutManager] Registered wave ${waveId} for bundle ${bundleId} with timeout ${timeout}ms in Redis`);
    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Failed to register wave in Redis, falling back to memory: ${String(e?.message || e)}`);
      waveTimeoutCache.set(waveId, waveInfo);
    }
  } else {
    // Use in-memory cache
    waveTimeoutCache.set(waveId, waveInfo);
    logger.info(`[BundleTimeoutManager] Registered wave ${waveId} for bundle ${bundleId} with timeout ${timeout}ms in memory`);
  }
}

export async function unregisterWaveTimeout(waveId: string) {
  if (isRedisAvailable()) {
    // Remove from Redis
    try {
      const stateManager = getStateManager() as any;
      const redis = stateManager.redisClient;
      
      const key = `${REDIS_KEYS.WAVE_TIMEOUT}${waveId}`;
      await redis.del(key);
      await redis.sRem(REDIS_KEYS.WAVE_TIMEOUT_SET, waveId);
      
      logger.info(`[BundleTimeoutManager] Unregistered wave ${waveId} from Redis timeout tracking`);
    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Failed to unregister wave from Redis: ${String(e?.message || e)}`);
    }
  } else {
    // Remove from memory
    const removed = waveTimeoutCache.delete(waveId);
    if (removed) {
      logger.info(`[BundleTimeoutManager] Unregistered wave ${waveId} from memory timeout tracking`);
    }
  }
}

export async function setBundleTimeout(bundleId: string, timeoutMs: number) {
  bundleTimeoutSettings.set(bundleId, timeoutMs);
  
  if (isRedisAvailable()) {
    try {
      const stateManager = getStateManager() as any;
      const redis = stateManager.redisClient;
      
      const key = `${REDIS_KEYS.BUNDLE_TIMEOUT}${bundleId}`;
      await redis.setEx(key, 86400, timeoutMs.toString()); // 24 hour TTL
      
      logger.info(`[BundleTimeoutManager] Set bundle ${bundleId} timeout to ${timeoutMs}ms in Redis`);
    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Failed to set bundle timeout in Redis: ${String(e?.message || e)}`);
    }
  } else {
    logger.info(`[BundleTimeoutManager] Set bundle ${bundleId} timeout to ${timeoutMs}ms in memory`);
  }
}

export function getActiveWavesCount(): number {
  return waveTimeoutCache.size;
}

export function getActiveWavesForBundle(bundleId: string): WaveTimeoutInfo[] {
  return Array.from(waveTimeoutCache.values()).filter(wave => wave.bundleId === bundleId);
}

// Marks devices as FAILED due to inactivity if wave has exceeded the timeout window
export async function applyTimeouts() {
  const now = Date.now();
  
  if (isRedisAvailable()) {
    await applyTimeoutsRedis(now);
  } else {
    await applyTimeoutsMemory(now);
  }
}

// Redis-based timeout processing for distributed systems
async function applyTimeoutsRedis(now: number) {
  try {
    const stateManager = getStateManager() as any;
    const redis = stateManager.redisClient;
    
    // Get all active waves from Redis
    const activeWaves = await redis.sMembers(REDIS_KEYS.WAVE_TIMEOUT_SET);
    logger.info(`[BundleTimeoutManager] Starting Redis timeout check (${activeWaves.length} waves tracked)`);
    
    if (activeWaves.length === 0) {
      logger.debug(`[BundleTimeoutManager] No waves in Redis to check for timeout`);
      return;
    }

    // Group waves by bundle for better isolation and logging
    const wavesByBundle = new Map<string, WaveTimeoutInfo[]>();
    
    for (const waveId of activeWaves) {
      try {
        const key = `${REDIS_KEYS.WAVE_TIMEOUT}${waveId}`;
        const waveData = await redis.get(key);
        
        if (!waveData) {
          // Wave expired or was removed, clean up from set
          await redis.sRem(REDIS_KEYS.WAVE_TIMEOUT_SET, waveId);
          continue;
        }
        
        const waveInfo: WaveTimeoutInfo = JSON.parse(waveData);
        
        if (!wavesByBundle.has(waveInfo.bundleId)) {
          wavesByBundle.set(waveInfo.bundleId, []);
        }
        wavesByBundle.get(waveInfo.bundleId)!.push(waveInfo);
      } catch (e: any) {
        logger.warn(`[BundleTimeoutManager] Failed to process wave ${waveId} from Redis: ${String(e?.message || e)}`);
      }
    }

    logger.info(`[BundleTimeoutManager] Processing ${wavesByBundle.size} bundles with waves in progress (Redis)`);
    
    // Process each bundle's waves separately for better isolation
    for (const [bundleId, bundleWaves] of wavesByBundle.entries()) {
      logger.info(`[BundleTimeoutManager] Processing bundle ${bundleId} with ${bundleWaves.length} waves (Redis)`);
      await processBundleWavesFromCache(bundleId, bundleWaves, now);
    }
  } catch (e: any) {
    logger.error(`[BundleTimeoutManager] Failed to apply timeouts (Redis): ${String(e?.message || e)}`);
  }
}

// In-memory timeout processing for single server
async function applyTimeoutsMemory(now: number) {
  logger.info(`[BundleTimeoutManager] Starting in-memory timeout check (${waveTimeoutCache.size} waves tracked)`);
  
  if (waveTimeoutCache.size === 0) {
    logger.debug(`[BundleTimeoutManager] No waves in memory cache to check for timeout`);
    return;
  }

  // Group waves by bundle for better isolation and logging
  const wavesByBundle = new Map<string, WaveTimeoutInfo[]>();
  for (const wave of waveTimeoutCache.values()) {
    if (!wavesByBundle.has(wave.bundleId)) {
      wavesByBundle.set(wave.bundleId, []);
    }
    wavesByBundle.get(wave.bundleId)!.push(wave);
  }

  logger.info(`[BundleTimeoutManager] Processing ${wavesByBundle.size} bundles with waves in progress (Memory)`);
  
  try {
    // Process each bundle's waves separately for better isolation
    for (const [bundleId, bundleWaves] of wavesByBundle.entries()) {
      logger.info(`[BundleTimeoutManager] Processing bundle ${bundleId} with ${bundleWaves.length} waves (Memory)`);
      await processBundleWavesFromCache(bundleId, bundleWaves, now);
    }
  } catch (e: any) {
    logger.error(`[BundleTimeoutManager] Failed to apply timeouts (Memory): ${String(e?.message || e)}`);
  }
}

// Process waves from in-memory cache (much more efficient)
async function processBundleWavesFromCache(bundleId: string, waves: WaveTimeoutInfo[], now: number) {
  logger.info(`[BundleTimeoutManager] Processing bundle ${bundleId} with ${waves.length} waves from cache`);
  
  for (const waveInfo of waves) {
    // Check if wave is already terminal in database before processing
    try {
      const currentWave = await (prisma as any).bundleWave.findUnique({
        where: { id: waveInfo.waveId },
        select: { status: true }
      });
      
      if (currentWave && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(currentWave.status)) {
        logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: already terminal (${currentWave.status}), removing from cache`);
        
        // Publish real-time update for already-terminal wave so UI can update
        try {
          const all = await (prisma as any).bundleDeviceProgress.findMany({ where: { waveId: waveInfo.waveId } });
          const devicesTotal = all.length;
          const devicesCompleted = all.filter((r: any) => r.status === 'COMPLETED').length;
          const devicesFailed = all.filter((r: any) => r.status === 'FAILED').length;
          const waveProgress = devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0;
          
          const bundleStatusRouting = MessageFactory.createSystemMessage(
            'bundle:waveStatus',
            `subscription:bundle:${bundleId}`,
            {
              action: 'waveStatus',
              bundleId: bundleId,
              waveId: waveInfo.waveId,
              status: currentWave.status,
              progress: waveProgress,
              devicesTotal,
              devicesCompleted,
              devicesFailed,
              endTime: currentWave.status !== 'IN_PROGRESS' ? new Date().toISOString() : undefined,
              timestamp: new Date().toISOString()
            },
            SystemUser,
            { echoToSender: false }
          );
          await publisher.publish(bundleStatusRouting);
          logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Published terminal wave status update: status=${currentWave.status}, progress=${waveProgress}%`);
        } catch (updateErr: any) {
          logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} - Failed to publish terminal wave status update: ${String(updateErr?.message || updateErr)}`);
        }
        
        unregisterWaveTimeout(waveInfo.waveId);
        continue;
      }
    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Failed to check wave status for ${waveInfo.waveId}: ${String(e?.message || e)}`);
    }
    
    const elapsedMs = now - waveInfo.startTime;
    logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: elapsed=${elapsedMs}ms, timeout=${waveInfo.timeoutMs}ms`);
    
    if (elapsedMs < waveInfo.timeoutMs) {
      logger.debug(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: not timed out yet (${elapsedMs}ms < ${waveInfo.timeoutMs}ms)`);
      // Update last checked time
      waveInfo.lastChecked = now;
      continue;
    }
    
    logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: TIMED OUT after ${elapsedMs}ms`);

    try {
      // Mark any devices with PENDING/IN_PROGRESS and no recent start as FAILED
      const cutoff = new Date(now - waveInfo.timeoutMs);
      const res = await (prisma as any).bundleDeviceProgress.updateMany({
        where: {
          waveId: waveInfo.waveId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          OR: [
            { startedAt: null },
            { startedAt: { lt: cutoff } }
          ]
        },
        data: {
          status: 'FAILED',
          errorDetails: 'timeout',
          startedAt: new Date(),
          completedAt: new Date(),
          updatedBy: 'system'
        }
      });
      
      if ((res?.count ?? 0) > 0) {
        logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: marked ${res.count} device(s) FAILED due to timeout`);
      }

      // Recompute wave aggregates and publish
      const all = await (prisma as any).bundleDeviceProgress.findMany({ where: { waveId: waveInfo.waveId } });
      const devicesTotal = all.length;
      const devicesCompleted = all.filter((r: any) => r.status === 'COMPLETED').length;
      const devicesFailed = all.filter((r: any) => r.status === 'FAILED').length;
      // Use wave completion percentage instead of individual device progress
      const waveProgress = devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0;
      const waveStatus = (devicesCompleted + devicesFailed >= devicesTotal && devicesTotal > 0)
        ? (devicesFailed > 0 ? 'FAILED' : 'COMPLETED')
        : 'IN_PROGRESS';

      // Update wave status
      await (prisma as any).bundleWave.update({
        where: { id: waveInfo.waveId },
        data: {
          status: waveStatus,
          endTime: waveStatus !== 'IN_PROGRESS' ? new Date() : undefined
        }
      });

      // Update bundle status
      await updateBundleStatus(prisma, bundleId);
      
      // Publish bundle-level status update
      try {
        const bundleStatusRouting = MessageFactory.createSystemMessage(
          'bundle:waveStatus',
          `subscription:bundle:${bundleId}`,
          {
            action: 'waveStatus',
            bundleId: bundleId,
            waveId: waveInfo.waveId,
            status: waveStatus,
            progress: waveProgress,
            devicesTotal,
            devicesCompleted,
            devicesFailed,
            endTime: waveStatus !== 'IN_PROGRESS' ? new Date().toISOString() : undefined,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(bundleStatusRouting);
        logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Published bundle status update: status=${waveStatus}`);
      } catch (bundleUpdateErr: any) {
        logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} - Failed to publish bundle status update: ${String(bundleUpdateErr?.message || bundleUpdateErr)}`);
      }

      // If wave reached terminal status, try to start the next wave automatically
      if (waveStatus === 'COMPLETED' || waveStatus === 'FAILED') {
        logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId} reached terminal status due to timeout: ${waveStatus}, attempting to start next wave`);
        try {
          await checkAndAutoStartNextWave(bundleId, waveInfo.waveId);
        } catch (autoStartErr: any) {
          logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} - Failed to auto-start next wave after timeout: ${String(autoStartErr?.message || autoStartErr)}`);
        }
      }

      // Remove from cache since wave is now terminal
      unregisterWaveTimeout(waveInfo.waveId);

    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId} timeout handling failed: ${String(e?.message || e)}`);
    }
  }
}

// Sync cache with database on startup
export async function syncCacheWithDatabase() {
  logger.info(`[BundleTimeoutManager] Syncing cache with database`);
  
  try {
    // Find all waves in progress with startTime
    const waves = await (prisma as any).bundleWave.findMany({
      where: {
        status: 'IN_PROGRESS',
        startTime: { not: null }
      },
      select: { id: true, startTime: true, bundleId: true }
    });
    
    logger.info(`[BundleTimeoutManager] Found ${waves.length} waves in progress in database`);
    
    if (isRedisAvailable()) {
      // Clear Redis cache and sync with database
      try {
        const stateManager = getStateManager() as any;
        const redis = stateManager.redisClient;
        
        if (!redis || typeof redis.sMembers !== 'function') {
          throw new Error('Redis client not properly initialized or missing sMembers method');
        }
        
        // Clear existing Redis cache
        const activeWaves = await redis.sMembers(REDIS_KEYS.WAVE_TIMEOUT_SET);
        for (const waveId of activeWaves) {
          await redis.del(`${REDIS_KEYS.WAVE_TIMEOUT}${waveId}`);
        }
        await redis.del(REDIS_KEYS.WAVE_TIMEOUT_SET);
        
        // Register each wave in Redis
        for (const wave of waves) {
          await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime);
        }
        
        logger.info(`[BundleTimeoutManager] Redis cache synced with ${waves.length} waves`);
      } catch (e: any) {
        logger.warn(`[BundleTimeoutManager] Failed to sync Redis cache, falling back to memory: ${String(e?.message || e)}`);
        // Fallback to memory sync
        waveTimeoutCache.clear();
        for (const wave of waves) {
          await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime);
        }
      }
    } else {
      // Clear memory cache and sync with database
      waveTimeoutCache.clear();
      
      // Register each wave in memory
      for (const wave of waves) {
        await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime);
      }
      
      logger.info(`[BundleTimeoutManager] Memory cache synced with ${waveTimeoutCache.size} waves`);
    }
  } catch (e: any) {
    logger.error(`[BundleTimeoutManager] Failed to sync cache with database: ${String(e?.message || e)}`);
  }
}

// Manual trigger for testing - can be called from API
export async function triggerTimeoutCheck() {
  logger.info(`[BundleTimeoutManager] Manual timeout check triggered`);
  await applyTimeouts();
}