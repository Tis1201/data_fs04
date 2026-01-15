import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';
import { mapActionTypeToDb } from './actionTypeMapping';

/**
 * Handler for actions that stream data (e.g., push file, view logs)
 */
export class StreamActionHandler extends BaseActionHandler {
  private actionType: string;

  constructor(
    params: ActionHandlerParams,
    actionType: string
  ) {
    super(params);
    this.actionType = actionType;
  }

  handle(evtType: string, entity: DeviceMessageEntity): void {
    const mappedActionType = MessageEntityMapper.getActionType(entity);
    
    if (MessageEntityMapper.isStatusUpdate(entity) && mappedActionType === this.actionType) {
      this.handleUnifiedStatus(entity);
      return;
    }

    if (MessageEntityMapper.isProgressUpdate(entity) && mappedActionType === this.actionType) {
      this.handleProgressUpdate(entity);
      return;
    }
  }

  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const { action, status, message, logId, progress } = entity;
    // Extract durationMs from both entity and payload (server sends it in payload)
    const durationMs = entity.durationMs ?? entity.payload?.durationMs;
    const actionType = this.actionType;

    if (status === 'complete' || status === 'success') {
      this.handleSuccess({ 
        action: actionType, 
        status, 
        message: message || `${actionType} completed`, 
        logId, 
        durationMs 
      }, logId);
    } else if (status === 'failed' || status === 'fail') {
      const dbActionType = mapActionTypeToDb(actionType);
      this.handleError(message || `${actionType} failed`, logId, dbActionType, durationMs);
    } else if (progress !== undefined) {
      const dbActionType = mapActionTypeToDb(actionType);
      this.handleProgress(progress, message || `${actionType} progress: ${progress}%`, logId, dbActionType);
    } else {
      const dbActionType = mapActionTypeToDb(actionType);
      this.handleProgress(0, message || `${actionType} in progress`, logId, dbActionType);
    }
  }

  protected handleProgressUpdate(entity: DeviceMessageEntity): void {
    const { action, progress, message, logId } = entity;

    if (progress !== undefined) {
      this.handleProgress(progress, message || `${this.actionType} progress: ${progress}%`, logId);
    }
  }
}

export class PushFileHandler extends StreamActionHandler {
  constructor(params: any) {
    super(params, 'push_file');
  }
}

export class LogsHandler extends StreamActionHandler {
  private fileChunks: Map<string, Uint8Array[]> = new Map();
  private fileMetadata: Map<string, { fileName: string; totalSize: number }> = new Map();
  private static readonly DOWNLOAD_STORAGE_KEY = 'fs04_logs_downloads';

  constructor(params: any) {
    super(params, 'get_logs');
  }

