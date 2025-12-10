import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';

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
    // Extract action from entity payload
    const action = entity?.payload?.action;
    console.log(`[${this.actionType}Handler] Processing message:`, { evtType, action, actionType: this.actionType });
    
    // Handle unified status update messages from API responses
    // Check both the original action and mapped action type
    const isMatchingAction = action === this.actionType || 
                            (evtType === 'device:statusUpdate' && this.isActionMatch(action));
    
    console.log(`[${this.actionType}Handler] Action matching:`, { 
      directMatch: action === this.actionType, 
      mappedMatch: evtType === 'device:statusUpdate' && this.isActionMatch(action),
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
    // Map original actions to handler action types
    const actionMap: Record<string, string> = {
      'updateFirmware': 'firmware_update',
      'installApp': 'install',
      'pullFile': 'pull_file',
      'pushFile': 'file_operation',
      'getLogs': 'logs'
    };
    
    const mappedAction = actionMap[action];
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
  protected handleUnifiedStatus(entity: any): void {
    // Extract data from entity payload
    const { action, status, message, logId, progress, durationMs } = entity.payload;

    console.log(`[${this.actionType}Handler] Unified status update:`, { action, status, message, logId, progress, durationMs });

    if (status === 'complete' || status === 'success') {
      this.handleSuccess({ 
        action, 
        status, 
        message: message || `${action} completed`, 
        logId, 
        durationMs 
      }, logId);
    } else if (status === 'failed' || status === 'error') {
      this.handleError(message || `${action} failed`, logId);
    } else if (progress !== undefined) {
      // Handle progress updates
      this.handleProgress(progress, message || `${action} progress: ${progress}%`, logId);
    } else {
      // Handle general status updates
      this.handleProgress(0, message || `${action} in progress`, logId);
    }
  }

  /**
   * Handle progress update messages from device
   */
  private handleProgressUpdate(entity: any): void {
    // Extract data from entity payload
    const { action, progress, message, logId } = entity.payload;

    console.log(`[${this.actionType}Handler] Progress update:`, { action, progress, message, logId });

    if (progress !== undefined) {
      // Handle progress updates
      this.handleProgress(progress, message || `${action} progress: ${progress}%`, logId);
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
    super(params, 'install');
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
