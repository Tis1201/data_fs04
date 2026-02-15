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
    this.onProgress?.(progress, message, logId, actionType);
  }

  protected handleSuccess(data: any, logId?: string): void {
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