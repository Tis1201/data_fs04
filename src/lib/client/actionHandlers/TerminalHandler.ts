import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';

/**
 * Handler for terminal action
 */
export class TerminalHandler extends BaseActionHandler {
  constructor(params: ActionHandlerParams) {
    super(params);
  }

  handle(evtType: string, data: MessageData): void {
    // Handle terminal status message
    if (evtType === 'device:terminalStatus' || data?.type === 'device:terminalStatus') {
      this.handleTerminalStatus(evtType, data);
      return;
    }
  }

  private handleTerminalStatus(evtType: string, data: MessageData): void {
    if (!this.isCorrectDevice(data, this.deviceId)) return;

    const { logId, status, message, completedAt, durationMs } = this.extractMessageData(data);
    const newStatus = this.mapStatus(status);

    console.log('[Terminal] Status received:', { 
      evtType, 
      status: newStatus, 
      message, 
      deviceId: this.deviceId, 
      logId 
    });

    const logs = this.getLogs();

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
        return;
      }
    }

    const pendingIdx = logs.findIndex(l => l.actionType === 'terminal' && (l.status === 'initiated' || l.status === 'in_progress'));
    if (pendingIdx >= 0) {
      const existing = logs[pendingIdx];
      logs[pendingIdx] = {
        ...existing,
        id: logId ?? existing.id,
        status: newStatus,
        message: message ?? existing.message ?? null,
        completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null),
        durationMs: (durationMs ?? existing.durationMs) ?? null
      };
      this.setLogs([...logs]);
      return;
    }

    const newLog = this.createActionLog(
      this.deviceId,
      'terminal',
      newStatus,
      message || 'Terminal session established',
      logId,
      null,
      durationMs
    );
    this.setLogs(this.addActionLog(logs, newLog));
  }

  // Helper methods (copied from base class for now)
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
      actionId: deviceId,
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
