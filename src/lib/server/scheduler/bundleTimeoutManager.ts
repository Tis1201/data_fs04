import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { SystemUser } from '$lib/server/messaging/interfaces/message';
import { checkAndAutoStartNextWave } from '$lib/server/messaging/handlers/device/bundleUtils';
import { updateBundleStatus } from './bundleEventProcessor';
import { getStateManager } from '$lib/server/state/stateManagerFactory';
import { TimeoutConfig, calculateBundleTimeout, getTimeoutMinutes } from '$lib/server/config/timeoutConfig';
import crypto from 'crypto';

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
  
  logger.info(`[BundleTimeoutManager] Attempting to register wave ${waveId} for bundle ${bundleId} (startTime: ${startTime.toISOString()}, timeout: ${timeout}ms)`);
  
  if (isRedisAvailable()) {
    // Use Redis for distributed caching
    try {
      const stateManager = getStateManager() as any;
      const redis = stateManager.redisClient;
      
      if (!redis) {
        throw new Error('Redis client is null');
      }
      
      // Store wave timeout info in Redis with TTL
      const key = `${REDIS_KEYS.WAVE_TIMEOUT}${waveId}`;
      const ttlSeconds = Math.ceil(timeout / 1000) + 300; // TTL = timeout + 5min buffer
      await redis.setEx(key, ttlSeconds, JSON.stringify(waveInfo));
      
      // Add to active waves set
      const added = await redis.sAdd(REDIS_KEYS.WAVE_TIMEOUT_SET, waveId);
      
      // Verify registration
      const verifyKey = await redis.get(key);
      const verifySet = await redis.sIsMember(REDIS_KEYS.WAVE_TIMEOUT_SET, waveId);
      
      if (verifyKey && verifySet) {
        logger.info(`[BundleTimeoutManager] Successfully registered wave ${waveId} for bundle ${bundleId} in Redis (TTL: ${ttlSeconds}s, setAdded: ${added}, verified: true)`);
      } else {
        logger.error(`[BundleTimeoutManager] Wave ${waveId} registration verification failed (key exists: ${!!verifyKey}, in set: ${verifySet})`);
        throw new Error('Wave registration verification failed');
      }
    } catch (e: any) {
      logger.error(`[BundleTimeoutManager] Failed to register wave ${waveId} in Redis: ${String(e?.message || e)}. Stack: ${e?.stack || 'N/A'}`);
      logger.warn(`[BundleTimeoutManager] Falling back to memory cache for wave ${waveId}`);
      waveTimeoutCache.set(waveId, waveInfo);
    }
  } else {
    // Use in-memory cache
    logger.warn(`[BundleTimeoutManager] Redis not available, using memory cache for wave ${waveId}`);
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

// Remove all waves for a bundle from Redis (called when bundle active period expires)
export async function unregisterAllWavesForBundle(bundleId: string): Promise<void> {
  if (isRedisAvailable()) {
    try {
      const stateManager = getStateManager() as any;
      const redis = stateManager.redisClient;
      
      // Get all active waves from Redis
      const activeWaves = await redis.sMembers(REDIS_KEYS.WAVE_TIMEOUT_SET);
      
      // Filter waves for this bundle
      const bundleWaves: string[] = [];
      for (const waveId of activeWaves) {
        try {
          const key = `${REDIS_KEYS.WAVE_TIMEOUT}${waveId}`;
          const waveData = await redis.get(key);
          if (waveData) {
            const waveInfo: WaveTimeoutInfo = JSON.parse(waveData);
            if (waveInfo.bundleId === bundleId) {
              bundleWaves.push(waveId);
            }
          }
        } catch (e: any) {
          // Skip invalid wave data
          continue;
        }
      }
      
      // Remove all waves for this bundle
      for (const waveId of bundleWaves) {
        await unregisterWaveTimeout(waveId);
      }
      
      logger.info(`[BundleTimeoutManager] Unregistered ${bundleWaves.length} waves for bundle ${bundleId} from Redis timeout tracking`);
    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Failed to unregister waves for bundle ${bundleId}: ${String(e?.message || e)}`);
    }
  } else {
    // Remove from memory cache
    const wavesToRemove: string[] = [];
    for (const [waveId, waveInfo] of waveTimeoutCache.entries()) {
      if (waveInfo.bundleId === bundleId) {
        wavesToRemove.push(waveId);
      }
    }
    
    for (const waveId of wavesToRemove) {
      waveTimeoutCache.delete(waveId);
    }
    
    if (wavesToRemove.length > 0) {
      logger.info(`[BundleTimeoutManager] Unregistered ${wavesToRemove.length} waves for bundle ${bundleId} from memory timeout tracking`);
    }
  }
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
      
      // Log wave status for debugging
      if (!currentWave) {
        logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: not found in database, skipping`);
        continue;
      }
      
      logger.debug(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: database status = ${currentWave.status}`);
      
      // If wave is IN_PROGRESS, continue to timeout check (don't skip)
      if (currentWave.status === 'IN_PROGRESS') {
        logger.debug(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: IN_PROGRESS, proceeding to timeout check`);
        // Continue to timeout processing below
      } else if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(currentWave.status)) {
        // COMPLETED waves: Remove from Redis immediately (all devices finished, no more data expected)
        if (currentWave.status === 'COMPLETED') {
          logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: COMPLETED, removing from cache immediately`);
          unregisterWaveTimeout(waveInfo.waveId);
          continue;
        }
        
        // FAILED and CANCELLED waves: Keep in Redis until bundle active period expires
        // This allows late device responses during the active period - devices may still send updates/retry
        logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: already terminal (${currentWave.status}), KEEPING in cache until bundle active period expires (NOT removing)`);
        
        // Extend TTL for FAILED/CANCELLED waves to match bundle active period
        if (isRedisAvailable() && (currentWave.status === 'FAILED' || currentWave.status === 'CANCELLED')) {
          try {
            const bundle = await (prisma as any).bundle.findUnique({
              where: { id: bundleId },
              select: { activePeriodDays: true, scheduledAt: true }
            });
            
            if (bundle) {
              // Get actual start time (first wave's startTime)
              const firstWave = await (prisma as any).bundleWave.findFirst({
                where: { bundleId: bundleId },
                orderBy: { startTime: 'asc' },
                select: { startTime: true }
              });
              
              const actualStartTime = firstWave?.startTime || bundle.scheduledAt;
              const activePeriodDays = (bundle.activePeriodDays ?? 1);
              
              if (actualStartTime) {
                // Calculate when active period expires
                const activePeriodEnd = new Date(
                  actualStartTime.getTime() + 
                  (activePeriodDays * 24 * 60 * 60 * 1000)
                );
                
                // Calculate TTL in seconds (time until active period expires)
                const now = new Date();
                const ttlSeconds = Math.max(
                  Math.ceil((activePeriodEnd.getTime() - now.getTime()) / 1000),
                  3600 // Minimum 1 hour TTL
                );
                
                // Extend the Redis key TTL
                const stateManager = getStateManager() as any;
                const redis = stateManager.redisClient;
                const key = `${REDIS_KEYS.WAVE_TIMEOUT}${waveInfo.waveId}`;
                
                // Check if key exists before extending
                const exists = await redis.exists(key);
                if (exists) {
                  await redis.expire(key, ttlSeconds);
                  logger.info(`[BundleTimeoutManager] Extended TTL for ${currentWave.status} wave ${waveInfo.waveId} to ${ttlSeconds}s (active period ends in ${Math.round(ttlSeconds / 3600)} hours)`);
                } else {
                  // Key expired, re-register with extended TTL (convert to milliseconds)
                  const extendedTimeoutMs = ttlSeconds * 1000;
                  await registerWaveTimeout(waveInfo.waveId, bundleId, new Date(waveInfo.startTime), extendedTimeoutMs);
                  logger.info(`[BundleTimeoutManager] Re-registered ${currentWave.status} wave ${waveInfo.waveId} with extended TTL of ${ttlSeconds}s`);
                }
              }
            }
          } catch (ttlErr: any) {
            logger.warn(`[BundleTimeoutManager] Failed to extend TTL for ${currentWave.status} wave ${waveInfo.waveId}: ${String(ttlErr?.message || ttlErr)}`);
          }
        }
        
        // Note: FAILED waves remain in Redis timeout tracking until bundle active period expires
        // This allows late device responses during the active period - devices can still upload data later
        // Even if wave is FAILED, devices may send status updates during the active period
        // Wave will be removed by bundle cleanup manager when bundle active period expires
        // DO NOT call unregisterWaveTimeout() for FAILED waves here!
        
        // Publish real-time update for already-terminal wave so UI can update via MQTT
        try {
          const all = await (prisma as any).bundleDeviceProgress.findMany({ where: { waveId: waveInfo.waveId } });
          const devicesTotal = all.length;
          const devicesCompleted = all.filter((r: any) => r.status === 'COMPLETED').length;
          const devicesFailed = all.filter((r: any) => r.status === 'FAILED').length;
          const waveProgress = devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0;
          
          // Get bundle accountId for MQTT topic
          const bundle = await (prisma as any).bundle.findUnique({
            where: { id: bundleId },
            select: { accountId: true }
          });
          
          if (bundle && bundle.accountId) {
            const { publishToAccountMembers } = await import('$lib/server/mqtt/notifications/bundleNotifications');
            const { DeviceNotificationType } = await import('$lib/server/mqtt/core/publish');
            
            await publishToAccountMembers(
              prisma,
              bundle.accountId,
              DeviceNotificationType.BundleWaveStatus,
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
              }
            );
            
            logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Published terminal wave status update via MQTT: status=${currentWave.status}, progress=${waveProgress}%`);
          } else {
            logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} not found or missing accountId, skipping MQTT broadcast`);
          }
        } catch (updateErr: any) {
          logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} - Failed to publish terminal wave status update: ${String(updateErr?.message || updateErr)}`);
        }
        
        // Skip timeout processing for FAILED/CANCELLED waves, but keep in cache
        continue;
      }
    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Failed to check wave status for ${waveInfo.waveId}: ${String(e?.message || e)}`);
    }
    
    const elapsedMs = now - waveInfo.startTime;
    const elapsedMinutes = Math.round(elapsedMs / (60 * 1000));
    const timeoutMinutes = Math.round(waveInfo.timeoutMs / (60 * 1000));
    
    logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: elapsed=${elapsedMinutes}min, timeout=${timeoutMinutes}min (${elapsedMs}ms / ${waveInfo.timeoutMs}ms)`);
    
    if (elapsedMs < waveInfo.timeoutMs) {
      logger.debug(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: not timed out yet (${elapsedMinutes}min < ${timeoutMinutes}min)`);
      // Update last checked time
      waveInfo.lastChecked = now;
      continue;
    }
    
    logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId}: TIMED OUT after ${elapsedMinutes}min (timeout was ${timeoutMinutes}min)`);

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
      
      // Publish bundle-level status update via MQTT
      try {
        // Get bundle accountId for MQTT topic
        const bundle = await (prisma as any).bundle.findUnique({
          where: { id: bundleId },
          select: { accountId: true }
        });
        
        if (bundle && bundle.accountId) {
          const { publishToAccountMembers } = await import('$lib/server/mqtt/notifications/bundleNotifications');
          const { DeviceNotificationType } = await import('$lib/server/mqtt/core/publish');
          
          await publishToAccountMembers(
            prisma,
            bundle.accountId,
            DeviceNotificationType.BundleWaveStatus,
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
            }
          );
          
          logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Published bundle status update via MQTT: status=${waveStatus}`);
        } else {
          logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} not found or missing accountId, skipping MQTT broadcast`);
        }
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

      // COMPLETED waves: Remove from Redis immediately (all devices finished, no more data expected)
      // FAILED waves: Keep in Redis until bundle active period expires (devices may still send updates/retry)
      if (waveStatus === 'COMPLETED') {
        unregisterWaveTimeout(waveInfo.waveId);
        logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Removed COMPLETED wave ${waveInfo.waveId} from timeout tracking`);
      } else if (waveStatus === 'FAILED') {
        // FAILED wave: Extend TTL to match bundle active period
        try {
          const bundle = await (prisma as any).bundle.findUnique({
            where: { id: bundleId },
            select: { activePeriodDays: true, scheduledAt: true }
          });
          
          if (bundle) {
            // Get actual start time (first wave's startTime)
            const firstWave = await (prisma as any).bundleWave.findFirst({
              where: { bundleId: bundleId },
              orderBy: { startTime: 'asc' },
              select: { startTime: true }
            });
            
            const actualStartTime = firstWave?.startTime || bundle.scheduledAt;
            const activePeriodDays = (bundle.activePeriodDays ?? 1);
            
            if (actualStartTime) {
              // Calculate when active period expires
              const activePeriodEnd = new Date(
                actualStartTime.getTime() + 
                (activePeriodDays * 24 * 60 * 60 * 1000)
              );
              
              // Calculate TTL in seconds (time until active period expires)
              const now = new Date();
              const ttlSeconds = Math.max(
                Math.ceil((activePeriodEnd.getTime() - now.getTime()) / 1000),
                3600 // Minimum 1 hour TTL
              );
              
              // Extend the Redis key TTL
              if (isRedisAvailable()) {
                const stateManager = getStateManager() as any;
                const redis = stateManager.redisClient;
                const key = `${REDIS_KEYS.WAVE_TIMEOUT}${waveInfo.waveId}`;
                
                // Check if key exists before extending
                const exists = await redis.exists(key);
                if (exists) {
                  await redis.expire(key, ttlSeconds);
                  logger.info(`[BundleTimeoutManager] Extended TTL for FAILED wave ${waveInfo.waveId} to ${ttlSeconds}s (active period ends in ${Math.round(ttlSeconds / 3600)} hours)`);
                } else {
                  // Key expired, re-register with extended TTL (convert to milliseconds)
                  const extendedTimeoutMs = ttlSeconds * 1000;
                  await registerWaveTimeout(waveInfo.waveId, bundleId, new Date(waveInfo.startTime), extendedTimeoutMs);
                  logger.info(`[BundleTimeoutManager] Re-registered FAILED wave ${waveInfo.waveId} with extended TTL of ${ttlSeconds}s`);
                }
              }
            }
          }
        } catch (ttlErr: any) {
          logger.warn(`[BundleTimeoutManager] Failed to extend TTL for FAILED wave ${waveInfo.waveId}: ${String(ttlErr?.message || ttlErr)}`);
        }
        
        logger.info(`[BundleTimeoutManager] Bundle ${bundleId} - Keeping FAILED wave ${waveInfo.waveId} in Redis until bundle active period expires`);
      }

    } catch (e: any) {
      logger.warn(`[BundleTimeoutManager] Bundle ${bundleId} - Wave ${waveInfo.waveId} timeout handling failed: ${String(e?.message || e)}`);
    }
  }
}

