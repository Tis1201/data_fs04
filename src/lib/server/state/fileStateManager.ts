import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { logger } from '$lib/server/logger';
import type { BundleProcessingStateData, BundleStates, StateManager } from './types';
import { BundleProcessingState } from './types';

export class FileStateManager implements StateManager {
  private states: BundleStates = {};
  private readonly stateFile: string;
  private readonly gracePeriodHours: number;

  constructor() {
    this.stateFile = process.env.BUNDLE_STATE_FILE || './workings/bundle_states.json';
    this.gracePeriodHours = Number(process.env.GRACE_PERIOD_HOURS || 2);
  }

  async initialize(): Promise<void> {
    await this.loadStates();
    logger.info(`[FileStateManager] Initialized with state file: ${this.stateFile}`);
  }

  async close(): Promise<void> {
    // File-based manager doesn't need cleanup
  }

  async getBundleState(bundleId: string): Promise<BundleProcessingStateData | null> {
    await this.loadStates();
    return this.states[bundleId] || null;
  }

  async setBundleState(bundleId: string, state: BundleProcessingStateData): Promise<void> {
    this.states[bundleId] = {
      ...state,
      updatedAt: new Date()
    };
    await this.saveStates();
    logger.debug(`[FileStateManager] Updated state for bundle ${bundleId}: ${state.state}`);
  }

  async deleteBundleState(bundleId: string): Promise<void> {
    delete this.states[bundleId];
    await this.saveStates();
    logger.debug(`[FileStateManager] Deleted state for bundle ${bundleId}`);
  }

  async getProcessableBundles(): Promise<string[]> {
    await this.loadStates();
    const now = new Date();
    
    return Object.entries(this.states)
      .filter(([_, state]) => {
        // ACTIVE bundles are always processable
        if (state.state === BundleProcessingState.ACTIVE) return true;
        
        // COMPLETED bundles are never processable
        if (state.state === BundleProcessingState.COMPLETED) return false;
        
        // All other statuses (TIMEOUT_PENDING, FAILED, CANCELLED) are processable within grace period
        const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
          this.gracePeriodHours * 60 * 60 * 1000);
        return now <= gracePeriodEnd;
      })
      .map(([bundleId, _]) => bundleId);
  }

  async cleanupExpiredStates(): Promise<void> {
    await this.loadStates();
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [bundleId, state] of Object.entries(this.states)) {
      // Only clean up TIMEOUT_PENDING states that have exceeded grace period
      if (state.state === BundleProcessingState.TIMEOUT_PENDING && state.timeoutAt) {
        const gracePeriodEnd = new Date(state.timeoutAt.getTime() + 
          state.gracePeriodHours * 60 * 60 * 1000);
        
        if (now > gracePeriodEnd) {
          this.states[bundleId] = {
            ...state,
            state: BundleProcessingState.FAILED,
            updatedAt: now
          };
          cleanedCount++;
        }
      }
    }
    
    if (cleanedCount > 0) {
      await this.saveStates();
      logger.info(`[FileStateManager] Cleaned up ${cleanedCount} expired states`);
    }
  }

  private async loadStates(): Promise<void> {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = await fsp.readFile(this.stateFile, 'utf8');
        const parsed = JSON.parse(data);
        
        // Convert date strings back to Date objects
        for (const [bundleId, state] of Object.entries(parsed)) {
          const stateData = state as any; // Type assertion for parsed JSON
          this.states[bundleId] = {
            ...stateData,
            timeoutAt: stateData.timeoutAt ? new Date(stateData.timeoutAt) : null,
            lastDeviceResponse: stateData.lastDeviceResponse ? new Date(stateData.lastDeviceResponse) : null,
            updatedAt: new Date(stateData.updatedAt)
          };
        }
      }
    } catch (error) {
      logger.warn(`[FileStateManager] Failed to load states: ${error instanceof Error ? error.message : String(error)}`);
      this.states = {};
    }
  }

  private async saveStates(): Promise<void> {
    try {
      // Ensure directory exists
      await fsp.mkdir(path.dirname(this.stateFile), { recursive: true });
      
      // Convert dates to strings for JSON serialization
      const serializableStates: Record<string, any> = {};
      for (const [bundleId, state] of Object.entries(this.states)) {
        serializableStates[bundleId] = {
          bundleId: state.bundleId,
          state: state.state,
          timeoutAt: state.timeoutAt?.toISOString() || null,
          gracePeriodHours: state.gracePeriodHours,
          lastDeviceResponse: state.lastDeviceResponse?.toISOString() || null,
          updatedAt: state.updatedAt.toISOString()
        };
      }
      
      await fsp.writeFile(this.stateFile, JSON.stringify(serializableStates, null, 2));
    } catch (error) {
      logger.error(`[FileStateManager] Failed to save states: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