  private isDownloadTriggered(logId: string): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    try {
      const stored = sessionStorage.getItem(LogsHandler.DOWNLOAD_STORAGE_KEY);
      if (!stored) return false;
      const downloads = JSON.parse(stored) as Record<string, number>;
      return !!downloads[logId];
    } catch {
      return false;
    }
  }

  private markDownloadTriggered(logId: string): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(LogsHandler.DOWNLOAD_STORAGE_KEY);
      const downloads: Record<string, number> = stored ? JSON.parse(stored) : {};
      
      downloads[logId] = Date.now();
      
      const keys = Object.keys(downloads).sort((a, b) => downloads[b] - downloads[a]);
      if (keys.length > 50) {
        for (let i = 50; i < keys.length; i++) {
          delete downloads[keys[i]];
        }
      }
      
      sessionStorage.setItem(LogsHandler.DOWNLOAD_STORAGE_KEY, JSON.stringify(downloads));
    } catch (error) {
      console.warn('[LogsHandler] Failed to mark download in sessionStorage', { error });
    }
  }

  private clearDownloadTriggered(logId: string): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(LogsHandler.DOWNLOAD_STORAGE_KEY);
      if (stored) {
        const downloads = JSON.parse(stored) as Record<string, number>;
        delete downloads[logId];
        sessionStorage.setItem(LogsHandler.DOWNLOAD_STORAGE_KEY, JSON.stringify(downloads));
      }
    } catch (error) {
      console.warn('[LogsHandler] Failed to clear download from sessionStorage', { error });
    }
  }

  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const { action, status, message, logId, progress } = entity;
    const payload = entity.payload ?? {};
    const objectPath = (payload as any)?.objectPath;
    // Extract durationMs from both entity and payload (server sends it in payload)
    const durationMs = entity.durationMs ?? entity.payload?.durationMs;

    if (status === 'complete' || status === 'success') {
      if (objectPath && logId) {
        if (this.isDownloadTriggered(logId)) {
          console.debug('[LogsHandler] Download already triggered', { logId });
        } else {
          this.markDownloadTriggered(logId);
          this.triggerLogsDownload(logId, objectPath).catch((error) => {
            console.error('[LogsHandler] Download failed', { logId, error });
            this.clearDownloadTriggered(logId);
          });
        }
      }
      
      this.handleSuccess({ 
        action: 'get_logs', 
        status, 
        message: message || `Logs completed`, 
        logId, 
        durationMs,
        objectPath
      }, logId);
    } else if (status === 'failed' || status === 'fail') {
      this.handleError(message || `Logs failed`, logId, 'get_logs');
    } else if (progress !== undefined) {
      this.handleProgress(progress, message || `Logs progress: ${progress}%`, logId, 'get_logs');
    } else {
      this.handleProgress(0, message || `Logs in progress`, logId, 'get_logs');
    }
  }

  private async triggerLogsDownload(logId: string, objectPath: string): Promise<void> {
    try {
      const downloadResponse = await fetch(
        `/api/v2/devices/${this.deviceId}/pull-file-download-url?logId=${logId}`,
        { 
          credentials: 'include',
          method: 'GET'
        }
      );
      
      if (!downloadResponse.ok) {
        const errorText = await downloadResponse.text();
        throw new Error(`Failed to get download URL: ${downloadResponse.status} ${errorText}`);
      }
      
      const response = await downloadResponse.json();
      const data = response.data || response;
      const downloadUrl = data.downloadUrl;
      
      if (!downloadUrl) {
        throw new Error(`Download URL is missing from API response`);
      }
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('[LogsHandler] Error triggering logs download', { logId, error });
    }
  }

  handle(evtType: string, data: MessageData): void {
    const entity = MessageEntityMapper.mapToEntity(data);
    
    if (!entity) {
      console.debug('[LogsHandler] Failed to map message to entity', { evtType });
      return;
    }

    const rawData = typeof data === 'object' ? data : {};
    const objectPathFromRaw = (rawData as any)?.objectPath;
    if (objectPathFromRaw && !entity.payload?.objectPath) {
      entity.payload = { ...entity.payload, objectPath: objectPathFromRaw };
    }

    const mappedActionType = MessageEntityMapper.getActionType(entity);
    
    if (MessageEntityMapper.isStatusUpdate(entity) && mappedActionType === 'get_logs') {
      this.handleUnifiedStatus(entity);
      return;
    }

    if (entity.type === 'device:progressUpdate' && mappedActionType === 'get_logs') {
      if (this.isFileChunk(entity)) {
        this.handleFileChunk(entity);
      } else {
        this.handleProgressUpdate(entity);
      }
      return;
    }

    if (entity.type === 'device' && mappedActionType === 'get_logs' && this.isDeviceMessageWithChunk(entity)) {
      this.handleDeviceMessageWithChunk(entity);
      return;
    }
  }

  private isFileChunk(entity: DeviceMessageEntity): boolean {
    const payload = entity.payload as any;
    return entity.type === 'device:progressUpdate' && 
           payload?.type === 'fileChunk' && 
           payload?.data !== undefined &&
           payload?.fileName !== undefined &&
           payload?.position !== undefined &&
           payload?.total !== undefined;
  }

  private isDeviceMessageWithChunk(entity: DeviceMessageEntity): boolean {
    const payload = entity.payload as any;
    return entity.type === 'device' && 
           entity.action === 'getLogs' &&
           payload?.chunkData !== undefined &&
           payload?.fileName !== undefined &&
           payload?.totalSize !== undefined;
  }

  private handleFileChunk(entity: DeviceMessageEntity): void {
    const { logId, payload } = entity;
    const { data, position, total, fileName } = payload as any;
    
    if (!logId) {
      console.error('[LogsHandler] File chunk missing logId');
      return;
    }

    if (!this.fileChunks.has(logId)) {
      this.fileChunks.set(logId, []);
    }

    if (fileName && total) {
      this.fileMetadata.set(logId, { fileName, totalSize: total });
    }

    try {
      let chunkData: Uint8Array;
      
      if (typeof data === 'string') {
        const binaryString = atob(data);
        chunkData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          chunkData[i] = binaryString.charCodeAt(i);
        }
      } else if (Array.isArray(data)) {
        chunkData = new Uint8Array(data);
      } else {
        console.error('[LogsHandler] Unknown data format', { dataType: typeof data });
        return;
      }
      
      this.fileChunks.get(logId)!.push(chunkData);

      if (position >= total) {
        this.completeFileDownload(logId);
      }
    } catch (error) {
      console.error('[LogsHandler] Error processing file chunk', { logId, error });
    }
  }

  private handleDeviceMessageWithChunk(entity: DeviceMessageEntity): void {
    const { payload } = entity;
    const { chunkData, fileName, totalSize, logId, chunkIndex, chunkCount } = payload as any;
    
    if (!logId) {
      console.error('[LogsHandler] Device message missing logId');
      return;
    }

    if (!this.fileChunks.has(logId)) {
      this.fileChunks.set(logId, []);
    }

    if (fileName && totalSize) {
      this.fileMetadata.set(logId, { fileName, totalSize });
    }

    try {
      let chunkDataBytes: Uint8Array;
      
      if (typeof chunkData === 'string') {
        const binaryString = atob(chunkData);
        chunkDataBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          chunkDataBytes[i] = binaryString.charCodeAt(i);
        }
      } else if (Array.isArray(chunkData)) {
        chunkDataBytes = new Uint8Array(chunkData);
      } else {
        console.error('[LogsHandler] Unknown chunk data format', { dataType: typeof chunkData });
        return;
      }
      
      this.fileChunks.get(logId)!.push(chunkDataBytes);

      if (chunkCount === 1 || (chunkIndex !== undefined && chunkIndex >= chunkCount - 1)) {
        this.completeFileDownload(logId);
      }
    } catch (error) {
      console.error('[LogsHandler] Error processing device chunk', { logId, error });
    }
  }

  private completeFileDownload(logId: string): void {
    const chunks = this.fileChunks.get(logId);
    const metadata = this.fileMetadata.get(logId);
    
    if (!chunks || !metadata) {
      console.error('[LogsHandler] Missing chunks or metadata', { logId });
      return;
    }

    try {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const fileData = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([fileData]);
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = metadata.fileName || `logs_${logId}.zip`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      this.fileChunks.delete(logId);
      this.fileMetadata.delete(logId);
    } catch (error) {
      console.error('[LogsHandler] Error completing file download', { logId, error });
    }
  }
}
