import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';

/**
 * Handler for actions that stream data
 * Examples: push file, view logs
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
    // Get the mapped action type for this entity
    const mappedActionType = MessageEntityMapper.getActionType(entity);
    
    // Handle status update messages
    if (MessageEntityMapper.isStatusUpdate(entity) && mappedActionType === this.actionType) {
      this.handleUnifiedStatus(entity);
      return;
    }

    // Handle progress update messages
    if (MessageEntityMapper.isProgressUpdate(entity) && mappedActionType === this.actionType) {
      this.handleProgressUpdate(entity);
      return;
    }

    // Only handle the new unified flow - no legacy support
    console.log(`[${this.actionType}Handler] Ignoring message:`, { 
      type: entity.type, 
      action: entity.action, 
      mappedActionType,
      expectedAction: this.actionType 
    });
  }

  /**
   * Handle unified status update messages using entity
   */
  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const { action, status, message, logId, progress, durationMs } = entity;
    const actionType = this.actionType;

    console.log(`[${actionType}Handler] Unified status update:`, { 
      action, 
      status, 
      message, 
      logId, 
      progress,
      durationMs,
      entity
    });

    if (status === 'complete') {
      // Use server-calculated duration instead of calculating locally
      this.handleSuccess({ 
        action: actionType, 
        status, 
        message: message || `${actionType} completed`, 
        logId, 
        durationMs // Pass server-calculated duration
      }, logId);
    } else if (status === 'failed' || status === 'fail') {
      this.handleError(message || `${actionType} failed`, logId);
    } else if (progress !== undefined) {
      // Handle progress updates
      this.handleProgress(progress, message || `${actionType} progress: ${progress}%`, logId);
    } else {
      // Handle general status updates
      this.handleProgress(0, message || `${actionType} in progress`, logId);
    }
  }

  /**
   * Handle progress update messages using entity
   */
  protected handleProgressUpdate(entity: DeviceMessageEntity): void {
    const { action, progress, message, logId } = entity;
    const actionType = this.actionType;

    console.log(`[${actionType}Handler] Progress update:`, { 
      action, 
      progress, 
      message, 
      logId,
      entity
    });

    if (progress !== undefined) {
      // Handle progress updates
      this.handleProgress(progress, message || `${actionType} progress: ${progress}%`, logId);
    }
  }
}

/**
 * Push file handler
 */
export class PushFileHandler extends StreamActionHandler {
  constructor(params: any) {
    super(params, 'push_file');
  }
}

/**
 * Logs handler
 */
export class LogsHandler extends StreamActionHandler {
  private fileChunks: Map<string, Uint8Array[]> = new Map();
  private fileMetadata: Map<string, { fileName: string; totalSize: number }> = new Map();

  constructor(params: any) {
    super(params, 'logs');
  }

  handle(evtType: string, data: MessageData): void {
    console.log(`[logsHandler] RAW DATA RECEIVED:`, { evtType, data });
    
    // Map message to entity
    const entity = MessageEntityMapper.mapToEntity(data);
    
    if (!entity) {
      console.log(`[logsHandler] Failed to map message to entity:`, { evtType, data });
      return;
    }

    console.log(`[logsHandler] MAPPED ENTITY:`, entity);

    // Get the mapped action type for this entity
    const mappedActionType = MessageEntityMapper.getActionType(entity);
    
    console.log(`[logsHandler] MAPPED ACTION TYPE:`, mappedActionType);
    console.log(`[logsHandler] IS STATUS UPDATE:`, MessageEntityMapper.isStatusUpdate(entity));
    console.log(`[logsHandler] IS PROGRESS UPDATE:`, MessageEntityMapper.isProgressUpdate(entity));
    console.log(`[logsHandler] IS FILE CHUNK:`, this.isFileChunk(entity));
    console.log(`[logsHandler] IS DEVICE MESSAGE WITH CHUNK:`, this.isDeviceMessageWithChunk(entity));
    
    // Handle status update messages
    if (MessageEntityMapper.isStatusUpdate(entity) && mappedActionType === 'logs') {
      console.log(`[logsHandler] Handling status update`);
      this.handleUnifiedStatus(entity);
      return;
    }

    // Handle progress update messages (including file chunks)
    if (entity.type === 'device:progressUpdate' && mappedActionType === 'logs') {
      console.log(`[logsHandler] Handling progress update`);
      // Check if this is a file chunk message
      if (this.isFileChunk(entity)) {
        console.log(`[logsHandler] Processing file chunk`);
        this.handleFileChunk(entity);
      } else {
        console.log(`[logsHandler] Processing regular progress update`);
        this.handleProgressUpdate(entity);
      }
      return;
    }

    // Handle device messages with chunk data (legacy format) - DEPRECATED
    // getLogs now uses device:progressUpdate with file chunks like pushFile
    if (entity.type === 'device' && mappedActionType === 'logs' && this.isDeviceMessageWithChunk(entity)) {
      console.log(`[logsHandler] Processing legacy device message with chunk data`);
      this.handleDeviceMessageWithChunk(entity);
      return;
    }

    // Only handle the new unified flow - no legacy support
    console.log(`[logsHandler] Ignoring message:`, { 
      type: entity.type, 
      action: entity.action, 
      mappedActionType,
      expectedAction: 'logs' 
    });
  }

