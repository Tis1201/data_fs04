import type { MessageData, ActionHandlerParams, ActionLog } from './types';
import type { DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';

export abstract class BaseActionHandler {
  protected deviceId: string;
  protected getLogs: () => ActionLog[];
  protected setLogs: (logs: ActionLog[]) => void;
  protected actionStatus: any;
  protected onProgress?: (progress: number, message: string, logId?: string) => void;
  protected onSuccess?: (data: any) => void;
  protected onError?: (error: string, logId?: string) => void;

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

  protected handleProgress(progress: number, message: string, logId?: string): void {
    console.log(`[BaseActionHandler] Progress: ${progress}% - ${message}`);
    this.onProgress?.(progress, message, logId);
  }

  protected handleSuccess(data: any, logId?: string): void {
    console.log(`[BaseActionHandler] Success:`, data);
    this.onSuccess?.(data);
  }

  protected handleError(error: string, logId?: string): void {
    console.error(`[BaseActionHandler] Error:`, error);
    this.onError?.(error, logId);
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
      this.handleError(message || `${action} failed`, logId);
    } else if (progress !== undefined) {
      this.handleProgress(progress, message || `${action} progress: ${progress}%`, logId);
    } else {
      this.handleProgress(0, message || `${action} in progress`, logId);
    }
  }
}