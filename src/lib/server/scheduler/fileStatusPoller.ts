// Legacy file - redirects to new modular scheduler
// This file is kept for backward compatibility but all functionality has been moved to:
// - bundleStatusScheduler.ts (main scheduler)
// - bundleEventProcessor.ts (event processing)
// - bundleTimeoutManager.ts (timeout handling)
// - bundleCleanupManager.ts (cleanup logic)
// - fileBasedPoller.ts (file-based polling)

import { 
  startBundleStatusScheduler, 
  stopBundleStatusScheduler, 
  cleanupBundleStatusScheduler 
} from './bundleStatusScheduler';

export async function startFileStatusPoller() {
  return startBundleStatusScheduler();
}

export function stopFileStatusPoller() {
  return stopBundleStatusScheduler();
}

export async function cleanupFileStatusPoller() {
  return cleanupBundleStatusScheduler();
}


