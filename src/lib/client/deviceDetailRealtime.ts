import { sseStore } from '$lib/stores/sse-store';
import { ActionHandlerManager } from './actionHandlers/ActionHandlerManager';
import type { ActionLog } from './actionHandlers/types';

/**
 * Subscribes to device detail realtime events and updates action logs.
 * This is the refactored version using the new action handler system.
 * Returns an unsubscribe function.
 */
export function subscribeDeviceDetailEvents(
  deviceId: string,
  getLogs: () => ActionLog[],
  setLogs: (logs: ActionLog[]) => void,
  actionStatus: any
): () => void {
  console.log('[DeviceDetailRealtime] subscribeDeviceDetailEvents called for deviceId:', deviceId);
  
  // Create action handler manager with UI update callbacks
  const actionHandlerManager = new ActionHandlerManager({
    deviceId,
    getLogs,
    setLogs,
    actionStatus,
    onProgress: (progress: number, message: string, logId?: string) => {
      console.log(`[DeviceDetailRealtime] Progress: ${progress}% - ${message} (logId: ${logId})`);
      // Update action logs with progress
      const logs = getLogs();
      const updatedLogs = logs.map(log => 
        log.id === logId 
          ? { ...log, progress, message, status: 'in_progress' }
          : log
      );
      setLogs(updatedLogs);
    },
    onSuccess: (data: any) => {
      console.log(`[DeviceDetailRealtime] Success:`, data);
      // Update action logs with success
      const logs = getLogs();
      const logId = data.logId || data.id;
      console.log(`[DeviceDetailRealtime] Looking for logId: ${logId} in ${logs.length} logs`);
      
      const updatedLogs = logs.map(log => {
        if (log.id === logId) {
          console.log(`[DeviceDetailRealtime] Updating log ${logId} with success status`);
          return { 
            ...log, 
            status: 'success', 
            message: data.message || 'Action completed successfully',
            progress: 100,
            completedAt: new Date().toISOString(),
            durationMs: data.durationMs // Use server-calculated duration
          };
        }
        return log;
      });
      
      // If no existing log found, try to update the most recent log with the same action type
      if (!logs.find(log => log.id === logId)) {
        console.log(`[DeviceDetailRealtime] No existing log found with logId ${logId}, looking for recent ${data.action} action`);
        
        // Find the most recent log with the same action type that's in progress
        const recentLogIndex = logs.findIndex(log => 
          log.actionType === data.action && 
          (log.status === 'in_progress' || log.status === 'initiated')
        );
        
        if (recentLogIndex !== -1) {
          console.log(`[DeviceDetailRealtime] Updating recent ${data.action} log at index ${recentLogIndex}`);
          updatedLogs[recentLogIndex] = {
            ...updatedLogs[recentLogIndex],
            id: logId || updatedLogs[recentLogIndex].id, // Use the new logId if provided
            status: 'success',
            message: data.message || 'Action completed successfully',
            progress: 100,
            completedAt: new Date().toISOString(),
            durationMs: data.durationMs // Use server-calculated duration
          };
        } else {
          console.log(`[DeviceDetailRealtime] No recent ${data.action} log found, creating new success log`);
          const newLog = {
            id: logId || `temp-${Date.now()}`,
            deviceId,
            actionType: data.action || 'unknown',
            status: 'success',
            progress: 100,
            initiatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: data.durationMs || 0, // Use server-calculated duration
            message: data.message || 'Action completed successfully',
            user: null
          };
          updatedLogs.unshift(newLog);
        }
      }
      
      setLogs(updatedLogs.slice(0, 15)); // Keep only last 15 logs
    },
    onError: (error: string, logId?: string) => {
      console.error(`[DeviceDetailRealtime] Error:`, error, `(logId: ${logId})`);
      // Update action logs with error
      const logs = getLogs();
      const updatedLogs = logs.map(log => {
        if (log.id === logId) {
          console.log(`[DeviceDetailRealtime] Updating log ${logId} with error status`);
          return { 
            ...log, 
            status: 'failed', 
            message: error,
            completedAt: new Date().toISOString(),
            durationMs: log.initiatedAt ? Date.now() - new Date(log.initiatedAt).getTime() : null
          };
        }
        return log;
      });
      
      // If no existing log found, try to update the most recent log with the same action type
      if (!logs.find(log => log.id === logId)) {
        console.log(`[DeviceDetailRealtime] No existing log found with logId ${logId}, looking for recent in-progress action`);
        
        // Find the most recent log that's in progress
        const recentLogIndex = logs.findIndex(log => 
          log.status === 'in_progress' || log.status === 'initiated'
        );
        
        if (recentLogIndex !== -1) {
          console.log(`[DeviceDetailRealtime] Updating recent in-progress log at index ${recentLogIndex}`);
          updatedLogs[recentLogIndex] = {
            ...updatedLogs[recentLogIndex],
            id: logId || updatedLogs[recentLogIndex].id, // Use the new logId if provided
            status: 'failed',
            message: error,
            completedAt: new Date().toISOString(),
            durationMs: updatedLogs[recentLogIndex].initiatedAt ? 
              Date.now() - new Date(updatedLogs[recentLogIndex].initiatedAt).getTime() : null
          };
        } else {
          console.log(`[DeviceDetailRealtime] No recent in-progress log found, creating new error log`);
          const newLog = {
            id: logId || `temp-${Date.now()}`,
            deviceId,
            actionType: 'unknown',
            status: 'failed',
            progress: null,
            initiatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            message: error,
            user: null
          };
          updatedLogs.unshift(newLog);
        }
      }
      
      setLogs(updatedLogs.slice(0, 15)); // Keep only last 15 logs
    }
  });

  const unsubscribe = sseStore.on('*', (msg: any) => {
    console.log('[DeviceDetailRealtime] Received message:', msg);
    
    // Parse message data
    const evt = msg?.data ?? msg;
    const evtType = evt?.type || msg?.event || evt?.payload?.type || msg?.type;
    
    // Enhanced debugging for device messages
    if (evtType && evtType.startsWith('device:')) {
      console.log('[DeviceDetailRealtime] Device message detected:', {
        evtType,
        msgEvent: msg?.event,
        evtTypeFromEvt: evt?.type,
        evtTypeFromMsg: msg?.type,
        payloadType: evt?.payload?.type,
        fullEvt: evt,
        fullMsg: msg
      });
    }

    // Pass the full message structure to the ActionHandlerManager
    // The ActionHandlerManager will use parseSSEMessage to extract the payload
    const fullMessage = evt;

    // Route to appropriate action handler
    actionHandlerManager.handle(evtType, fullMessage);
  });

  return () => {
    try { 
      unsubscribe(); 
    } catch (e) {
      console.error('[DeviceDetailRealtime] Error unsubscribing:', e);
    }
  };
}
