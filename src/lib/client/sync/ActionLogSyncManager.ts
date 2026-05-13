import { browser } from '$app/environment';
import { mqttClient } from '../mqtt/mqttClient';
import type { ActionLog } from '../actionHandlers/types';
import { ClientMessageOptimizer, type OptimizedMessage } from './MessageOptimizer';

/**
 * Maintains synchronized replica of action logs from the database.
 * Subscribes to MQTT events with complete DB records and handles sequence gap detection.
 */
interface ActionLogEvent {
  type: 'created' | 'updated' | 'deleted';
  logId: string;
  deviceId: string;
  sequenceNumber: number;
  dbRecord: ActionLog;
  timestamp: string;
}

export class ActionLogSyncManager {
  private deviceId!: string;
  private getLogs!: () => ActionLog[];
  private setLogs!: (logs: ActionLog[]) => void;
  
  private deviceSequences = new Map<string, { sequence: number; lastAccess: number }>();
  private syncInProgress = new Set<string>();
  private unsubscribeFunctions: (() => void)[] = [];
  private periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string = this.generateSessionId();
  private activityRefreshTimer: ReturnType<typeof setInterval> | null = null;
  
  constructor(
    deviceId: string,
    getLogs: () => ActionLog[],
    setLogs: (logs: ActionLog[]) => void
  ) {
    if (!browser) {
      return;
    }

    this.deviceId = deviceId;
    this.getLogs = getLogs;
    this.setLogs = setLogs;

    this.setupMQTTSubscription();
    this.startPeriodicSync();
    this.startMemoryCleanup();
    
    this.markDeviceActive().catch(error => {
      console.error('[ActionLogSyncManager] Failed to mark device active on init', {
        deviceId: this.deviceId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    
    this.fetchInitialLogs();
    this.startActivityRefresh();
  }

  private async fetchInitialLogs(): Promise<void> {
    await this.triggerResync(this.deviceId);
  }

  private startMemoryCleanup(): void {
    if (!browser) return;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const TTL = 10 * 60 * 1000;
      
      for (const [deviceId, data] of this.deviceSequences.entries()) {
        if (now - data.lastAccess > TTL) {
          this.deviceSequences.delete(deviceId);
        }
      }
    }, 60000);
  }

  private setupMQTTSubscription(): void {
    if (!browser) return;

    const unsubscribeActionLog = mqttClient.onNotification('actionLog.sync', (payload: any) => {
      const eventDeviceId = payload?.deviceId || payload?.dbRecord?.deviceId;
      if (eventDeviceId === this.deviceId) {
        if (payload.dbRecord && ClientMessageOptimizer.isOptimized(payload.dbRecord)) {
          payload.dbRecord = ClientMessageOptimizer.restore(payload.dbRecord);
        }
        this.handleActionLogEvent(payload as ActionLogEvent);
      }
    });

    const unsubscribeBatched = mqttClient.onNotification('actionLog.sync.batch', (payload: any) => {
      if (Array.isArray(payload?.batch)) {
        for (const event of payload.batch) {
          const eventDeviceId = event?.deviceId || event?.dbRecord?.deviceId;
          if (eventDeviceId === this.deviceId) {
            if (event.dbRecord && ClientMessageOptimizer.isOptimized(event.dbRecord)) {
              event.dbRecord = ClientMessageOptimizer.restore(event.dbRecord);
            }
            this.handleActionLogEvent(event as ActionLogEvent);
          }
        }
      }
    });

    const unsubscribeWildcard = mqttClient.onNotification('*', (payload: any) => {
      const eventDeviceId = payload?.deviceId || payload?.dbRecord?.deviceId;
      if (payload?.dbRecord &&
          payload?.sequenceNumber !== undefined &&
          eventDeviceId === this.deviceId &&
          (payload?.type === 'created' || payload?.type === 'updated' || payload?.type === 'deleted')) {
        this.handleActionLogEvent(payload as ActionLogEvent);
      }
    });

    this.unsubscribeFunctions.push(unsubscribeActionLog, unsubscribeBatched, unsubscribeWildcard);
  }

  private handleActionLogEvent(event: ActionLogEvent): void {
    const { logId, sequenceNumber, dbRecord, type } = event;
    const deviceId = dbRecord.deviceId || this.deviceId;

    const lastData = this.deviceSequences.get(deviceId);
    const lastSequence = lastData?.sequence || 0;
    if (sequenceNumber !== lastSequence + 1 && lastSequence > 0) {
      const gapSize = sequenceNumber - lastSequence - 1;
      console.warn('[ActionLogSyncManager] Sequence gap detected', {
        deviceId,
        expected: lastSequence + 1,
        received: sequenceNumber,
        gapSize
      });
      
      this.triggerResync(deviceId);
      return;
    }

    this.deviceSequences.set(deviceId, {
      sequence: sequenceNumber,
      lastAccess: Date.now()
    });

    const logs = this.getLogs();
    let updatedLogs: ActionLog[];

    if (type === 'created' || type === 'updated') {
      const existingIndex = logs.findIndex(log => log.id === logId);
      if (existingIndex >= 0) {
        updatedLogs = [...logs];
        updatedLogs[existingIndex] = dbRecord;
      } else {
        updatedLogs = [dbRecord, ...logs];
      }
    } else if (type === 'deleted') {
      updatedLogs = logs.filter(log => log.id !== logId);
    } else {
      updatedLogs = logs;
    }

    updatedLogs.sort((a, b) => {
      // Sort by initiatedAt timestamp descending (newest first)
      return new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime();
    });

    this.setLogs(updatedLogs.slice(0, 50));
  }

  private async triggerResync(deviceId: string): Promise<void> {
    if (this.syncInProgress.has(deviceId)) {
      return;
    }

    this.syncInProgress.add(deviceId);

    try {
      const response = await fetch(`/api/devices/${deviceId}/action-logs?limit=50`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch action logs: ${response.statusText}`);
      }

      const responseData = await response.json();
      const dbLogs: ActionLog[] = responseData.data?.logs || responseData;

      this.setLogs(dbLogs);

      if (dbLogs.length > 0) {
        const lastSequence = dbLogs[0]?.sequenceNumber || 0;
        this.deviceSequences.set(deviceId, {
          sequence: lastSequence,
          lastAccess: Date.now()
        });
      } else {
        this.deviceSequences.set(deviceId, {
          sequence: 0,
          lastAccess: Date.now()
        });
      }
    } catch (error) {
      console.error('[ActionLogSyncManager] Resync failed', {
        deviceId,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.syncInProgress.delete(deviceId);
    }
  }

  private startPeriodicSync(): void {
    if (!browser) return;

    this.periodicSyncTimer = setInterval(() => {
      this.triggerResync(this.deviceId);
    }, 5 * 60 * 1000);
  }

  cleanup(): void {
    this.unsubscribeFunctions.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        console.error('[ActionLogSyncManager] Error unsubscribing', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    this.unsubscribeFunctions = [];

    if (this.periodicSyncTimer) {
      clearInterval(this.periodicSyncTimer);
      this.periodicSyncTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.activityRefreshTimer) {
      clearInterval(this.activityRefreshTimer);
      this.activityRefreshTimer = null;
    }

    this.markDeviceInactive();
    this.deviceSequences.clear();
    this.syncInProgress.clear();
  }

  private async markDeviceActive(): Promise<void> {
    if (!browser) return;
    
    try {
      const response = await fetch(`/api/devices/${this.deviceId}/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[ActionLogSyncManager] Failed to mark device active', {
        deviceId: this.deviceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async markDeviceInactive(): Promise<void> {
    if (!browser) return;
    
    try {
      await fetch(`/api/devices/${this.deviceId}/active`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });
    } catch (error) {
      console.error('[ActionLogSyncManager] Failed to mark device inactive', {
        deviceId: this.deviceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private startActivityRefresh(): void {
    if (!browser) return;

    this.activityRefreshTimer = setInterval(() => {
      this.markDeviceActive();
    }, 30000);
  }

  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
