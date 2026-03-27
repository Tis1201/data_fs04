import { writable } from 'svelte/store';
import { formatBytes } from '$lib/utils/format';

export interface DownloadProgress {
  progress: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  message: string;
  error?: string;
}

export const downloadProgress = writable<DownloadProgress>({
  progress: 0,
  status: 'idle',
  message: ''
});

export class FileDownloadService {
  private static instance: FileDownloadService;
  
  static getInstance(): FileDownloadService {
    if (!FileDownloadService.instance) {
      FileDownloadService.instance = new FileDownloadService();
    }
    return FileDownloadService.instance;
  }

  /**
   * Download a file from the server with progress tracking
   */
  async downloadFile(
    downloadUrl: string, 
    fileName: string, 
    fileHandle?: FileSystemFileHandle
  ): Promise<void> {
    try {
      downloadProgress.set({
        progress: 0,
        status: 'downloading',
        message: 'Starting download...'
      });

      // Fetch the file with progress tracking
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Update progress
        const progress = total > 0 ? Math.round((receivedLength / total) * 100) : 0;
        downloadProgress.set({
          progress,
          status: 'downloading',
          message: `Downloading... ${progress}% (${formatBytes(receivedLength, false, 2)}${total > 0 ? ` / ${formatBytes(total, false, 2)}` : ''})`
        });
      }

      // Combine all chunks
      const fileData = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        fileData.set(chunk, position);
        position += chunk.length;
      }

      // Save the file
      if (fileHandle) {
        // Use File System Access API
        await this.saveFileWithFileSystemAPI(fileHandle, fileData);
      } else {
        // Use traditional download
        await this.saveFileTraditional(fileName, fileData);
      }

      downloadProgress.set({
        progress: 100,
        status: 'completed',
        message: 'Download completed successfully!'
      });

    } catch (error) {
      console.error('Download error:', error);
      downloadProgress.set({
        progress: 0,
        status: 'error',
        message: 'Download failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Save file using File System Access API
   */
  private async saveFileWithFileSystemAPI(
    fileHandle: FileSystemFileHandle, 
    fileData: Uint8Array
  ): Promise<void> {
    const writable = await fileHandle.createWritable();
    await writable.write(fileData);
    await writable.close();
  }

  /**
   * Save file using traditional download method
   */
  private async saveFileTraditional(fileName: string, fileData: Uint8Array): Promise<void> {
    const blob = new Blob([fileData] as BlobPart[]);
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Reset download progress
   */
  resetProgress(): void {
    downloadProgress.set({
      progress: 0,
      status: 'idle',
      message: ''
    });
  }
}

export const fileDownloadService = FileDownloadService.getInstance();
