import { StreamActionHandler } from './StreamActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';
import { triggerFileDownload } from '$lib/utils/download';

export class FileOperationHandler extends StreamActionHandler {
  private operationType: 'push' | 'pull';
  private fileChunks: Map<string, Uint8Array[]> = new Map();
  private fileMetadata: Map<string, { fileName: string; totalSize: number }> = new Map();
  private static readonly DOWNLOAD_STORAGE_KEY = 'fs04_pullfile_downloads'; // Session storage key for tracking downloads

  constructor(params: ActionHandlerParams, operationType: 'push' | 'pull') {
    // Use snake_case action name based on operation type
    super(params, operationType === 'push' ? 'push_file' : 'pull_file');
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
      return !!downloads[logId];
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
      }
    } catch (error) {
      console.warn(`[${this.operationType}FileHandler] Failed to clear download from sessionStorage:`, error);
    }
  }

  /**
   * Override handleUnifiedStatus to trigger download for pull_file when objectPath is present
   */
  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const { action, status, message, logId, progress } = entity;
    const payload = entity.payload ?? {};
    const objectPath = (payload as any)?.objectPath;
    // Extract durationMs from both entity and payload (server sends it in payload)
    const durationMs = entity.durationMs ?? entity.payload?.durationMs;

    if (status === 'complete' || status === 'success') {
      // For pullFile operations, if objectPath is present, trigger download from GCloud
      // Use sessionStorage to prevent multiple downloads for the same logId (persists across page reloads)
      // IMPORTANT: Only trigger download for pull operations, never for push operations
      if (this.operationType === 'pull' && objectPath && logId) {
        const pendingId = this.getPendingDownloadId?.();
        if (this.getPendingDownloadId && pendingId !== logId) {
          console.warn(`[${this.operationType}FileHandler] Skipping download — not initiated by this client`, {
            logId,
            pendingId,
            hasCallback: !!this.getPendingDownloadId
          });
        } else if (this.isDownloadTriggered(logId)) {
          // Skip - already triggered
        } else {
          this.markDownloadTriggered(logId);
          this.triggerPullFileDownload(logId, objectPath).catch((error) => {
            console.error(`[${this.operationType}FileHandler] Download failed, allowing retry:`, error);
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
   * Trigger download of pulled file from CDN/R2.
   * Uses HMAC fetch+blob if downloadAuth is present, otherwise anchor click for presigned URLs.
   */
  private async triggerPullFileDownload(logId: string, objectPath: string): Promise<void> {
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
      // API response is wrapped in { success: true, data: { downloadUrl, fileName, downloadAuth?, ... } }
      const data = response.data || response;
      const downloadUrl = data.downloadUrl;
      const fileName = data.fileName || this.extractFileNameFromPath(objectPath);
      
      if (!downloadUrl) {
        throw new Error(`Download URL is missing from API response: ${JSON.stringify(response)}`);
      }
      
      await triggerFileDownload({
        downloadUrl,
        fileName,
        ...(data.downloadAuth && { downloadAuth: data.downloadAuth })
      });
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
    const mappedActionType = MessageEntityMapper.getActionType(entity);

    // Handle status update messages
    // Check for both push_file and pull_file (snake_case) and legacy file_operation
    if (MessageEntityMapper.isStatusUpdate(entity) && 
        (mappedActionType === 'push_file' || mappedActionType === 'pull_file' || mappedActionType === 'file_operation')) {
      this.handleUnifiedStatus(entity);
      return;
    }

    // Handle progress update messages (including file chunks)
    if (entity.type === 'device:progressUpdate' && 
        (mappedActionType === 'push_file' || mappedActionType === 'pull_file' || mappedActionType === 'file_operation')) {
      if (this.isFileChunk(entity)) {
        this.handleFileChunk(entity);
      } else {
        this.handleFileProgress(entity);
      }
      return;
    }

  }

  private handleFileProgress(entity: DeviceMessageEntity): void {
    const { progress, message, logId } = entity;

    if (progress !== undefined) {
      const dbActionType = this.operationType === 'pull' ? 'pull_file' : 'push_file';
      this.handleProgress(progress, message || `${this.operationType}File progress: ${progress}%`, logId, dbActionType);
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

      // Clean up stored data
      this.fileChunks.delete(logId);
      this.fileMetadata.delete(logId);

    } catch (error) {
      console.error('[FileOperationHandler] Error completing file download:', error);
    }
  }
}
