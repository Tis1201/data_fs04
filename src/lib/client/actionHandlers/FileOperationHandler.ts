import { StreamActionHandler } from './StreamActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';

export class FileOperationHandler extends StreamActionHandler {
  private operationType: 'push' | 'pull';
  private fileChunks: Map<string, Uint8Array[]> = new Map();
  private fileMetadata: Map<string, { fileName: string; totalSize: number }> = new Map();
  private static readonly DOWNLOAD_STORAGE_KEY = 'fs04_pullfile_downloads'; // Session storage key for tracking downloads

  constructor(params: ActionHandlerParams, operationType: 'push' | 'pull') {
    super(params, 'file_operation');
    this.operationType = operationType;
  }

  /**
   * Check if a download has already been triggered for this logId
   */
  private isDownloadTriggered(logId: string): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    try {
      const stored = sessionStorage.getItem(FileOperationHandler.DOWNLOAD_STORAGE_KEY);
      if (!stored) return false;
      const downloads = JSON.parse(stored) as Record<string, number>;
      const isTriggered = !!downloads[logId];
      console.log(`[${this.operationType}FileHandler] Checking if download triggered:`, { logId, isTriggered, allDownloads: Object.keys(downloads) });
      return isTriggered;
    } catch {
      return false;
    }
  }

  /**
   * Mark a download as triggered
   */
  private markDownloadTriggered(logId: string): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(FileOperationHandler.DOWNLOAD_STORAGE_KEY);
      const downloads: Record<string, number> = stored ? JSON.parse(stored) : {};
      
      downloads[logId] = Date.now();
      
      // Keep only last 50 logIds to prevent storage bloat
      const keys = Object.keys(downloads).sort((a, b) => downloads[b] - downloads[a]);
      if (keys.length > 50) {
        for (let i = 50; i < keys.length; i++) {
          delete downloads[keys[i]];
        }
      }
      
      sessionStorage.setItem(FileOperationHandler.DOWNLOAD_STORAGE_KEY, JSON.stringify(downloads));
      console.log(`[${this.operationType}FileHandler] sessionStorage updated:`, { logId, timestamp: downloads[logId], allDownloads: Object.keys(downloads) });
    } catch (error) {
      console.warn(`[${this.operationType}FileHandler] Failed to mark download in sessionStorage:`, error);
    }
  }

  /**
   * Clear download triggered flag (for retry on error)
   */
  private clearDownloadTriggered(logId: string): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(FileOperationHandler.DOWNLOAD_STORAGE_KEY);
      if (stored) {
        const downloads = JSON.parse(stored) as Record<string, number>;
        delete downloads[logId];
        sessionStorage.setItem(FileOperationHandler.DOWNLOAD_STORAGE_KEY, JSON.stringify(downloads));
        console.log(`[${this.operationType}FileHandler] Cleared download flag for:`, logId);
      }
    } catch (error) {
      console.warn(`[${this.operationType}FileHandler] Failed to clear download from sessionStorage:`, error);
    }
  }

  /**
   * Override handleUnifiedStatus to trigger download for pullFile when objectPath is present
   */
  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const { action, status, message, logId, progress, durationMs } = entity;
    const payload = entity.payload ?? {};
    const objectPath = (payload as any)?.objectPath;

    console.log(`[${this.operationType}FileHandler] Unified status update:`, { 
      action, 
      status, 
      message, 
      logId, 
      progress,
      durationMs,
      objectPath,
      entity
    });

    if (status === 'complete' || status === 'success') {
      // For pullFile operations, if objectPath is present, trigger download from GCloud
      // Use sessionStorage to prevent multiple downloads for the same logId (persists across page reloads)
      // IMPORTANT: Only trigger download for pull operations, never for push operations
      if (this.operationType === 'pull' && objectPath && logId) {
        // Check and mark synchronously BEFORE any async operations
        if (this.isDownloadTriggered(logId)) {
          console.log(`[${this.operationType}FileHandler] Download already triggered for logId: ${logId}, skipping duplicate`);
        } else {
          console.log(`[${this.operationType}FileHandler] Success with objectPath, triggering download:`, { logId, objectPath });
          // Mark immediately (synchronously) to prevent race conditions
          this.markDownloadTriggered(logId);
          console.log(`[${this.operationType}FileHandler] Marked download as triggered in sessionStorage:`, logId);
          
          // Trigger download immediately (not in setTimeout to avoid race conditions)
          this.triggerPullFileDownload(logId, objectPath).catch((error) => {
            console.error(`[${this.operationType}FileHandler] Download failed, allowing retry:`, error);
            // On error, remove from storage to allow retry
            this.clearDownloadTriggered(logId);
          });
        }
      }
      
      // Use the database action type format to match existing logs
      // The API creates logs with 'push_file' or 'pull_file', so we need to use that format
      // Map from entity.action (which might be 'pushFile', 'file_operation', etc.) to database format
      const dbActionType = this.operationType === 'pull' ? 'pull_file' : 'push_file';
      
      // Use server-calculated duration instead of calculating locally
      this.handleSuccess({ 
        action: dbActionType, // Use database format to match existing logs ('push_file' or 'pull_file')
        status, 
        message: message || `${this.operationType}File completed`, 
        logId, 
        durationMs,
        objectPath
      }, logId);
    } else if (status === 'failed' || status === 'fail') {
      // Use the database action type format to match existing logs
      const dbActionType = this.operationType === 'pull' ? 'pull_file' : 'push_file';
      this.handleError(message || `${this.operationType}File failed`, logId, dbActionType);
    } else if (progress !== undefined) {
      // Handle progress updates
      this.handleProgress(progress, message || `${this.operationType}File progress: ${progress}%`, logId);
    } else {
      // Handle general status updates (in_progress, etc.)
      this.handleProgress(0, message || `${this.operationType}File in progress`, logId);
    }
  }

  /**
   * Trigger download of pulled file from GCloud
   * Creates a hidden anchor and clicks it - browser handles the rest
   */
  private async triggerPullFileDownload(logId: string, objectPath: string): Promise<void> {
    try {
      console.log(`[${this.operationType}FileHandler] Fetching download URL for pulled file:`, { logId, objectPath, deviceId: this.deviceId });
      
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
      // API response is wrapped in { success: true, data: { downloadUrl, fileName, ... } }
      const data = response.data || response;
      const downloadUrl = data.downloadUrl;
      const fileName = data.fileName || this.extractFileNameFromPath(objectPath);
      
      console.log(`[${this.operationType}FileHandler] Download URL received:`, { downloadUrl, fileName, response });
      
      if (!downloadUrl) {
        throw new Error(`Download URL is missing from API response: ${JSON.stringify(response)}`);
      }
      
      // Create hidden anchor and click it
      // Note: GCS presigned URLs already have Content-Disposition header, so we DON'T need download attribute
      // Using download attribute with cross-origin URLs can cause double downloads!
      console.log(`[${this.operationType}FileHandler] Triggering download via anchor click`);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.target = '_blank'; // Open in new tab to prevent navigation
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      console.log(`[${this.operationType}FileHandler] Pull file download triggered`);
    } catch (error) {
      console.error(`[${this.operationType}FileHandler] Error triggering pull file download:`, error);
    }
  }

  /**
   * Extract filename from objectPath
   */
  private extractFileNameFromPath(objectPath: string): string {
    const parts = objectPath.split('/');
    return parts[parts.length - 1] || `file_${Date.now()}`;
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
