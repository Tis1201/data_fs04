import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';

/**
 * Handler for simple actions that send command and wait for completion
 * Examples: reboot, restart
 */
export class SimpleActionHandler extends BaseActionHandler {
  private actionType: string;

  constructor(
    params: ActionHandlerParams,
    actionType: string
  ) {
    super(params);
    this.actionType = actionType;
  }

  handle(evtType: string, entity: DeviceMessageEntity): void {
    // Get the mapped action type for this entity
    const mappedActionType = MessageEntityMapper.getActionType(entity);
    
    // Handle status update messages
    if (MessageEntityMapper.isStatusUpdate(entity) && mappedActionType === this.actionType) {
      this.handleUnifiedStatus(entity);
      return;
    }

    // Only handle the new unified flow - no legacy support
    console.log(`[${this.actionType}Handler] Ignoring message:`, { 
      type: entity.type, 
      action: entity.action, 
      mappedActionType,
      expectedAction: this.actionType 
    });
  }

  /**
   * Handle unified status update messages using entity
   */
  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const { action, status, message, logId, durationMs } = entity;
    const actionType = this.actionType;

    console.log(`[${actionType}Handler] Unified status update:`, { 
      action, 
      status, 
      message, 
      logId,
      durationMs,
      entity
    });

    if (status === 'complete' || status === 'success') {
      // Use server-calculated duration instead of calculating locally
      this.handleSuccess({ 
        action: actionType, 
        status, 
        message: message || `${actionType} completed`, 
        logId, 
        durationMs // Pass server-calculated duration
      }, logId);
    } else if (status === 'failed' || status === 'fail') {
      this.handleError(message || `${actionType} failed`, logId);
    } else {
      // Handle progress updates (in_progress, etc.)
      this.handleProgress(0, message || `${actionType} in progress`, logId);
    }
  }

}

/**
 * Reboot action handler
 */
export class RebootHandler extends SimpleActionHandler {
  constructor(params: any) {
    super(params, 'reboot');
  }
}

/**
 * Restart action handler
 */
export class RestartHandler extends SimpleActionHandler {
  constructor(params: any) {
    super(params, 'restart');
  }
}
