export type ActionLog = {
  id: string;
  deviceId: string;
  actionType: string;
  status: string;
  progress: number | null;
  initiatedAt: string;
  completedAt: string | null | undefined;
  durationMs: number | null;
  message: string | null;
  user: any | null;
  sequenceNumber?: number;
};

export type ActionHandlerParams = {
  deviceId: string;
  getLogs: () => ActionLog[];
  setLogs: (logs: ActionLog[]) => void;
  actionStatus: any;
  onProgress?: (progress: number | null, message: string, logId?: string, actionType?: string) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: string, logId?: string, action?: string, durationMs?: number | null) => void;
  /** Called when LogsHandler has triggered the download (or already did). Page should clear pendingLogDownloadId and downloadLogsLoading. */
  onLogsDownloadTriggered?: (logId: string) => void;
  /** Called when LogsHandler receives failed status for get_logs. Page should clear pendingLogDownloadId and downloadLogsLoading. */
  onLogsDownloadFailed?: (logId: string, message: string) => void;
  /** Called when TerminalHandler receives terminal session success/failure. Page can show toast. */
  onTerminalComplete?: (status: 'success' | 'failed' | 'in_progress', message: string) => void;
};

export type MessageData = {
  deviceId?: string;
  logId?: string;
  status?: string;
  success?: boolean;
  message?: string;
  progress?: number;
  durationMs?: number;
  completedAt?: string;
  [key: string]: any;
};

export type ActionPattern = 
  | 'simple'        // reboot, restart - send action, wait for complete
  | 'progress'      // install, pull, firmware - send action, wait for progress updates
  | 'stream'        // push, logs - send action, wait for data stream
  | 'snapshot';     // snapshot - send action, wait for image stream

export const MAX_ACTION_LOGS = 15;
