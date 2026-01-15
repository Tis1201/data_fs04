import { BaseActionHandler } from './BaseActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';
import { mapActionTypeToDb } from './actionTypeMapping';

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
    const { action, status, message, logId } = entity;
    // Extract durationMs from entity or payload (server sends it in payload)
    const durationMs = entity.durationMs ?? entity.payload?.durationMs;
    const actionType = this.actionType;

    console.log(`[${actionType}Handler] Unified status update:`, { 
      action, 
      status, 
      message, 
      logId,
      durationMs,
      entity
    });

    // Use centralized action type mapping
    const dbActionType = mapActionTypeToDb(actionType);

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
      // Pass server-calculated duration if available
      this.handleError(message || `${actionType} failed`, logId, dbActionType, durationMs);
    } else {
      // Simple actions (refresh, reboot, restart) don't have progress
      // Pass null for progress and the actionType
      this.handleProgress(null, message || `${actionType} in progress`, logId, dbActionType);
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
