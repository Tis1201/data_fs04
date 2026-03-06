import { mqttClient } from '../../mqttClient';
import { ActionHandlerManager } from '../../../actionHandlers/ActionHandlerManager';
import type { ActionLog } from '../../../actionHandlers/types';
import { mapActionTypeToDb } from '../../../actionHandlers/actionTypeMapping';

/**
 * Subscribes to device action log updates via MQTT.
 * Handles device:statusUpdate, device:progressUpdate, device:getLogsStatus, and device.screenshot notifications.
 */
export function subscribeActionLogUpdates(
  deviceId: string,
  getLogs: () => ActionLog[],
  setLogs: (logs: ActionLog[]) => void,
  actionStatus: any,
  onLogsDownloadTriggered?: (logId: string) => void,
  onLogsDownloadFailed?: (logId: string, message: string) => void,
  onTerminalComplete?: (status: 'success' | 'failed' | 'in_progress', message: string) => void
): () => void {
  
  const actionHandlerManager = new ActionHandlerManager({
    deviceId,
    getLogs,
    setLogs,
    actionStatus,
    onLogsDownloadTriggered,
    onLogsDownloadFailed,
    onTerminalComplete,
    onProgress: (progress: number | null, message: string, logId?: string, actionType?: string) => {
      const logs = getLogs();
      const logExists = logId ? logs.some(log => log.id === logId) : false;
      const existingLog = logId ? logs.find(log => log.id === logId) : null;

      const dbActionType = actionType 
        ? mapActionTypeToDb(actionType) 
        : existingLog?.actionType;
      
      const updatedLogs = logs.map(log => {
        if (log.id === logId) {
          const updated = { ...log, progress, message, status: 'in_progress' };
          if (actionType && actionType !== log.actionType && dbActionType) {
            updated.actionType = dbActionType;
          }
          return updated;
        }
        return log;
      });
      
      if (logId && !logExists) {
        if (dbActionType) {
          console.warn('[actionLogHandler] Log not found, creating new log', {
            logId,
            actionType: dbActionType,
            progress
          });
          updatedLogs.unshift({
            id: logId,
            deviceId: deviceId,
            actionType: dbActionType,
            status: 'in_progress',
            progress,
            initiatedAt: new Date().toISOString(),
            completedAt: null,
            durationMs: null,
            message,
            user: null
          });
        } else {
          console.warn('[actionLogHandler] Cannot create log: actionType is missing', {
            logId,
            actionType,
            existingLogActionType: existingLog?.actionType
          });
        }
      }
      
      setLogs(updatedLogs);
    },
    onSuccess: (data: any) => {
      const logs = getLogs();
      const logId = data.logId || data.id;
      
      const noProgressActions = ['restart', 'reboot', 'refresh', 'screenshot', 'snapshot', 'terminal', 'remote_desktop'];
      const shouldShowProgress = !noProgressActions.includes(data.action);
      
      const actionMap: Record<string, string[]> = {
        'pullFile': ['pullFile', 'pull_file'],
        'pushFile': ['pushFile', 'push_file'],
        'pull_file': ['pullFile', 'pull_file'],
        'push_file': ['pushFile', 'push_file'],
        'installApp': ['install_app'],
        'install': ['install_app'],
        'install_app': ['install_app'],
        'getLogs': ['getLogs', 'logs', 'get_logs'],
        'logs': ['getLogs', 'logs', 'get_logs'],
        'get_logs': ['getLogs', 'logs', 'get_logs']
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
            durationMs: data.durationMs
          };
        }
        return log;
      });
      
      if (!logs.find(log => log.id === logId)) {
        const recentLogIndex = logs.findIndex(log => 
          actionVariants.includes(log.actionType) && 
          (log.status === 'in_progress' || log.status === 'initiated')
        );
        
        if (recentLogIndex !== -1) {
          updatedLogs[recentLogIndex] = {
            ...updatedLogs[recentLogIndex],
            id: logId || updatedLogs[recentLogIndex].id,
            status: 'success',
            message: data.message || 'Action completed successfully',
            ...(shouldShowProgress && { progress: 100 }),
            completedAt: new Date().toISOString(),
            durationMs: data.durationMs
          };
        } else {
          if (data.action && data.action !== 'unknown') {
            const newLog: any = {
              id: logId || `temp-${Date.now()}`,
              deviceId,
              actionType: data.action,
              status: 'success',
              initiatedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: data.durationMs || 0,
              message: data.message || 'Action completed successfully',
              user: null
            };
            if (shouldShowProgress) {
              newLog.progress = 100;
            }
            updatedLogs.unshift(newLog);
          } else {
            console.warn('[actionLogHandler] Cannot create log: invalid action type', { action: data.action });
          }
        }
      }
      
      setLogs(updatedLogs.slice(0, 15));
    },
    onError: (error: string, logId?: string, action?: string, durationMs?: number | null) => {
      const logs = getLogs();
      
      const actionMap: Record<string, string[]> = {
        'pullFile': ['pullFile', 'pull_file'],
        'pushFile': ['pushFile', 'push_file'],
        'pull_file': ['pullFile', 'pull_file'],
        'push_file': ['pushFile', 'push_file'],
        'installApp': ['install_app'],
        'install': ['install_app'],
        'install_app': ['install_app'],
        'getLogs': ['getLogs', 'logs', 'get_logs'],
        'logs': ['getLogs', 'logs', 'get_logs'],
        'get_logs': ['getLogs', 'logs', 'get_logs']
      };
      
      const actionVariants = action ? (actionMap[action] || [action]) : [];
      
      const finalDurationMs = durationMs !== undefined && durationMs !== null 
        ? durationMs 
        : (logs.find(log => log.id === logId)?.initiatedAt 
            ? Date.now() - new Date(logs.find(log => log.id === logId)!.initiatedAt).getTime() 
            : null);
      
      const updatedLogs = logs.map(log => {
        if (log.id === logId) {
          return { 
            ...log, 
            status: 'failed', 
            message: error,
            completedAt: new Date().toISOString(),
            durationMs: finalDurationMs
          };
        }
        return log;
      });
      
      if (!logs.find(log => log.id === logId)) {
        const recentLogIndex = logs.findIndex(log => 
          (actionVariants.length === 0 || actionVariants.includes(log.actionType)) &&
          (log.status === 'in_progress' || log.status === 'initiated')
        );
        
        if (recentLogIndex !== -1) {
          const recentLog = updatedLogs[recentLogIndex];
          const recentDurationMs = durationMs !== undefined && durationMs !== null
            ? durationMs
            : (recentLog.initiatedAt ? Date.now() - new Date(recentLog.initiatedAt).getTime() : null);
          
          updatedLogs[recentLogIndex] = {
            ...updatedLogs[recentLogIndex],
            id: logId || updatedLogs[recentLogIndex].id,
            status: 'failed',
            message: error,
            completedAt: new Date().toISOString(),
            durationMs: recentDurationMs
          };
        } else {
          if (action && action !== 'unknown') {
            const newLog = {
              id: logId || `temp-${Date.now()}`,
              deviceId,
              actionType: action,
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
            console.warn('[actionLogHandler] Cannot create log: invalid action type', { error, logId, action });
          }
        }
      }
      
      setLogs(updatedLogs.slice(0, 15));
    }
  });

  const unsubscribeMqttStatus = mqttClient.onNotification('device:statusUpdate', (payload: any) => {
    const logId = payload?.logId || payload?.id;
    const action = payload?.action;
    const status = payload?.status;
    const durationMs = payload?.durationMs;
    
    if (logId) {
      const existingLog = getLogs().find(log => log.id === logId);
      if (!existingLog) {
        console.debug('[actionLogHandler] Log not found in UI state', { logId, action, status, durationMs });
      }
    }
    
    actionHandlerManager.handle('device:statusUpdate', {
      type: 'device:statusUpdate',
      durationMs,
      ...payload
    });
  });

  const unsubscribeMqttProgress = mqttClient.onNotification('device:progressUpdate', (payload: any) => {
    actionHandlerManager.handle('device:progressUpdate', {
      type: 'device:progressUpdate',
      ...payload
    });
  });

  const unsubscribeMqttScreenshot = mqttClient.onNotification('device.screenshot', (payload: any) => {
    const message = payload?.message;
    const durationMs = payload?.durationMs;
    const objectPath = payload?.objectPath;
    
    actionHandlerManager.handle('device.screenshot', {
      type: 'device.screenshot',
      action: 'screenshot',
      status: 'success',
      message,
      durationMs,
      objectPath,
      ...payload,
      payload: {
        ...payload?.payload,
        action: 'screenshot'
      }
    });
  });

  const unsubscribeMqttGetLogs = mqttClient.onNotification('device:getLogsStatus', (payload: any) => {
    actionHandlerManager.handle('device:getLogsStatus', {
      type: 'device:getLogsStatus',
      ...payload,
      payload: { ...payload?.payload, objectPath: payload?.objectPath ?? payload?.payload?.objectPath }
    });
  });

  return () => {
    try {
      unsubscribeMqttStatus();
      unsubscribeMqttProgress();
      unsubscribeMqttScreenshot();
      unsubscribeMqttGetLogs();
    } catch (e) {
      console.error('[actionLogHandler] Error unsubscribing from MQTT', { error: e });
    }
  };
}
