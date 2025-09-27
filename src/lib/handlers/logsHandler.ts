import { browser } from '$app/environment';

interface LogsChunk {
  action: string;
  deviceId: string;
  logId: string;
  success: boolean;
  message: string;
  format: string;
  chunkIndex?: number;
  chunkCount?: number;
  chunkData?: string;
  fileName?: string;
  totalSize?: number;
  timestamp: string;
}

class LogsHandler {
  private activeDownloads = new Map<string, {
    fileName: string;
    totalSize: number;
    chunks: string[];
    receivedSize: number;
  }>();

  handleLogsMessage(message: any): void {
    if (!browser) return;

    const payload = message.payload;
    if (!payload || payload.action !== 'getLogs') return;

    const { logId, fileName, totalSize, chunkIndex, chunkCount, chunkData, message: statusMessage } = payload;

    console.log(`[LogsHandler] Processing logs message:`, {
      logId,
      fileName,
      totalSize,
      chunkIndex,
      chunkCount,
      message: statusMessage
    });

    // Handle chunk metadata
    if (fileName && totalSize && chunkCount !== undefined) {
      this.initializeDownload(logId, fileName, totalSize, chunkCount);
      return;
    }

    // Handle chunk data
    if (chunkIndex !== undefined && chunkData) {
      this.addChunk(logId, chunkIndex, chunkData);
      return;
    }

    // Handle completion
    if (statusMessage && statusMessage.includes('completed')) {
      this.finalizeDownload(logId);
      return;
    }

    // Handle progress updates
    if (statusMessage) {
      console.log(`[LogsHandler] Progress: ${statusMessage}`);
    }
  }

  private initializeDownload(logId: string, fileName: string, totalSize: number, chunkCount: number): void {
    console.log(`[LogsHandler] Initializing download: ${fileName} (${totalSize} bytes, ${chunkCount} chunks)`);
    
    this.activeDownloads.set(logId, {
      fileName,
      totalSize,
      chunks: new Array(chunkCount).fill(''),
      receivedSize: 0
    });
  }

  private addChunk(logId: string, chunkIndex: number, chunkData: string): void {
    const download = this.activeDownloads.get(logId);
    if (!download) {
      console.warn(`[LogsHandler] Received chunk for unknown download: ${logId}`);
      return;
    }

    download.chunks[chunkIndex] = chunkData;
    download.receivedSize += chunkData.length;

    console.log(`[LogsHandler] Received chunk ${chunkIndex + 1}/${download.chunks.length} (${download.receivedSize}/${download.totalSize} bytes)`);

    // Check if all chunks received
    const allChunksReceived = download.chunks.every(chunk => chunk !== '');
    if (allChunksReceived) {
      this.finalizeDownload(logId);
    }
  }

  private finalizeDownload(logId: string): void {
    const download = this.activeDownloads.get(logId);
    if (!download) {
      console.warn(`[LogsHandler] Cannot finalize unknown download: ${logId}`);
      return;
    }

    console.log(`[LogsHandler] Finalizing download: ${download.fileName}`);

    try {
      // Combine all chunks
      const combinedData = download.chunks.join('');
      
      // Convert base64 to binary
      const binaryString = atob(combinedData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and trigger download
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = download.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log(`[LogsHandler] Download completed: ${download.fileName}`);
      
    } catch (error) {
      console.error(`[LogsHandler] Error finalizing download:`, error);
    } finally {
      // Clean up
      this.activeDownloads.delete(logId);
    }
  }
}

export const logsHandler = new LogsHandler();
