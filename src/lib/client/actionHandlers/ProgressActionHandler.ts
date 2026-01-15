import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { mapActionTypeToDb } from './actionTypeMapping';

/**
 * Handler for actions that have progress updates
 * Examples: firmware update, install app, pull file
 */
export class ProgressActionHandler extends BaseActionHandler {
  private actionType: string;

  constructor(
    params: ActionHandlerParams,
    actionType: string
  ) {
    super(params);
    this.actionType = actionType;
  }

  handle(evtType: string, entity: any): void {
    // Extract action from entity (check both entity.action and entity.payload.action for compatibility)
    const action = entity?.action || entity?.payload?.action;
    console.log(`[${this.actionType}Handler] Processing message:`, { evtType, action, actionType: this.actionType, entityAction: entity?.action, payloadAction: entity?.payload?.action });
    
    // Handle unified status update messages from API responses
    // Check both the original action and mapped action type (for both status and progress updates)
    const isMatchingAction = action === this.actionType || this.isActionMatch(action);
    
    console.log(`[${this.actionType}Handler] Action matching:`, { 
      directMatch: action === this.actionType, 
      mappedMatch: this.isActionMatch(action),
      isMatchingAction 
    });
    
    if (evtType === 'device:statusUpdate' && isMatchingAction) {
      console.log(`[${this.actionType}Handler] Handling unified status update`);
      this.handleUnifiedStatus(entity);
      return;
    }

    // Handle progress update messages from device
    if (evtType === 'device:progressUpdate' && isMatchingAction) {
      console.log(`[${this.actionType}Handler] Handling progress update`);
      this.handleProgressUpdate(entity);
      return;
    }

    // Only handle the new unified flow - no legacy support
    console.log(`[${this.actionType}Handler] Ignoring legacy message type: ${evtType}`);
  }

  /**
   * Check if the action matches this handler's action type
   */
  private isActionMatch(action: string): boolean {
    if (action === this.actionType) {
      return true;
    }
    
    const legacyMap: Record<string, string> = {
      'updateFirmware': 'update_firmware',
      'installApp': 'install_app',
      'pullFile': 'pull_file',
      'pushFile': 'push_file',
      'getLogs': 'get_logs'
    };
    
    const mappedAction = legacyMap[action];
    const matches = mappedAction === this.actionType;
    
    console.log(`[${this.actionType}Handler] Action mapping:`, { 
      action, 
      mappedAction, 
      actionType: this.actionType, 
      matches 
    });
    
    return matches;
  }

  /**
   * Handle unified status update messages
   */
  /**
   * Extract progress percentage from message text (fallback when progress field is missing)
   * Examples: "Downloading... 70%" -> 70, "Installing... 50%" -> 50
   */
  private extractProgressFromMessage(message: string | undefined): number | undefined {
    if (!message) return undefined;
    const match = message.match(/(\d+)%/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
    }
    return undefined;
  }

