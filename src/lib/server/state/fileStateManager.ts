import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { logger } from '$lib/server/logger';
import type { BundleProcessingStateData, BundleStates, StateManager } from './types';
import { BundleProcessingState } from './types';
import { getAdminPrisma } from '$lib/server/prisma';

export class FileStateManager implements StateManager {
  private states: BundleStates = {};
  private readonly stateFile: string;
  private readonly gracePeriodHours: number;
  
  // FileStateManager doesn't have Redis client
  get redisClient(): null {
    return null;
  }

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
    
    const processableBundles: string[] = [];
    const failedCancelledBundles: Array<{ bundleId: string; state: BundleProcessingStateData }> = [];
    
    // First pass: categorize bundles
    for (const [bundleId, state] of Object.entries(this.states)) {
      // ACTIVE bundles are always processable
      if (state.state === BundleProcessingState.ACTIVE) {
        processableBundles.push(bundleId);
      }
      // COMPLETED bundles are never processable
      else if (state.state === BundleProcessingState.COMPLETED) {
        continue;
      }
      // TIMEOUT_PENDING bundles use fixed grace period
      else if (state.state === BundleProcessingState.TIMEOUT_PENDING) {
        const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
          this.gracePeriodHours * 60 * 60 * 1000);
        if (now <= gracePeriodEnd) {
          processableBundles.push(bundleId);
        }
      }
      // FAILED and CANCELLED bundles use bundle's active period (not fixed grace period)
      else if (state.state === BundleProcessingState.FAILED || state.state === BundleProcessingState.CANCELLED) {
        failedCancelledBundles.push({ bundleId, state });
      }
    }
    
    // Batch fetch bundle data for FAILED/CANCELLED bundles to check active period
    if (failedCancelledBundles.length > 0) {
      try {
        const prisma = getAdminPrisma();
        const bundleIds = failedCancelledBundles.map(b => b.bundleId);
        
        // Batch fetch bundle data
        const bundleData = await (prisma as any).bundle.findMany({
          where: { id: { in: bundleIds } },
          select: { id: true, scheduledAt: true, activePeriodDays: true }
        });
        
        // Batch fetch first wave start times
        const firstWaves = await (prisma as any).bundleWave.findMany({
          where: { bundleId: { in: bundleIds } },
          select: { bundleId: true, startTime: true },
          orderBy: { startTime: 'asc' }
        });
        
        // Group first waves by bundleId (get the earliest startTime for each bundle)
        const firstWaveMap = new Map<string, Date>();
        for (const wave of firstWaves) {
          if (wave.startTime && (!firstWaveMap.has(wave.bundleId) || wave.startTime < firstWaveMap.get(wave.bundleId)!)) {
            firstWaveMap.set(wave.bundleId, wave.startTime);
          }
        }
        
        // Create bundle data map
        type BundleData = { id: string; scheduledAt: Date | null; activePeriodDays: number | null };
        const bundleDataMap = new Map<string, BundleData>(bundleData.map((b: any) => [b.id, b]));
        
        // Check active period for each FAILED/CANCELLED bundle
        for (const { bundleId, state } of failedCancelledBundles) {
          const bundle = bundleDataMap.get(bundleId);
          if (!bundle) {
            // Bundle not found, use fallback grace period
            const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
              this.gracePeriodHours * 60 * 60 * 1000);
            if (now <= gracePeriodEnd) {
              processableBundles.push(bundleId);
            }
            continue;
          }
          
          // Get actual start time (first wave's startTime - when deployment actually began)
          const actualStartTime = firstWaveMap.get(bundleId) || bundle.scheduledAt;
          const activePeriodDays = (bundle.activePeriodDays ?? 1); // Default to 1 day if null
          
          let activePeriodEnd: Date;
          if (actualStartTime) {
            activePeriodEnd = new Date(
              actualStartTime.getTime() + 
              (activePeriodDays * 24 * 60 * 60 * 1000)
            );
          } else {
            // Fallback: bundle was never actually started, use bundle state updatedAt + default active period
            activePeriodEnd = new Date(
              state.updatedAt.getTime() + 
              (1 * 24 * 60 * 60 * 1000) // 1 day default
            );
          }
          
          // Include bundle if still within active period
          if (now <= activePeriodEnd) {
            processableBundles.push(bundleId);
          }
        }
      } catch (error) {
        logger.warn(`[FileStateManager] Failed to check active period for FAILED/CANCELLED bundles: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback: use grace period for all FAILED/CANCELLED bundles
        for (const { bundleId, state } of failedCancelledBundles) {
          const gracePeriodEnd = new Date(state.updatedAt.getTime() + 
            this.gracePeriodHours * 60 * 60 * 1000);
          if (now <= gracePeriodEnd) {
            processableBundles.push(bundleId);
          }
        }
      }
    }
    
    return processableBundles;
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
