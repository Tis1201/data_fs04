import { logger } from '$lib/server/logger';
import { getStateManager } from '$lib/server/state/stateManagerFactory';
import { BundleProcessingState } from '$lib/server/state/types';
import prisma from '$lib/server/prisma';
import { unregisterAllWavesForBundle } from './bundleTimeoutManager';

export async function cleanupCompletedBundles(): Promise<void> {
  try {
    const stateManager = getStateManager();
    const now = new Date();
    
    // Get all bundle states from Redis (ensures we work with same set across all server instances)
    const allBundles = await stateManager.getProcessableBundles();
    
    // Filter to only completed/failed/cancelled bundles
    const bundleIds: string[] = [];
    for (const bundleId of allBundles) {
      const bundleState = await stateManager.getBundleState(bundleId);
      if (bundleState && 
          (bundleState.state === BundleProcessingState.COMPLETED || 
           bundleState.state === BundleProcessingState.FAILED || 
           bundleState.state === BundleProcessingState.CANCELLED)) {
        bundleIds.push(bundleId);
      }
    }
    
    if (bundleIds.length === 0) {
      return;
    }
    
    // Batch fetch all bundles at once (single query for all instances)
    // Type assertion needed until TypeScript server picks up regenerated Prisma types
    const bundles = await (prisma.bundle.findMany as any)({
      where: { id: { in: bundleIds } },
      select: { id: true, scheduledAt: true, activePeriodDays: true }
    }) as Array<{ id: string; scheduledAt: Date | null; activePeriodDays: number | null }>;
    
    // Batch fetch first wave startTime for each bundle (actual start time)
    // Get all waves with startTime, then group by bundleId to get first wave per bundle
    const waves = await prisma.bundleWave.findMany({
      where: { 
        bundleId: { in: bundleIds },
        startTime: { not: null }
      },
      select: { bundleId: true, startTime: true },
      orderBy: [{ bundleId: 'asc' }, { startTime: 'asc' }]
    });
    
    // Group by bundleId and get first wave per bundle (earliest startTime)
    const firstWaveMap = new Map<string, Date>();
    for (const wave of waves) {
      if (wave.startTime && !firstWaveMap.has(wave.bundleId)) {
        firstWaveMap.set(wave.bundleId, wave.startTime);
      }
    }
    
    // Create a map for quick bundle lookup
    const bundleMap = new Map(bundles.map(b => [b.id, b]));
    
    let cleanedCount = 0;
    for (const bundleId of bundleIds) {
      const bundleState = await stateManager.getBundleState(bundleId);
      if (!bundleState) continue;
      
      const bundle = bundleMap.get(bundleId);
      
      if (!bundle) {
        // Bundle deleted from DB, cleanup state immediately
        await stateManager.deleteBundleState(bundleId);
        cleanedCount++;
        logger.info(`[BundleCleanupManager] Cleaned up deleted bundle: ${bundleId}`);
        continue;
      }
      
      // Calculate cleanup time based on active period
      // Active period starts from actual bundle start time (when first wave actually started)
      let cleanupTime: Date;
      
      // Determine actual start time (when bundle actually began deploying)
      // Use first wave's startTime as it represents when deployment actually started
      const actualStartTime = firstWaveMap.get(bundleId) || bundle.scheduledAt;
      
      if (actualStartTime) {
        // Use actual start time + activePeriodDays
        const activePeriodDays = (bundle.activePeriodDays ?? 1); // Default to 1 day if null
        cleanupTime = new Date(
          actualStartTime.getTime() + 
          (activePeriodDays * 24 * 60 * 60 * 1000)
        );
      } else {
        // Fallback: bundle was never actually started, use completion time + default period
        // completion time = bundleState.updatedAt (when bundle reached terminal state)
        cleanupTime = new Date(
          bundleState.updatedAt.getTime() + 
          (1 * 24 * 60 * 60 * 1000) // 1 day default
        );
      }
      
      // Only cleanup if past the active period
      if (now > cleanupTime) {
        // Remove all waves for this bundle from Redis timeout tracking
        try {
          await unregisterAllWavesForBundle(bundleId);
        } catch (waveErr: any) {
          logger.warn(`[BundleCleanupManager] Failed to unregister waves for bundle ${bundleId}: ${String(waveErr?.message || waveErr)}`);
        }
        
        await stateManager.deleteBundleState(bundleId);
        cleanedCount++;
        const daysSinceStart = Math.round((now.getTime() - cleanupTime.getTime()) / (24 * 60 * 60 * 1000));
        logger.info(`[BundleCleanupManager] Cleaned up bundle: ${bundleId} (active period ended ${daysSinceStart} days ago)`);
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`[BundleCleanupManager] Cleaned up ${cleanedCount} old completed bundles from Redis`);
    }
  } catch (error) {
    logger.warn(`[BundleCleanupManager] Failed to cleanup completed bundles: ${error instanceof Error ? error.message : String(error)}`);
  }
}
