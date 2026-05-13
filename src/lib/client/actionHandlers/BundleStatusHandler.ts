import { ProgressActionHandler } from './ProgressActionHandler';
import type { MessageData, ActionHandlerParams } from './types';
import type { DeviceMessageEntity } from '$lib/entities/DeviceMessageEntity';

/**
 * Handler for bundle status updates
 * Handles bundle installation progress and status updates
 */
export class BundleStatusHandler extends ProgressActionHandler {
  constructor(params: ActionHandlerParams) {
    super(params, 'bundle_status');
  }

  handle(evtType: string, entity: DeviceMessageEntity): void {
    const data = (entity?.payload || {}) as MessageData;

    // Handle unified status update messages from API responses
    if (evtType === 'device:statusUpdate' && data?.action === 'bundleStatus') {
      this.handleUnifiedStatus(entity);
      return;
    }

    // Handle progress update messages from device
    if (evtType === 'device:progressUpdate' && data?.action === 'bundleStatus') {
      this.handleBundleProgressUpdate(entity);
      return;
    }

    // Only handle the new unified flow - no legacy support
    console.log(`[bundleStatusHandler] Ignoring legacy message type: ${evtType}`);
  }

  /**
   * Handle unified status update messages for bundle status
   */
  protected handleUnifiedStatus(entity: DeviceMessageEntity): void {
    const data = (entity?.payload || {}) as MessageData;
    const actionType = 'bundle_status';
    // Data structure: { action, status, message, logId, progress, timestamp, waveId, devicesTotal, devicesCompleted, devicesFailed } directly in data
    const status = data.status;
    const message = data.message || `${actionType} ${status}`;
    const logId = data.logId;
    const progress = data.progress;
    const waveId = data.waveId;
    const devicesTotal = data.devicesTotal;
    const devicesCompleted = data.devicesCompleted;
    const devicesFailed = data.devicesFailed;

    console.log(`[bundleStatusHandler] Unified status update:`, { 
      status, 
      message, 
      logId, 
      progress, 
      waveId, 
      devicesTotal, 
      devicesCompleted, 
      devicesFailed 
    });

    if (status === 'complete' || status === 'success') {
      this.handleSuccess({ 
        action: actionType, 
        status, 
        message, 
        logId, 
        progress: 100,
        waveId,
        devicesTotal,
        devicesCompleted,
        devicesFailed
      }, logId);
    } else if (status === 'fail' || status === 'failed') {
      this.handleError(message, logId, 'bundle_status');
    } else {
      // Handle progress updates
      this.handleProgress(progress || 0, message, logId);
    }
  }

  /**
   * Handle progress update messages for bundle status
   */
  private handleBundleProgressUpdate(entity: DeviceMessageEntity): void {
    const data = (entity?.payload || {}) as MessageData;
    const actionType = 'bundle_status';
    // Data structure: { action, progress, message, logId, timestamp, waveId, devicesTotal, devicesCompleted, devicesFailed } directly in data
    const progress = data.progress;
    const message = data.message || `${actionType} progress: ${progress}%`;
    const logId = data.logId;
    const waveId = data.waveId;
    const devicesTotal = data.devicesTotal;
    const devicesCompleted = data.devicesCompleted;
    const devicesFailed = data.devicesFailed;

    console.log(`[bundleStatusHandler] Progress update:`, { 
      progress, 
      message, 
      logId, 
      waveId, 
      devicesTotal, 
      devicesCompleted, 
      devicesFailed 
    });

    if (progress !== undefined) {
      // Handle progress updates
      this.handleProgress(progress, message, logId);
    }
  }
}

