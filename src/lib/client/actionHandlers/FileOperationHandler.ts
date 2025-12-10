import { StreamActionHandler } from './StreamActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';

export class FileOperationHandler extends StreamActionHandler {
  private operationType: 'push' | 'pull';
  private fileChunks: Map<string, Uint8Array[]> = new Map();
  private fileMetadata: Map<string, { fileName: string; totalSize: number }> = new Map();

  constructor(params: ActionHandlerParams, operationType: 'push' | 'pull') {
    super(params, 'file_operation');
    this.operationType = operationType;
  }

  handle(evtType: string, entity: DeviceMessageEntity): void {
    console.log(`[${this.operationType}FileHandler] ENTITY RECEIVED:`, { evtType, entity });

    // Get the mapped action type from entity
    const mappedActionType = MessageEntityMapper.getActionType(entity);
    
    console.log(`[${this.operationType}FileHandler] MAPPED ACTION TYPE:`, mappedActionType);
    console.log(`[${this.operationType}FileHandler] IS STATUS UPDATE:`, MessageEntityMapper.isStatusUpdate(entity));
    console.log(`[${this.operationType}FileHandler] IS PROGRESS UPDATE:`, MessageEntityMapper.isProgressUpdate(entity));
    console.log(`[${this.operationType}FileHandler] IS FILE CHUNK:`, this.isFileChunk(entity));
    
    // Handle status update messages
    if (MessageEntityMapper.isStatusUpdate(entity) && (mappedActionType === 'file_operation' || mappedActionType === 'pull_file')) {
      console.log(`[${this.operationType}FileHandler] Handling status update`);
      this.handleUnifiedStatus(entity);
      return;
    }

    // Handle progress update messages (including file chunks)
    if (entity.type === 'device:progressUpdate' && (mappedActionType === 'file_operation' || mappedActionType === 'pull_file')) {
      console.log(`[${this.operationType}FileHandler] Handling progress update`);
      // Check if this is a file chunk message
      if (this.isFileChunk(entity)) {
        console.log(`[${this.operationType}FileHandler] Processing file chunk`);
        this.handleFileChunk(entity);
      } else {
        console.log(`[${this.operationType}FileHandler] Processing regular progress update`);
        this.handleFileProgress(entity);
      }
      return;
    }

    // Only handle the new unified flow - no legacy support
    console.log(`[${this.operationType}FileHandler] Ignoring message:`, { 
      type: entity.type, 
      action: entity.action, 
      mappedActionType,
      expectedAction: `${this.operationType}File` 
    });
  }

  private handleFileProgress(entity: DeviceMessageEntity): void {
    const { action, progress, message, logId } = entity;
    const actionType = `${this.operationType}File`;

    console.log(`[${actionType}Handler] Progress update:`, { 
      action, 
      progress, 
      message, 
      logId,
      entity
    });

    if (progress !== undefined) {
      this.handleProgress(progress, message || `${actionType} progress: ${progress}%`, logId);
    }
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

  private handleFileChunk(entity: DeviceMessageEntity): void {
    const { logId, payload } = entity;
    const { data, position, total, fileName } = payload as any;
    
    console.log(`[${this.operationType}FileHandler] File chunk received:`, {
      logId,
      fileName,
      position,
      total,
      dataType: typeof data,
      dataLength: data ? data.length : 0
    });
    
    if (!logId) {
      console.error('[FileOperationHandler] File chunk missing logId');
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
        console.error('[FileOperationHandler] Unknown data format:', typeof data);
        return;
      }
      
      this.fileChunks.get(logId)!.push(chunkData);
      
      console.log(`[FileOperationHandler] Received file chunk:`, {
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
      console.error('[FileOperationHandler] Error processing file chunk:', error);
    }
  }

  private completeFileDownload(logId: string): void {
    const chunks = this.fileChunks.get(logId);
    const metadata = this.fileMetadata.get(logId);
    
    if (!chunks || !metadata) {
      console.error('[FileOperationHandler] Missing file data for completion');
      return;
    }

    try {
      // Combine all chunks
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const fileData = new Uint8Array(totalSize);
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
      link.download = metadata.fileName || `file_${logId}`;
      link.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      console.log(`[FileOperationHandler] File download completed:`, {
        logId,
        fileName: metadata.fileName,
        size: totalSize
      });

      // Clean up stored data
      this.fileChunks.delete(logId);
      this.fileMetadata.delete(logId);

    } catch (error) {
      console.error('[FileOperationHandler] Error completing file download:', error);
    }
  }
}