// Sync cache with database on startup
export async function syncCacheWithDatabase() {
  logger.info(`[BundleTimeoutManager] Syncing cache with database`);
  
  try {
    // Find all waves that should be tracked:
    // 1. IN_PROGRESS waves (active waves)
    // 2. FAILED waves (need to stay until bundle active period expires)
    // 3. CANCELLED waves (need to stay until bundle active period expires)
    // Note: COMPLETED waves are NOT synced (they're removed immediately)
    const waves = await (prisma as any).bundleWave.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'FAILED', 'CANCELLED'] },
        startTime: { not: null }
      },
      select: { id: true, startTime: true, bundleId: true, status: true }
    });
    
    const inProgressCount = waves.filter((w: any) => w.status === 'IN_PROGRESS').length;
    const failedCount = waves.filter((w: any) => w.status === 'FAILED').length;
    const cancelledCount = waves.filter((w: any) => w.status === 'CANCELLED').length;
    
    logger.info(`[BundleTimeoutManager] Found ${waves.length} waves to sync (IN_PROGRESS: ${inProgressCount}, FAILED: ${failedCount}, CANCELLED: ${cancelledCount})`);
    
    if (waves.length === 0) {
      logger.info(`[BundleTimeoutManager] No waves to sync - this is normal if no bundles are currently active or failed`);
    }
    
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
        // For FAILED/CANCELLED waves, use extended TTL based on bundle active period
        // Only sync waves if bundle active period hasn't expired yet
        let syncedCount = 0;
        let skippedCount = 0;
        
        for (const wave of waves) {
          if (wave.status === 'IN_PROGRESS') {
            // IN_PROGRESS waves: always sync (they're still active)
            await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime);
            syncedCount++;
          } else if (wave.status === 'FAILED' || wave.status === 'CANCELLED') {
            // FAILED/CANCELLED waves: only sync if bundle active period hasn't expired
            try {
              const bundle = await (prisma as any).bundle.findUnique({
                where: { id: wave.bundleId },
                select: { activePeriodDays: true, scheduledAt: true }
              });
              
              if (bundle) {
                const actualStartTime = wave.startTime;
                const activePeriodDays = (bundle.activePeriodDays ?? 1);
                
                // Calculate when active period expires
                const activePeriodEnd = new Date(
                  actualStartTime.getTime() + 
                  (activePeriodDays * 24 * 60 * 60 * 1000)
                );
                
                const now = new Date();
                
                // Check if active period has expired
                if (now > activePeriodEnd) {
                  // Active period expired, skip this wave
                  logger.info(`[BundleTimeoutManager] Skipping ${wave.status} wave ${wave.id} - bundle active period expired (ended ${Math.round((now.getTime() - activePeriodEnd.getTime()) / (24 * 60 * 60 * 1000))} days ago)`);
                  skippedCount++;
                  continue;
                }
                
                // Calculate TTL based on remaining active period
                const ttlSeconds = Math.max(
                  Math.ceil((activePeriodEnd.getTime() - now.getTime()) / 1000),
                  3600 // Minimum 1 hour TTL
                );
                
                // Register with extended TTL
                const extendedTimeoutMs = ttlSeconds * 1000;
                await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime, extendedTimeoutMs);
                logger.info(`[BundleTimeoutManager] Re-registered ${wave.status} wave ${wave.id} with extended TTL of ${ttlSeconds}s (active period ends in ${Math.round(ttlSeconds / 3600)} hours)`);
                syncedCount++;
              } else {
                // Bundle not found, skip this wave
                logger.warn(`[BundleTimeoutManager] Bundle ${wave.bundleId} not found, skipping wave ${wave.id}`);
                skippedCount++;
              }
            } catch (err: any) {
              logger.warn(`[BundleTimeoutManager] Failed to check active period for ${wave.status} wave ${wave.id}, skipping: ${String(err?.message || err)}`);
              skippedCount++;
            }
          }
        }
        
        logger.info(`[BundleTimeoutManager] Sync completed: ${syncedCount} waves synced, ${skippedCount} waves skipped (active period expired or bundle not found)`);
        
        // Log summary is already done above
      } catch (e: any) {
        logger.warn(`[BundleTimeoutManager] Failed to sync Redis cache, falling back to memory: ${String(e?.message || e)}`);
        // Fallback to memory sync
        waveTimeoutCache.clear();
        let syncedCount = 0;
        let skippedCount = 0;
        
        for (const wave of waves) {
          if (wave.status === 'IN_PROGRESS') {
            await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime);
            syncedCount++;
          } else if (wave.status === 'FAILED' || wave.status === 'CANCELLED') {
            // For memory cache, also check active period and use extended timeout
            try {
              const bundle = await (prisma as any).bundle.findUnique({
                where: { id: wave.bundleId },
                select: { activePeriodDays: true, scheduledAt: true }
              });
              
              if (bundle) {
                const actualStartTime = wave.startTime;
                const activePeriodDays = (bundle.activePeriodDays ?? 1);
                const activePeriodEnd = new Date(
                  actualStartTime.getTime() + 
                  (activePeriodDays * 24 * 60 * 60 * 1000)
                );
                const now = new Date();
                
                // Check if active period has expired
                if (now > activePeriodEnd) {
                  logger.info(`[BundleTimeoutManager] Skipping ${wave.status} wave ${wave.id} - bundle active period expired`);
                  skippedCount++;
                  continue;
                }
                
                const ttlSeconds = Math.max(
                  Math.ceil((activePeriodEnd.getTime() - now.getTime()) / 1000),
                  3600
                );
                const extendedTimeoutMs = ttlSeconds * 1000;
                await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime, extendedTimeoutMs);
                syncedCount++;
              } else {
                skippedCount++;
              }
            } catch (err: any) {
              skippedCount++;
            }
          }
        }
        
        logger.info(`[BundleTimeoutManager] Memory cache sync completed: ${syncedCount} waves synced, ${skippedCount} waves skipped`);
      }
    } else {
      // Clear memory cache and sync with database
      waveTimeoutCache.clear();
      
      // Register each wave in memory
      // For FAILED/CANCELLED waves, use extended TTL based on bundle active period
      // Only sync waves if bundle active period hasn't expired yet
      let syncedCount = 0;
      let skippedCount = 0;
      
      for (const wave of waves) {
        if (wave.status === 'IN_PROGRESS') {
          await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime);
          syncedCount++;
        } else if (wave.status === 'FAILED' || wave.status === 'CANCELLED') {
          try {
            const bundle = await (prisma as any).bundle.findUnique({
              where: { id: wave.bundleId },
              select: { activePeriodDays: true, scheduledAt: true }
            });
            
            if (bundle) {
              const actualStartTime = wave.startTime;
              const activePeriodDays = (bundle.activePeriodDays ?? 1);
              const activePeriodEnd = new Date(
                actualStartTime.getTime() + 
                (activePeriodDays * 24 * 60 * 60 * 1000)
              );
              const now = new Date();
              
              // Check if active period has expired
              if (now > activePeriodEnd) {
                logger.info(`[BundleTimeoutManager] Skipping ${wave.status} wave ${wave.id} - bundle active period expired`);
                skippedCount++;
                continue;
              }
              
              const ttlSeconds = Math.max(
                Math.ceil((activePeriodEnd.getTime() - now.getTime()) / 1000),
                3600
              );
              const extendedTimeoutMs = ttlSeconds * 1000;
              await registerWaveTimeout(wave.id, wave.bundleId, wave.startTime, extendedTimeoutMs);
              syncedCount++;
            } else {
              skippedCount++;
            }
          } catch (err: any) {
            skippedCount++;
          }
        }
      }
      
      logger.info(`[BundleTimeoutManager] Memory cache sync completed: ${syncedCount} waves synced, ${skippedCount} waves skipped (active period expired or bundle not found)`);
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