  protected handleUnifiedStatus(entity: any): void {
    // Extract data from entity (check both entity and entity.payload for compatibility)
    const action = entity.action || entity.payload?.action;
    const status = entity.status || entity.payload?.status;
    const message = entity.message || entity.payload?.message;
    const logId = entity.logId || entity.payload?.logId;
    let progress = entity.progress ?? entity.payload?.progress;
    const durationMs = entity.durationMs || entity.payload?.durationMs;

    // FALLBACK: Parse progress from message text if progress field is missing
    // Device sends progress in message like "Downloading... 70%" but not as progress field
    if ((progress === undefined || progress === null) && message) {
      const parsedProgress = this.extractProgressFromMessage(message);
      if (parsedProgress !== undefined) {
        progress = parsedProgress;
        console.log(`[${this.actionType}Handler] Extracted progress from message text:`, {
          message: message.substring(0, 100),
          extractedProgress: progress
        });
      }
    }

    const currentLogs = this.getLogs();
    const logExists = logId ? currentLogs.some(log => log.id === logId) : false;
    const existingLog = logId ? currentLogs.find(log => log.id === logId) : null;

    console.log(`[${this.actionType}Handler] Unified status update:`, { 
      action, 
      status, 
      message: message?.substring(0, 100), 
      logId, 
      progress, 
      durationMs,
      logExists,
      existingLogStatus: existingLog?.status,
      existingLogProgress: existingLog?.progress,
      currentLogsCount: currentLogs.length,
      allLogIds: currentLogs.map(log => ({ id: log.id, actionType: log.actionType, status: log.status }))
    });

    // Special handling for "initiated" status - create log if it doesn't exist
    if (status === 'initiated' && logId) {
      const currentLogs = this.getLogs();
      const logExists = currentLogs.some(log => log.id === logId);
      
      console.log(`[${this.actionType}Handler] Handling 'initiated' status:`, {
        logId,
        action,
        logExists,
        currentLogsCount: currentLogs.length,
        willCreateLog: !logExists
      });
      
      if (!logExists) {
        // Create initial log entry
        const newLog: any = {
          id: logId,
          deviceId: this.deviceId,
          actionType: this.actionType === 'install' ? 'install_app' : this.actionType,
          status: 'initiated',
          progress: null,
          initiatedAt: new Date().toISOString(),
          completedAt: null,
          durationMs: null,
          message: message || `${action} initiated`,
          user: null
        };
        
        const updatedLogs = [newLog, ...currentLogs].slice(0, 15);
        this.setLogs(updatedLogs);
        
        console.log(`[${this.actionType}Handler] Created initial log entry:`, {
          logId,
          actionType: newLog.actionType,
          status: newLog.status,
          totalLogs: updatedLogs.length
        });
      } else {
        // Update existing log
        const updatedLogs = currentLogs.map(log => 
          log.id === logId 
            ? { ...log, status: 'initiated', message: message || `${action} initiated` }
            : log
        );
        this.setLogs(updatedLogs);
        console.log(`[${this.actionType}Handler] Updated existing log to 'initiated':`, {
          logId,
          totalLogs: updatedLogs.length
        });
      }
      return; // Don't process further for "initiated" status
    }

    if (status === 'complete' || status === 'success') {
      this.handleSuccess({ 
        action, 
        status, 
        message: message || `${action} completed`, 
        logId, 
        durationMs 
      }, logId);
    } else if (status === 'failed' || status === 'error') {
      // Use centralized action type mapping
      const dbActionType = mapActionTypeToDb(this.actionType);
      // Pass server-calculated duration if available
      this.handleError(message || `${action} failed`, logId, dbActionType, durationMs);
    } else if (progress !== undefined && progress !== null) {
      // Use centralized action type mapping
      const dbActionType = mapActionTypeToDb(this.actionType);
      // Handle progress updates
      this.handleProgress(progress, message || `${action} progress: ${progress}%`, logId, dbActionType);
    } else {
      // Use centralized action type mapping
      const dbActionType = mapActionTypeToDb(this.actionType);
      
      // Handle general status updates (no progress available)
      // Try to extract progress from message as fallback
      const extractedProgress = this.extractProgressFromMessage(message);
      if (extractedProgress !== undefined) {
        console.log(`[${this.actionType}Handler] Using extracted progress for general status update:`, {
          extractedProgress,
          message: message?.substring(0, 100)
        });
        this.handleProgress(extractedProgress, message || `${action} in progress`, logId, dbActionType);
      } else {
        // No progress in message - preserve existing progress instead of resetting to 0
        // Only update message and status, don't change progress
        const logs = this.getLogs();
        const existingLog = logId ? logs.find(log => log.id === logId) : null;
        const existingProgress = existingLog?.progress;
        
        if (existingProgress !== null && existingProgress !== undefined && existingProgress > 0) {
          // Preserve existing progress, just update message
          console.log(`[${this.actionType}Handler] Preserving existing progress (no percentage in message):`, {
            message: message?.substring(0, 100),
            existingProgress,
            logId
          });
          const updatedLogs = logs.map(log => 
            log.id === logId 
              ? { ...log, message: message || `${action} in progress`, status: 'in_progress' }
              : log
          );
          this.setLogs(updatedLogs);
        } else {
          // No existing progress, set to 0
          this.handleProgress(0, message || `${action} in progress`, logId, dbActionType);
        }
      }
    }
  }

  /**
   * Handle progress update messages from device
   */
  private handleProgressUpdate(entity: any): void {
    // Extract data from entity (check both entity and entity.payload for compatibility)
    const action = entity.action || entity.payload?.action;
    const progress = entity.progress ?? entity.payload?.progress;
    const message = entity.message || entity.payload?.message;
    const logId = entity.logId || entity.payload?.logId;

    console.log(`[${this.actionType}Handler] Progress update:`, { action, progress, message, logId });

    if (progress !== undefined) {
      // Use centralized action type mapping
      const dbActionType = mapActionTypeToDb(this.actionType);
      // Handle progress updates
      this.handleProgress(progress, message || `${action} progress: ${progress}%`, logId, dbActionType);
    }
  }
}

/**
 * Firmware update handler
 */
export class FirmwareHandler extends ProgressActionHandler {
  constructor(params: any) {
    super(params, 'firmware_update');
  }
}

/**
 * Install app handler
 */
export class InstallAppHandler extends ProgressActionHandler {
  constructor(params: any) {
    super(params, 'install_app');
  }
}

/**
 * Pull file handler
 */
export class PullFileHandler extends ProgressActionHandler {
  constructor(params: any) {
    super(params, 'pull_file');
  }
}
