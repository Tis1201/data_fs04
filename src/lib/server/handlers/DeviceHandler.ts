/**
 * Clean Device Handler
 * 
 * Dedicated Device handler that replaces the messy mixed approach.
 * Provides clean separation of concerns for Device functionality.
 */

import type { InMessage } from '../messaging/interfaces/message';
import type { Handler } from '../messaging/interfaces/handler';
import { MessageFactory, MessageValidator, MessageRouter } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { publisher } from '../messaging/core/publisher';

// ============================================================================
// DEVICE HANDLER CLASS
// ============================================================================

class DeviceHandlerClass implements Handler {
  private logger = getLoggingManager();

  supports(type: string): boolean {
    return type === 'device';
  }

  async handle(message: InMessage): Promise<void> {
    this.logger?.logDevice('handle', message.deviceId || 'unknown', 'Handling Device message', {
      messageType: message.type,
      payloadType: (message as any)?.payload?.type
    });

    try {
      // Validate message
      if (!MessageValidator.validate(message)) {
        this.logger?.logError('device', 'Invalid Device message format', { message });
        throw new Error('Invalid message format');
      }

      const deviceMessage = message as any as InMessage & { payload: { type: string; deviceId: string; [key: string]: any } };
      const deviceId = deviceMessage.payload?.deviceId || deviceMessage.deviceId || 'unknown';

      // Handle different Device actions
      switch (deviceMessage.payload?.type) {
        case 'device:claim':
          await this.handleClaim(deviceMessage);
          break;
        case 'device:register':
          await this.handleRegister(deviceMessage);
          break;
        case 'device:status':
          await this.handleStatus(deviceMessage);
          break;
        case 'device:updateFirmware':
          await this.handleUpdateFirmware(deviceMessage);
          break;
        case 'device:bundleStatus':
          await this.handleBundleStatus(deviceMessage);
          break;
        case 'device:getLogs':
          await this.handleGetLogs(deviceMessage);
          break;
        case 'device:message':
          await this.handleMessage(deviceMessage);
          break;
        case 'device:error':
          await this.handleError(deviceMessage);
          break;
        default:
          this.logger?.logWarn('device', `Unknown Device message type: ${deviceMessage.payload?.type}`);
      }

      this.logger?.logDevice('handle', deviceId, 'Device message handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device message', { error, message });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async handleClaim(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logDevice('claim', deviceId, 'Handling Device claim');

    try {
      // Create action log
      const actionLogId = this.logger?.createActionLog?.(
        deviceId,
        'device',
        message.userInfo.id,
        'Device claim initiated'
      );

      // Handle device claim logic
      // This would typically update the database
      const claimResult = { success: true, message: 'Device claimed successfully' };

      if (claimResult.success) {
        this.logger?.updateActionLog?.(actionLogId || '', 'success', 'Device claimed successfully');
      } else {
        this.logger?.updateActionLog?.(actionLogId || '', 'failed', 'Device claim failed');
      }

      // Send response
      await this.sendResponse(message, {
        action: 'device:claim',
        deviceId,
        success: claimResult.success,
        message: claimResult.message
      });

      this.logger?.logDevice('claim', deviceId, 'Device claim handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device claim', { error, deviceId });
      throw error;
    }
  }

  private async handleRegister(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logDevice('register', deviceId, 'Handling Device registration');

    try {
      // Create action log
      const actionLogId = this.logger?.createActionLog?.(
        deviceId,
        'device',
        message.userInfo.id,
        'Device registration initiated'
      );

      // Handle device registration logic
      // This would typically create a new device in the database
      const registrationResult = { success: true, message: 'Device registered successfully' };

      if (registrationResult.success) {
        this.logger?.updateActionLog?.(actionLogId || '', 'success', 'Device registered successfully');
      } else {
        this.logger?.updateActionLog?.(actionLogId || '', 'failed', 'Device registration failed');
      }

      // Send response
      await this.sendResponse(message, {
        action: 'device:register',
        deviceId,
        success: registrationResult.success,
        message: registrationResult.message
      });

      this.logger?.logDevice('register', deviceId, 'Device registration handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device registration', { error, deviceId });
      throw error;
    }
  }

  private async handleStatus(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const status = (message as any)?.payload?.status || 'unknown';
    
    this.logger?.logDevice('status', deviceId, 'Handling Device status update', { status });

    try {
      // Handle device status update
      // This would typically update the device status in the database
      const statusResult = { success: true, message: 'Device status updated' };

      // Send response
      await this.sendResponse(message, {
        action: 'device:status',
        deviceId,
        success: statusResult.success,
        message: statusResult.message,
        status
      });

      this.logger?.logDevice('status', deviceId, 'Device status handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device status', { error, deviceId, status });
      throw error;
    }
  }

  private async handleUpdateFirmware(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const firmwareVersion = (message as any)?.payload?.firmwareVersion || 'unknown';
    
    this.logger?.logDevice('updateFirmware', deviceId, 'Handling Device firmware update', { firmwareVersion });

    try {
      // Create action log
      const actionLogId = this.logger?.createActionLog?.(
        deviceId,
        'device',
        message.userInfo.id,
        'Device firmware update initiated'
      );

      // Handle firmware update logic
      const updateResult = { success: true, message: 'Firmware update initiated' };

      if (updateResult.success) {
        this.logger?.updateActionLog?.(actionLogId || '', 'in_progress', 'Firmware update in progress');
      } else {
        this.logger?.updateActionLog?.(actionLogId || '', 'failed', 'Firmware update failed');
      }

      // Send response
      await this.sendResponse(message, {
        action: 'device:updateFirmware',
        deviceId,
        success: updateResult.success,
        message: updateResult.message,
        firmwareVersion
      });

      this.logger?.logDevice('updateFirmware', deviceId, 'Device firmware update handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device firmware update', { error, deviceId, firmwareVersion });
      throw error;
    }
  }

  private async handleBundleStatus(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const bundleStatus = (message as any)?.payload?.bundleStatus || {};
    
    this.logger?.logDevice('bundleStatus', deviceId, 'Handling Device bundle status', { bundleStatus });

    try {
      // Handle bundle status update
      const statusResult = { success: true, message: 'Bundle status updated' };

      // Send response
      await this.sendResponse(message, {
        action: 'device:bundleStatus',
        deviceId,
        success: statusResult.success,
        message: statusResult.message,
        bundleStatus
      });

      this.logger?.logDevice('bundleStatus', deviceId, 'Device bundle status handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device bundle status', { error, deviceId, bundleStatus });
      throw error;
    }
  }

  private async handleGetLogs(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logDevice('getLogs', deviceId, 'Handling Device get logs');

    try {
      // Handle get logs logic
      // This would typically retrieve logs from the database
      const logs = []; // Mock logs
      const logsResult = { success: true, message: 'Logs retrieved successfully', logs };

      // Send response
      await this.sendResponse(message, {
        action: 'device:getLogs',
        deviceId,
        success: logsResult.success,
        message: logsResult.message,
        logs: logsResult.logs
      });

      this.logger?.logDevice('getLogs', deviceId, 'Device get logs handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device get logs', { error, deviceId });
      throw error;
    }
  }

  private async handleMessage(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const messageContent = (message as any)?.payload?.message || '';
    
    this.logger?.logDevice('message', deviceId, 'Handling Device message', { message: messageContent });

    try {
      // Handle device message
      const messageResult = { success: true, message: 'Device message processed' };

      // Send response
      await this.sendResponse(message, {
        action: 'device:message',
        deviceId,
        success: messageResult.success,
        message: messageResult.message,
        content: messageContent
      });

      this.logger?.logDevice('message', deviceId, 'Device message handled successfully');
    } catch (error) {
      this.logger?.logError('device', 'Failed to handle Device message', { error, deviceId, message: messageContent });
      throw error;
    }
  }

  private async handleError(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const error = (message as any)?.payload?.error || 'Unknown Device error';
    
    this.logger?.logError('device', 'Device error received', { error, deviceId });

    try {
      // Update action log
      this.logger?.updateActionLog?.(
        message.requestId || '',
        'failed',
        `Device error: ${error}`,
        error
      );

      // Send error response
      await this.sendResponse(message, {
        action: 'device:error',
        deviceId,
        success: false,
        message: error
      });

      this.logger?.logDevice('error', deviceId, 'Device error handled successfully');
    } catch (err) {
      this.logger?.logError('device', 'Failed to handle Device error', { error: err, deviceId });
      throw err;
    }
  }

  private async sendResponse(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    const scope = MessageRouter.getScope({
      type: 'device',
      action: data.action,
      deviceId,
      data: {},
      timestamp: Date.now()
    } as any);

    const routingMessage = MessageFactory.createDevice(
      data.action.replace('device:', '') as any,
      deviceId,
      data,
      {
        userId: message.userInfo.id,
        requestId: message.requestId,
        connectionId: (message as any).connectionId,
        protocol: (message as any).protocol,
        scope
      }
    );

    await publisher.publish(routingMessage);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const deviceHandler = new DeviceHandlerClass();
