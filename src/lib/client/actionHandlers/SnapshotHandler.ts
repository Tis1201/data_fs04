import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';
import { mapActionTypeToDb } from './actionTypeMapping';

/**
 * Handler for screenshot/snapshot actions
 */
export class SnapshotHandler extends BaseActionHandler {
  constructor(params: ActionHandlerParams) {
    super(params);
  }

  handle(evtType: string, entity: any): void {
    if (evtType === 'device.screenshot') {
      this.handleScreenshotCompletion(entity);
      return;
    }

    const mappedEntity = MessageEntityMapper.mapToEntity(entity);
    
    if (!mappedEntity) {
      console.debug('[SnapshotHandler] Failed to map message to entity', { evtType });
      return;
    }

    if (evtType === 'device:statusUpdate' || mappedEntity.type === 'device:statusUpdate') {
      const action = mappedEntity.action || mappedEntity.payload?.action;
      if (action === 'screenshot' || action === 'snapshot') {
        this.handleUnifiedStatus(mappedEntity);
        return;
      }
    }

    if (evtType === 'device:snapshotStatus' || mappedEntity?.type === 'device:snapshotStatus') {
      this.handleSnapshotStatus(evtType, mappedEntity);
      return;
    }
  }

  private handleScreenshotCompletion(entity: any): void {
    const message = entity.message || 'Screenshot captured successfully';
    const durationMs = entity.durationMs;
    const objectPath = entity.objectPath;
    
    const logs = this.getLogs();
    const screenshotLog = logs.find(log => 
      log.deviceId === this.deviceId && 
      (log.actionType === 'snapshot' || log.actionType === 'screenshot') &&
      log.status === 'in_progress'
    );

    if (screenshotLog) {
      this.handleSuccess({ 
        action: 'screenshot', 
        status: 'success', 
        message, 
        logId: screenshotLog.id, 
        durationMs 
      }, screenshotLog.id);
    } else {
      console.warn('[SnapshotHandler] No in-progress screenshot log found', { 
        deviceId: this.deviceId,
        logCount: logs.length
      });
    }
  }

  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const payload = entity.payload ?? {};
    const {
      action,
      status,
      message,
      logId,
      durationMs
    }: {
      action?: string;
      status?: string;
      message?: string;
      logId?: string;
      durationMs?: number;
    } = payload as any;

    if (status === 'complete' || status === 'success') {
      this.handleSuccess({ 
        action, 
        status, 
        message: message || `${action} completed`, 
        logId, 
        durationMs 
      }, logId);
    } else if (status === 'failed' || status === 'error') {
      const dbActionType = mapActionTypeToDb('screenshot');
      this.handleError(message || `${action} failed`, logId, dbActionType, durationMs);
    } else {
      this.handleProgress(null, message || `${action} in progress`, logId);
    }
  }

  private handleSnapshotStatus(evtType: string, data: MessageData): void {
    if (!this.isCorrectDevice(data, this.deviceId)) return;

    const { logId, status, message, completedAt, durationMs } = this.extractMessageData(data);
    const newStatus = this.mapStatus(status);

    const logs = this.getLogs();
    let updated = false;

    if (logId) {
      const idx = logs.findIndex(l => l.id === logId);
      if (idx >= 0) {
        const existing = logs[idx];
        logs[idx] = {
          ...existing,
          status: newStatus,
          message: message ?? existing.message ?? null,
          completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null),
          durationMs: (durationMs ?? existing.durationMs) ?? null
        };
        this.setLogs([...logs]);
        updated = true;
      }
    }

    if (!updated) {
      const latestSnapIdx = logs.findIndex(l => l.actionType === 'snapshot');
      if (latestSnapIdx >= 0) {
        const existing = logs[latestSnapIdx];
        logs[latestSnapIdx] = {
          ...existing,
          id: logId ?? existing.id,
          status: newStatus,
          message: message ?? existing.message ?? null,
          completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null),
          durationMs: (durationMs ?? existing.durationMs) ?? null
        };
        this.setLogs([...logs]);
        updated = true;
      }
    }

    if (!updated) {
      const newLog = this.createActionLog(
        this.deviceId,
        'snapshot',
        newStatus,
        message,
        logId,
        null,
        durationMs
      );
      this.setLogs(this.addActionLog(logs, newLog));
    }
  }

  private isCorrectDevice(data: MessageData, targetDeviceId: string): boolean {
    return !!(data && data.deviceId === targetDeviceId);
  }

  private extractMessageData(data: MessageData) {
    return {
      logId: data.logId,
      status: data.status,
      message: data.message,
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : undefined,
      completedAt: data.completedAt
    };
  }

  private mapStatus(status?: string): string {
    return status === 'success' || status === 'completed' ? 'success' 
         : status === 'failed' ? 'failed' 
         : 'in_progress';
  }

  private createActionLog(
    deviceId: string,
    actionType: string,
    status: string,
    message?: string,
    logId?: string,
    progress?: number | null,
    durationMs?: number | null
  ) {
    const now = new Date();
    const isCompleted = status === 'success' || status === 'failed';
    
    return {
      id: logId ?? `temp-${actionType}-${Date.now()}`,
      deviceId,
      actionType,
      status,
      progress: progress ?? null,
      initiatedAt: now.toISOString(),
      completedAt: isCompleted ? now.toISOString() : null,
      durationMs: durationMs ?? null,
      message: message ?? null,
      user: null
    };
  }

  private addActionLog(logs: any[], newLog: any) {
    return [newLog, ...logs].slice(0, 15);
  }
}
