import type { ActionHandlerParams, MessageData } from './types';
import { MessageEntityMapper, type DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';
import { RebootHandler } from './SimpleActionHandler';
import { RestartHandler } from './SimpleActionHandler';
import { FirmwareHandler } from './ProgressActionHandler';
import { InstallAppHandler } from './ProgressActionHandler';
import { PullFileHandler } from './ProgressActionHandler';
import { PushFileHandler } from './StreamActionHandler';
import { LogsHandler } from './StreamActionHandler';
import { SnapshotHandler } from './SnapshotHandler';
import { TerminalHandler } from './TerminalHandler';
import { FileOperationHandler } from './FileOperationHandler';
import { BundleStatusHandler } from './BundleStatusHandler';

/**
 * Manages all action handlers for device real-time updates
 */
export class ActionHandlerManager {
  private handlers: Map<string, any> = new Map();

  constructor(params: ActionHandlerParams) {
    // Initialize all action handlers
    this.handlers.set('reboot', new RebootHandler(params));
    this.handlers.set('restart', new RestartHandler(params));
    this.handlers.set('firmware_update', new FirmwareHandler(params));
    this.handlers.set('install', new InstallAppHandler(params));
    // Note: pull_file and push_file now use FileOperationHandler
    this.handlers.set('logs', new LogsHandler(params));
    this.handlers.set('snapshot', new SnapshotHandler(params));
    this.handlers.set('terminal', new TerminalHandler(params));
    this.handlers.set('file_operation', new FileOperationHandler(params, 'push')); // For push operations
    this.handlers.set('pull_file', new FileOperationHandler(params, 'pull')); // For pull operations
    this.handlers.set('bundle_status', new BundleStatusHandler(params)); // For bundle status updates
  }

  /**
   * Handle incoming message by routing to appropriate handler
   */
  handle(evtType: string, data: MessageData): void {
    console.log('[ActionHandlerManager] RAW INPUT:', { evtType, data });
    
    // Map raw message to entity
    const entity = MessageEntityMapper.mapToEntity(data);
    
    if (!entity) {
      console.log('[ActionHandlerManager] Failed to map message to entity:', { evtType, data });
      return;
    }

    console.log('[ActionHandlerManager] MAPPED ENTITY:', entity);

    // Check if message should be ignored
    if (MessageEntityMapper.shouldIgnore(entity)) {
      console.log('[ActionHandlerManager] Ignoring message:', { type: entity.type, reason: 'system message' });
      return;
    }

    // Extract action type from entity
    const actionType = MessageEntityMapper.getActionType(entity);
    
    console.log('[ActionHandlerManager] ACTION TYPE:', actionType);
    console.log('[ActionHandlerManager] AVAILABLE HANDLERS:', Array.from(this.handlers.keys()));
    
    if (!actionType) {
      console.log('[ActionHandlerManager] Unknown action type for entity:', { 
        type: entity.type, 
        action: entity.action 
      });
      return;
    }

    const handler = this.handlers.get(actionType);
    if (handler) {
      console.log('[ActionHandlerManager] Routing to handler:', actionType, 'for entity:', entity);
      handler.handle(evtType, entity);
    } else {
      console.log('[ActionHandlerManager] No handler found for action type:', actionType);
    }
  }


  /**
   * Get handler for specific action type
   */
  getHandler(actionType: string) {
    return this.handlers.get(actionType);
  }

  /**
   * Get all handlers
   */
  getAllHandlers() {
    return this.handlers;
  }
}
