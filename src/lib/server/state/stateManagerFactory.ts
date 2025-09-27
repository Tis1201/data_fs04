import { logger } from '$lib/server/logger';
import { FileStateManager } from './fileStateManager';
import { RedisStateManager } from './redisStateManager';
import type { StateManager } from './types';

let stateManager: StateManager | null = null;

export function createStateManager(): StateManager {
  if (stateManager) {
    return stateManager;
  }

  const backend = process.env.STATE_BACKEND || 'file';

  switch (backend) {
    case 'redis':
      stateManager = new RedisStateManager();
      logger.info('[StateManagerFactory] Created Redis state manager');
      break;
    case 'file':
    default:
      stateManager = new FileStateManager();
      logger.info('[StateManagerFactory] Created file-based state manager');
      break;
  }

  return stateManager;
}

export async function initializeStateManager(): Promise<StateManager> {
  const manager = createStateManager();
  await manager.initialize();
  return manager;
}

export async function closeStateManager(): Promise<void> {
  if (stateManager) {
    await stateManager.close();
    stateManager = null;
  }
}

export function getStateManager(): StateManager {
  if (!stateManager) {
    throw new Error('State manager not initialized. Call initializeStateManager() first.');
  }
  return stateManager;
}
