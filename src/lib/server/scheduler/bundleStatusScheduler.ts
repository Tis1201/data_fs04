import { logger } from '$lib/server/logger';
import { queryClickHouseEvents, testClickHouseConnection } from '$lib/server/clickhouse/client';
import { initializeStateManager, getStateManager, closeStateManager } from '$lib/server/state/stateManagerFactory';
import { eventDeduplication } from '$lib/server/state/eventDeduplication';
import { processEventsWithStateValidation, checkAndTransitionBundleState } from './bundleEventProcessor';
import { applyTimeouts } from './bundleTimeoutManager';
import { cleanupCompletedBundles } from './bundleCleanupManager';
import { startFileBasedPoller, stopFileBasedPoller } from './fileBasedPoller';

const POLL_MS = Number(process.env.FILE_STATUS_POLL_MS || 10000);
const USE_CLICKHOUSE = process.env.USE_CLICKHOUSE === 'true' || process.env.CLICKHOUSE_URL !== undefined;

let timer: NodeJS.Timeout | null = null;
let stateManagerInitialized = false;

export async function startBundleStatusScheduler() {
  if (timer) {
    logger.warn(`[BundleStatusScheduler] Already running, skipping start (timer=${!!timer})`);
    return;
  }
  
  if (USE_CLICKHOUSE) {
    logger.info(`[BundleStatusScheduler] Starting with ClickHouse (interval=${POLL_MS}ms)`);
    
    // Initialize state manager
    try {
      await initializeStateManager();
      stateManagerInitialized = true;
      logger.info('[BundleStatusScheduler] State manager initialized');
    } catch (error) {
      logger.error(`[BundleStatusScheduler] Failed to initialize state manager: ${error instanceof Error ? error.message : String(error)}`);
      startFileBasedPoller();
      return;
    }
    
    // Test ClickHouse connection
    const connected = await testClickHouseConnection();
    if (!connected) {
      logger.error('[BundleStatusScheduler] ClickHouse connection failed, falling back to file-based polling');
      startFileBasedPoller();
      return;
    }
    
    timer = setInterval(async () => {
      try {
        await pollClickHouse();
      } catch (e: any) {
        logger.warn(`[BundleStatusScheduler] ClickHouse poll error: ${String(e?.message || e)}`);
      }
    }, POLL_MS);

    logger.info(`[BundleStatusScheduler] Started successfully with ClickHouse (interval=${POLL_MS}ms)`);
  } else {
    timer = startFileBasedPoller();
  }
}

// ClickHouse polling function
async function pollClickHouse() {
  try {
    if (!stateManagerInitialized) {
      logger.warn('[BundleStatusScheduler] State manager not initialized, skipping poll');
      return;
    }

    const stateManager = getStateManager();
    
    // 1. Cleanup expired states first
    await stateManager.cleanupExpiredStates();
    
    // 2. Get only processable bundles
    const processableBundles = await stateManager.getProcessableBundles();
    
    logger.debug(`[BundleStatusScheduler] Found ${processableBundles.length} processable bundles: [${processableBundles.join(', ')}]`);
    
    if (processableBundles.length === 0) {
      logger.debug(`[BundleStatusScheduler] No processable bundles found`);
      return;
    }
    
    // 3. Query events only for processable bundles
    const events = await queryClickHouseEvents(processableBundles, 3); // 3-hour sliding window
    
    if (events.length === 0) {
      logger.debug(`[BundleStatusScheduler] No events for processable bundles`);
      return;
    }

    logger.info(`[BundleStatusScheduler] Processing ${events.length} events for ${processableBundles.length} processable bundles`);
    
    // 4. Process events with state validation and deduplication
    await processEventsWithStateValidation(events);
    
    // 5. Apply timeouts after processing events
    await applyTimeouts();
    
    // 6. Check for bundle state transitions after timeouts
    for (const bundleId of processableBundles) {
      await checkAndTransitionBundleState(bundleId);
    }
    
    // 7. Clean up old completed bundles (keep for 24 hours after completion)
    await cleanupCompletedBundles();
    
    logger.debug(`[BundleStatusScheduler] ClickHouse polling completed`);
  } catch (e: any) {
    logger.error(`[BundleStatusScheduler] ClickHouse polling failed: ${String(e?.message || e)}`);
  }
}


export function stopBundleStatusScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('[BundleStatusScheduler] Stopped');
  }
  // Also stop file-based poller if it's running
  stopFileBasedPoller();
}

export async function cleanupBundleStatusScheduler() {
  if (stateManagerInitialized) {
    try {
      await closeStateManager();
      await eventDeduplication.cleanup();
      stateManagerInitialized = false;
      logger.info('[BundleStatusScheduler] Cleaned up state manager and deduplication service');
    } catch (error) {
      logger.error(`[BundleStatusScheduler] Failed to cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
