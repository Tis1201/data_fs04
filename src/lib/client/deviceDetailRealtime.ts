import { sseStore as defaultSseStore } from '$lib/stores/sse-store';
import { mqttClient } from './mqtt/mqttClient';
import { ActionHandlerManager } from './actionHandlers/ActionHandlerManager';
import type { ActionLog } from './actionHandlers/types';

/**
 * Subscribes to device detail realtime events and updates action logs.
 * This is the refactored version using the new action handler system.
 * Returns an unsubscribe function.
 * 
 * @param sseStore Optional SSE store instance (for per-component SSE). If not provided, uses singleton.
 */
export function subscribeDeviceDetailEvents(
  deviceId: string,
  getLogs: () => ActionLog[],
  setLogs: (logs: ActionLog[]) => void,
  actionStatus: any,
  sseStore?: any  // Optional: use per-component SSE store if provided
): () => void {
  // Use provided SSE store or fall back to singleton
  const sse = sseStore || defaultSseStore;
  
  // Create action handler manager with UI update callbacks
  const actionHandlerManager = new ActionHandlerManager({
    deviceId,
    getLogs,
    setLogs,
    actionStatus,
    onProgress: (progress: number, message: string, logId?: string) => {
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
      // Update action logs with success
      const logs = getLogs();
      const logId = data.logId || data.id;
      
      // Actions that don't have progress tracking (restart/reboot/refresh)
      const noProgressActions = ['restart', 'reboot', 'refresh'];
      const shouldShowProgress = !noProgressActions.includes(data.action);
      
      const updatedLogs = logs.map(log => {
        if (log.id === logId) {
          return { 
            ...log, 
            status: 'success', 
            message: data.message || 'Action completed successfully',
            ...(shouldShowProgress && { progress: 100 }),
            completedAt: new Date().toISOString(),
            durationMs: data.durationMs // Use server-calculated duration
          };
        }
        return log;
      });
      
      // If no existing log found, try to update the most recent log with the same action type
      if (!logs.find(log => log.id === logId)) {
        // Find the most recent log with the same action type that's in progress
        const recentLogIndex = logs.findIndex(log => 
          log.actionType === data.action && 
          (log.status === 'in_progress' || log.status === 'initiated')
        );
        
        if (recentLogIndex !== -1) {
          updatedLogs[recentLogIndex] = {
            ...updatedLogs[recentLogIndex],
            id: logId || updatedLogs[recentLogIndex].id, // Use the new logId if provided
            status: 'success',
            message: data.message || 'Action completed successfully',
            ...(shouldShowProgress && { progress: 100 }),
            completedAt: new Date().toISOString(),
            durationMs: data.durationMs // Use server-calculated duration
          };
        } else {
          const newLog: any = {
            id: logId || `temp-${Date.now()}`,
            deviceId,
            actionType: data.action || 'unknown',
            status: 'success',
            initiatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: data.durationMs || 0, // Use server-calculated duration
            message: data.message || 'Action completed successfully',
            user: null
          };
          if (shouldShowProgress) {
            newLog.progress = 100;
          }
          updatedLogs.unshift(newLog);
        }
      }
      
      setLogs(updatedLogs.slice(0, 15)); // Keep only last 15 logs
    },
    onError: (error: string, logId?: string) => {
      // Update action logs with error
      const logs = getLogs();
      const updatedLogs = logs.map(log => {
        if (log.id === logId) {
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
        // Find the most recent log that's in progress
        const recentLogIndex = logs.findIndex(log => 
          log.status === 'in_progress' || log.status === 'initiated'
        );
        
        if (recentLogIndex !== -1) {
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

  const unsubscribe = sse.on('*', (msg: any) => {
    // Parse message data
    const evt = msg?.data ?? msg;
    const evtType = evt?.type || msg?.event || evt?.payload?.type || msg?.type;

    // Skip ActionHandlerManager for device:connection messages (handled by UI components)
    if (evtType === 'device:connection') {
      return;
    }

    // Pass the full message structure to the ActionHandlerManager
    // The ActionHandlerManager will use parseSSEMessage to extract the payload
    const fullMessage = evt;

    // Route to appropriate action handler
    actionHandlerManager.handle(evtType, fullMessage);
  });

  // Also subscribe to MQTT notifications for device actions
  const unsubscribeMqttStatus = mqttClient.onNotification('device:statusUpdate', (payload: any) => {
    console.log('[deviceDetailRealtime] Received device:statusUpdate:', payload);
    
    // Convert MQTT notification to ActionHandlerManager format
    const fullMessage = {
      type: 'device:statusUpdate',
      ...payload
    };
    
    actionHandlerManager.handle('device:statusUpdate', fullMessage);
  });

  const unsubscribeMqttProgress = mqttClient.onNotification('device:progressUpdate', (payload: any) => {
    console.log('[deviceDetailRealtime] Received device:progressUpdate:', payload);
    
    // Convert MQTT notification to ActionHandlerManager format
    const fullMessage = {
      type: 'device:progressUpdate',
      ...payload
    };
    
    actionHandlerManager.handle('device:progressUpdate', fullMessage);
  });

  return () => {
    try { 
      unsubscribe(); 
    } catch (e) {
      // Error unsubscribing from SSE
    }
    try {
      unsubscribeMqttStatus();
      unsubscribeMqttProgress();
    } catch (e) {
      // Error unsubscribing from MQTT
    }
  };
}