  private isFileChunk(entity: DeviceMessageEntity): boolean {
    // Check if this is a file chunk message
    const payload = entity.payload as any;
    return entity.type === 'device:progressUpdate' && 
           payload?.type === 'fileChunk' && 
           payload?.data !== undefined &&
           payload?.fileName !== undefined &&
           payload?.position !== undefined &&
           payload?.total !== undefined;
  }

  private isDeviceMessageWithChunk(entity: DeviceMessageEntity): boolean {
    // Check if this is a device message with chunk data (legacy format)
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
    
    console.log(`[logsHandler] File chunk received:`, {
      logId,
      fileName,
      position,
      total,
      dataType: typeof data,
      dataLength: data ? data.length : 0
    });
    
    if (!logId) {
      console.error('[LogsHandler] File chunk missing logId');
      return;
    }

    // Initialize chunks array if not exists
    if (!this.fileChunks.has(logId)) {
      this.fileChunks.set(logId, []);
    }

    // Store file metadata
    if (fileName && total) {
      this.fileMetadata.set(logId, { fileName, totalSize: total });
    }

    // Convert base64 data to Uint8Array
    try {
      let chunkData: Uint8Array;
      
      if (typeof data === 'string') {
        // Data is base64 encoded string
        const binaryString = atob(data);
        chunkData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          chunkData[i] = binaryString.charCodeAt(i);
        }
      } else if (Array.isArray(data)) {
        // Data is already an array of bytes
        chunkData = new Uint8Array(data);
      } else {
        console.error('[LogsHandler] Unknown data format:', typeof data);
        return;
      }
      
      this.fileChunks.get(logId)!.push(chunkData);
      
      console.log(`[LogsHandler] Received file chunk:`, {
        logId,
        position,
        total,
        chunkSize: chunkData.length,
        totalChunks: this.fileChunks.get(logId)!.length
      });

      // Check if file is complete
      if (position >= total) {
        this.completeFileDownload(logId);
      }
    } catch (error) {
      console.error('[LogsHandler] Error processing file chunk:', error);
    }
  }

  private handleDeviceMessageWithChunk(entity: DeviceMessageEntity): void {
    const { payload } = entity;
    const { chunkData, fileName, totalSize, logId, chunkIndex, chunkCount } = payload as any;
    
    console.log(`[logsHandler] Device message with chunk:`, {
      logId,
      fileName,
      totalSize,
      chunkIndex,
      chunkCount,
      chunkDataLength: chunkData ? chunkData.length : 0
    });
    
    if (!logId) {
      console.error('[LogsHandler] Device message missing logId');
      return;
    }

    // Initialize chunks array if not exists
    if (!this.fileChunks.has(logId)) {
      this.fileChunks.set(logId, []);
    }

    // Store file metadata
    if (fileName && totalSize) {
      this.fileMetadata.set(logId, { fileName, totalSize });
    }

    // Convert base64 data to Uint8Array
    try {
      let chunkDataBytes: Uint8Array;
      
      if (typeof chunkData === 'string') {
        // Data is base64 encoded string
        const binaryString = atob(chunkData);
        chunkDataBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          chunkDataBytes[i] = binaryString.charCodeAt(i);
        }
      } else if (Array.isArray(chunkData)) {
        // Data is already an array of bytes
        chunkDataBytes = new Uint8Array(chunkData);
      } else {
        console.error('[LogsHandler] Unknown chunk data format:', typeof chunkData);
        return;
      }
      
      this.fileChunks.get(logId)!.push(chunkDataBytes);
      
      console.log(`[LogsHandler] Received device chunk:`, {
        logId,
        chunkIndex,
        chunkCount,
        chunkSize: chunkDataBytes.length,
        totalChunks: this.fileChunks.get(logId)!.length
      });

      // Check if file is complete (single chunk or all chunks received)
      if (chunkCount === 1 || (chunkIndex !== undefined && chunkIndex >= chunkCount - 1)) {
        this.completeFileDownload(logId);
      }
    } catch (error) {
      console.error('[LogsHandler] Error processing device chunk:', error);
    }
  }

  private completeFileDownload(logId: string): void {
    const chunks = this.fileChunks.get(logId);
    const metadata = this.fileMetadata.get(logId);
    
    if (!chunks || !metadata) {
      console.error('[LogsHandler] Missing chunks or metadata for logId:', logId);
      return;
    }

    console.log(`[LogsHandler] Completing file download:`, {
      logId,
      fileName: metadata.fileName,
      totalChunks: chunks.length,
      totalSize: metadata.totalSize
    });

    try {
      // Combine all chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const fileData = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }

      // Create blob and trigger download
      const blob = new Blob([fileData]);
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = metadata.fileName || `logs_${logId}.zip`;
      link.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      this.fileChunks.delete(logId);
      this.fileMetadata.delete(logId);
      
      console.log(`[LogsHandler] File download completed: ${metadata.fileName}`);
    } catch (error) {
      console.error('[LogsHandler] Error completing file download:', error);
    }
  }
}
