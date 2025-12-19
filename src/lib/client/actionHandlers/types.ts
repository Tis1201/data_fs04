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
};

export type ActionHandlerParams = {
  deviceId: string;
  getLogs: () => ActionLog[];
  setLogs: (logs: ActionLog[]) => void;
  actionStatus: any;
  onProgress?: (progress: number, message: string, logId?: string) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: string, logId?: string, action?: string) => void;
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
