import type { MessageData, ActionHandlerParams, ActionLog } from './types';
import type { DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';
import { mapActionTypeToDb } from './actionTypeMapping';

export abstract class BaseActionHandler {
  protected deviceId: string;
  protected getLogs: () => ActionLog[];
  protected setLogs: (logs: ActionLog[]) => void;
  protected actionStatus: any;
  protected onProgress?: (progress: number | null, message: string, logId?: string, actionType?: string) => void;
  protected onSuccess?: (data: any) => void;
  protected onError?: (error: string, logId?: string, action?: string, durationMs?: number | null) => void;

  constructor(params: ActionHandlerParams) {
    this.deviceId = params.deviceId;
    this.getLogs = params.getLogs;
    this.setLogs = params.setLogs;
    this.actionStatus = params.actionStatus;
    this.onProgress = params.onProgress;
    this.onSuccess = params.onSuccess;
    this.onError = params.onError;
  }

  abstract handle(evtType: string, entity: DeviceMessageEntity): void;

  protected handleProgress(progress: number | null, message: string, logId?: string, actionType?: string): void {
    const currentLogs = this.getLogs();
    const logExists = logId ? currentLogs.some(log => log.id === logId) : false;
    const existingLog = logId ? currentLogs.find(log => log.id === logId) : null;
    
    const progressDisplay = progress !== null ? `${progress}%` : 'no progress';
    console.log(`[BaseActionHandler] Progress: ${progressDisplay} - ${message}`, {
      logId,
      actionType,
      logExists,
      existingLogStatus: existingLog?.status,
      existingLogProgress: existingLog?.progress,
      currentLogsCount: currentLogs.length,
      willCallOnProgress: !!this.onProgress
    });
    
    this.onProgress?.(progress, message, logId, actionType);
    
    // Log after callback to see if log was updated
    if (logId) {
      const updatedLogs = this.getLogs();
      const updatedLog = updatedLogs.find(log => log.id === logId);
      console.log(`[BaseActionHandler] After onProgress callback:`, {
        logId,
        logUpdated: !!updatedLog,
        newProgress: updatedLog?.progress,
        newStatus: updatedLog?.status,
        newMessage: updatedLog?.message?.substring(0, 100)
      });
    }
  }

  protected handleSuccess(data: any, logId?: string): void {
    console.log(`[BaseActionHandler] Success:`, data);
    this.onSuccess?.(data);
  }

  protected handleError(error: string, logId?: string, action?: string, durationMs?: number | null): void {
    console.error(`[BaseActionHandler] Error:`, error, { logId, action, durationMs });
    this.onError?.(error, logId, action, durationMs);
  }

  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const payload = entity.payload ?? {};
    const {
      action,
      status,
      message,
      logId,
      progress,
      durationMs
    }: {
      action?: string;
      status?: string;
      message?: string;
      logId?: string;
      progress?: number;
      durationMs?: number;
    } = payload as any;

    console.log(`[BaseActionHandler] Unified status update:`, { 
      action, 
      status, 
      message, 
      progress, 
      logId, 
      durationMs,
      entity 
    });

    if (status === 'complete' || status === 'success') {
      this.handleSuccess({ 
        action, 
        status, 
        message: message || `${action} completed`, 
        logId, 
        durationMs 
      }, logId);
    } else if (status === 'failed' || status === 'error') {
      // Use centralized action type mapping
      const dbActionType = action ? mapActionTypeToDb(action) : undefined;
      // Pass server-calculated duration if available
      this.handleError(message || `${action} failed`, logId, dbActionType, durationMs);
    } else if (progress !== undefined) {
      this.handleProgress(progress, message || `${action} progress: ${progress}%`, logId);
    } else {
      this.handleProgress(0, message || `${action} in progress`, logId);
    }
  }
}