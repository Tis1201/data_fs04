import { mqttClient } from '../../mqttClient';
import { ActionHandlerManager } from '../../../actionHandlers/ActionHandlerManager';
import type { ActionLog } from '../../../actionHandlers/types';

/**
 * Subscribes to device action log updates via MQTT.
 * Handles device:statusUpdate and device:progressUpdate notifications
 * and updates action logs via ActionHandlerManager.
 * 
 * @param deviceId - The device ID to subscribe to
 * @param getLogs - Function to get current action logs
 * @param setLogs - Function to update action logs
 * @param actionStatus - Action status store
 * @returns Unsubscribe function
 */
export function subscribeActionLogUpdates(
  deviceId: string,
  getLogs: () => ActionLog[],
  setLogs: (logs: ActionLog[]) => void,
  actionStatus: any
): () => void {
  
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
      
      // Map action types for matching (handle both original and mapped action types)
      const actionMap: Record<string, string[]> = {
        'pullFile': ['pullFile', 'pull_file'],
        'pushFile': ['pushFile', 'push_file'],
        'pull_file': ['pullFile', 'pull_file'],
        'push_file': ['pushFile', 'push_file'],
        'installApp': ['installApp', 'install'],
        'install': ['installApp', 'install'],
        'getLogs': ['getLogs', 'logs'],
        'logs': ['getLogs', 'logs']
      };
      
      const actionVariants = actionMap[data.action] || [data.action];
      
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
        // Find the most recent log with matching action type (check all variants)
        const recentLogIndex = logs.findIndex(log => 
          actionVariants.includes(log.actionType) && 
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
          // Only create new log if we have a valid action type
          if (data.action && data.action !== 'unknown') {
            const newLog: any = {
              id: logId || `temp-${Date.now()}`,
              deviceId,
              actionType: data.action, // Use the action from data
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
          } else {
            console.warn('[actionLogHandler] Cannot create log entry: missing or invalid action type', data);
          }
        }
      }
      
      setLogs(updatedLogs.slice(0, 15)); // Keep only last 15 logs
    },
    onError: (error: string, logId?: string, action?: string) => {
      // Update action logs with error
      const logs = getLogs();
      
      // Map action types for matching (handle both original and mapped action types)
      const actionMap: Record<string, string[]> = {
        'pullFile': ['pullFile', 'pull_file'],
        'pushFile': ['pushFile', 'push_file'],
        'pull_file': ['pullFile', 'pull_file'],
        'push_file': ['pushFile', 'push_file'],
        'installApp': ['installApp', 'install'],
        'install': ['installApp', 'install'],
        'getLogs': ['getLogs', 'logs'],
        'logs': ['getLogs', 'logs']
      };
      
      const actionVariants = action ? (actionMap[action] || [action]) : [];
      
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
        // Find the most recent log with matching action type (check all variants)
        const recentLogIndex = logs.findIndex(log => 
          (actionVariants.length === 0 || actionVariants.includes(log.actionType)) &&
          (log.status === 'in_progress' || log.status === 'initiated')
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
          // Only create new log if we have a valid action type
          if (action && action !== 'unknown') {
            const newLog = {
              id: logId || `temp-${Date.now()}`,
              deviceId,
              actionType: action, // Use the action from parameter
              status: 'failed',
              progress: null,
              initiatedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: 0,
              message: error,
              user: null
            };
            updatedLogs.unshift(newLog);
          } else {
            console.warn('[actionLogHandler] Cannot create log entry: missing or invalid action type', { error, logId, action });
          }
        }
      }
      
      setLogs(updatedLogs.slice(0, 15)); // Keep only last 15 logs
    }
  });

  // Subscribe to MQTT notifications for device actions
  const unsubscribeMqttStatus = mqttClient.onNotification('device:statusUpdate', (payload: any) => {
    console.log('[actionLogHandler] ✅ Received device:statusUpdate:', payload);
    console.log('[actionLogHandler] Payload keys:', payload ? Object.keys(payload) : 'null');
    console.log('[actionLogHandler] Payload content:', JSON.stringify(payload, null, 2));
    
    // Convert MQTT notification to ActionHandlerManager format
    const fullMessage = {
      type: 'device:statusUpdate',
      ...payload
    };
    
    console.log('[actionLogHandler] Calling actionHandlerManager.handle with:', fullMessage);
    actionHandlerManager.handle('device:statusUpdate', fullMessage);
    console.log('[actionLogHandler] actionHandlerManager.handle completed');
  });

  const unsubscribeMqttProgress = mqttClient.onNotification('device:progressUpdate', (payload: any) => {
    console.log('[actionLogHandler] ✅ Received device:progressUpdate:', payload);
    console.log('[actionLogHandler] Payload keys:', payload ? Object.keys(payload) : 'null');
    console.log('[actionLogHandler] Payload content:', JSON.stringify(payload, null, 2));
    
    // Convert MQTT notification to ActionHandlerManager format
    const fullMessage = {
      type: 'device:progressUpdate',
      ...payload
    };
    
    console.log('[actionLogHandler] Calling actionHandlerManager.handle with:', fullMessage);
    actionHandlerManager.handle('device:progressUpdate', fullMessage);
    console.log('[actionLogHandler] actionHandlerManager.handle completed');
  });

  return () => {
    try {
      unsubscribeMqttStatus();
      unsubscribeMqttProgress();
    } catch (e) {
      // Error unsubscribing from MQTT
    }
  };
}

