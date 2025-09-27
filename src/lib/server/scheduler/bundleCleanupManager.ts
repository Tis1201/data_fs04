import { logger } from '$lib/server/logger';
import { getStateManager } from '$lib/server/state/stateManagerFactory';
import { BundleProcessingState } from '$lib/server/state/types';

const CLEANUP_THRESHOLD_HOURS = Number(process.env.BUNDLE_CLEANUP_HOURS || 24); // Keep completed bundles for 24 hours

export async function cleanupCompletedBundles(): Promise<void> {
  try {
    const stateManager = getStateManager();
    const now = new Date();
    const cleanupThreshold = CLEANUP_THRESHOLD_HOURS * 60 * 60 * 1000; // Configurable hours in milliseconds
    
    // Get all bundle states
    const allBundles = await stateManager.getProcessableBundles();
    let cleanedCount = 0;
    
    for (const bundleId of allBundles) {
      const bundleState = await stateManager.getBundleState(bundleId);
      
      if (bundleState && 
          (bundleState.state === BundleProcessingState.COMPLETED || 
           bundleState.state === BundleProcessingState.FAILED || 
           bundleState.state === BundleProcessingState.CANCELLED)) {
        
        // Check if bundle has been completed for more than 24 hours
        const timeSinceCompletion = now.getTime() - bundleState.updatedAt.getTime();
        
        if (timeSinceCompletion > cleanupThreshold) {
          await stateManager.deleteBundleState(bundleId);
          cleanedCount++;
          logger.info(`[BundleCleanupManager] Cleaned up old completed bundle: ${bundleId} (completed ${Math.round(timeSinceCompletion / (60 * 60 * 1000))} hours ago)`);
        }
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`[BundleCleanupManager] Cleaned up ${cleanedCount} old completed bundles from Redis`);
    }
  } catch (error) {
    logger.warn(`[BundleCleanupManager] Failed to cleanup completed bundles: ${error instanceof Error ? error.message : String(error)}`);
  }
}
