import type { ActionLog, MessageData, ActionHandlerParams } from './types';

/**
 * Standardized status mapping function
 */
export function mapStatus(status?: string): string {
  return status === 'success' || status === 'completed' ? 'success' 
       : status === 'failed' ? 'failed' 
       : 'in_progress';
}

/**
 * Calculate duration between two timestamps
 */
export function calculateDuration(initiatedAt: string, completedAt?: string): number | null {
  if (!completedAt) return null;
  
  try {
    const start = new Date(initiatedAt).getTime();
    const end = new Date(completedAt).getTime();
    return end - start;
  } catch {
    return null;
  }
}

/**
 * Update an existing action log
 */
export function updateActionLog(
  logs: ActionLog[],
  logId: string,
  updates: Partial<ActionLog>
): ActionLog[] {
  const idx = logs.findIndex(l => l.id === logId);
  if (idx >= 0) {
    const existing = logs[idx];
    const now = new Date();
    const isCompleted = updates.status === 'success' || updates.status === 'failed';
    const completedAt = isCompleted ? now.toISOString() : existing.completedAt ?? undefined;
    
    // Calculate duration if completed and not already set
    let calculatedDurationMs = updates.durationMs !== undefined ? updates.durationMs : existing.durationMs;
    if (isCompleted && calculatedDurationMs === null && existing.initiatedAt) {
      calculatedDurationMs = calculateDuration(existing.initiatedAt, completedAt) ?? existing.durationMs;
    }
    
    logs[idx] = {
      ...existing,
      ...updates,
      completedAt,
      durationMs: calculatedDurationMs
    };
  }
  return [...logs];
}

/**
 * Find and update temp log with real logId
 */
export function updateTempLogWithRealId(
  logs: ActionLog[],
  actionType: string,
  realLogId: string,
  updates: Partial<ActionLog>
): ActionLog[] {
  const tempLogIdx = logs.findIndex(l => 
    l.actionType === actionType && 
    l.id.startsWith('temp-') &&
    (l.status === 'initiated' || l.status === 'in_progress')
  );
  
  if (tempLogIdx >= 0) {
    const existing = logs[tempLogIdx];
    const now = new Date();
    const isCompleted = updates.status === 'success' || updates.status === 'failed';
    const completedAt = isCompleted ? now.toISOString() : existing.completedAt ?? undefined;
    
    // Calculate duration if completed and not already set
    let calculatedDurationMs = updates.durationMs !== undefined ? updates.durationMs : existing.durationMs;
    if (isCompleted && calculatedDurationMs === null && existing.initiatedAt) {
      calculatedDurationMs = calculateDuration(existing.initiatedAt, completedAt) ?? existing.durationMs;
    }
    
    logs[tempLogIdx] = {
      ...existing,
      id: realLogId, // Replace temp ID with real ID
      ...updates,
      completedAt,
      durationMs: calculatedDurationMs
    };
  }
  return [...logs];
}

/**
 * Create a new action log
 */
export function createActionLog(
  deviceId: string,
  actionType: string,
  status: string,
  message?: string,
  logId?: string,
  progress?: number | null,
  durationMs?: number | null
): ActionLog {
  const now = new Date();
  const isCompleted = status === 'success' || status === 'failed';
  
  return {
    id: logId ?? `temp-${actionType}-${Date.now()}`,
    deviceId,
    actionType,
    status,
    progress: progress ?? null,
    initiatedAt: now.toISOString(),
    completedAt: isCompleted ? now.toISOString() : null,
    durationMs: durationMs ?? null,
    message: message ?? null,
    user: null
  };
}

/**
 * Add a new action log to the beginning of the logs array
 */
export function addActionLog(
  logs: ActionLog[],
  newLog: ActionLog
): ActionLog[] {
  return [newLog, ...logs].slice(0, 15); // MAX_ACTION_LOGS
}

/**
 * Find existing log by ID or action type
 */
export function findExistingLog(
  logs: ActionLog[],
  logId?: string,
  actionType?: string,
  statusFilter?: string[]
): ActionLog | null {
  if (logId) {
    const byId = logs.find(l => l.id === logId);
    if (byId) return byId;
  }
  
  if (actionType) {
    const byType = logs.find(l => 
      l.actionType === actionType && 
      (!statusFilter || statusFilter.includes(l.status))
    );
    if (byType) return byType;
  }
  
  return null;
}

/**
 * Check if device message is for the correct device
 */
export function isCorrectDevice(data: MessageData, targetDeviceId: string): boolean {
  return !!(data && data.deviceId === targetDeviceId);
}

/**
 * Extract common message data
 */
export function extractMessageData(data: MessageData): {
  logId?: string;
  status?: string;
  success?: boolean;
  message?: string;
  progress?: number;
  durationMs?: number;
  completedAt?: string;
} {
  return {
    logId: data.logId,
    status: data.status,
    success: data.success,
    message: data.message,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    durationMs: typeof data.durationMs === 'number' ? data.durationMs : undefined,
    completedAt: data.completedAt
  };
}
