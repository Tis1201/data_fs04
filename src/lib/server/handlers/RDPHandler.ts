/**
 * Clean RDP Handler
 * 
 * Dedicated RDP handler that replaces the messy mixed approach.
 * Provides clean separation of concerns for RDP functionality.
 */

import type { InMessage } from '../messaging/interfaces/message';
import type { Handler } from '../messaging/interfaces/handler';
import { MessageFactory, MessageValidator, MessageRouter } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { publisher } from '../messaging/core/publisher';

// ============================================================================
// RDP HANDLER CLASS
// ============================================================================

class RDPHandlerClass implements Handler {
  private logger = getLoggingManager();

  supports(type: string): boolean {
    return type === 'rdp' || 
           (type === 'device' && this.isRDPMessage(type));
  }

  async handle(message: InMessage): Promise<void> {
    this.logger?.logRDP('handle', message.deviceId || 'unknown', 'Handling RDP message', {
      messageType: message.type,
      payloadType: (message as any)?.payload?.type
    });

    try {
      // Validate message
      if (!MessageValidator.validate(message)) {
        this.logger?.logError('rdp', 'Invalid RDP message format', { message });
        throw new Error('Invalid message format');
      }

      const rdpMessage = message as any as InMessage & { payload: { type: string; deviceId: string; [key: string]: any } };
      const deviceId = rdpMessage.payload?.deviceId || rdpMessage.deviceId || 'unknown';

      // Handle different RDP actions
      switch (rdpMessage.payload?.type) {
        case 'rdp:start':
          await this.handleStart(rdpMessage);
          break;
        case 'rdp:stop':
          await this.handleStop(rdpMessage);
          break;
        case 'rdp:mouse':
          await this.handleMouse(rdpMessage);
          break;
        case 'rdp:keyboard':
          await this.handleKeyboard(rdpMessage);
          break;
        case 'rdp:error':
          await this.handleError(rdpMessage);
          break;
        default:
          this.logger?.logWarn('rdp', `Unknown RDP message type: ${rdpMessage.payload?.type}`);
      }

      this.logger?.logRDP('handle', deviceId, 'RDP message handled successfully');
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to handle RDP message', { error, message });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isRDPMessage(type: string): boolean {
    return type === 'device' && this.isRDPPayload(type);
  }

  private isRDPPayload(payload: any): boolean {
    return payload?.type && payload.type.startsWith('rdp:');
  }

  private async handleStart(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const options = (message as any)?.payload?.options || {};
    
    this.logger?.logRDP('start', deviceId, 'Handling RDP start', { options });

    try {
      // Create action log
      const actionLogId = this.logger?.createActionLog?.(
        deviceId,
        'rdp',
        message.userInfo.id,
        'RDP session started'
      );

      // Check device online status
      const isDeviceOnline = true; // Mock for now

      if (!isDeviceOnline) {
        this.logger?.logWarn('rdp', 'Device is offline', { deviceId });
        await this.sendErrorResponse(deviceId, 'Device is offline', message);
        return;
      }

      // Forward start message to device
      await this.forwardToDevice(message, {
        action: 'rdp:start',
        deviceId,
        options
      });

      this.logger?.logRDP('start', deviceId, 'RDP start handled successfully');
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to handle RDP start', { error, deviceId, options });
      throw error;
    }
  }

  private async handleStop(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logRDP('stop', deviceId, 'Handling RDP stop');

    try {
      // Update action log
      this.logger?.updateActionLog?.(
        message.requestId || '',
        'success',
        'RDP session stopped'
      );

      // Forward stop message to device
      await this.forwardToDevice(message, {
        action: 'rdp:stop',
        deviceId
      });

      this.logger?.logRDP('stop', deviceId, 'RDP stop handled successfully');
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to handle RDP stop', { error, deviceId });
      throw error;
    }
  }

  private async handleMouse(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const mouseEvent = (message as any)?.payload?.mouse || {};
    
    this.logger?.logRDP('mouse', deviceId, 'Handling RDP mouse event', { mouseEvent });

    try {
      // Forward mouse event to device
      await this.forwardToDevice(message, {
        action: 'rdp:mouse',
        deviceId,
        mouse: mouseEvent
      });

      this.logger?.logRDP('mouse', deviceId, 'RDP mouse event handled successfully');
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to handle RDP mouse event', { error, deviceId, mouseEvent });
      throw error;
    }
  }

  private async handleKeyboard(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const keyboardEvent = (message as any)?.payload?.keyboard || {};
    
    this.logger?.logRDP('keyboard', deviceId, 'Handling RDP keyboard event', { keyboardEvent });

    try {
      // Forward keyboard event to device
      await this.forwardToDevice(message, {
        action: 'rdp:keyboard',
        deviceId,
        keyboard: keyboardEvent
      });

      this.logger?.logRDP('keyboard', deviceId, 'RDP keyboard event handled successfully');
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to handle RDP keyboard event', { error, deviceId, keyboardEvent });
      throw error;
    }
  }

  private async handleError(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const error = (message as any)?.payload?.error || 'Unknown RDP error';
    
    this.logger?.logError('rdp', 'RDP error received', { error, deviceId });

    try {
      // Update action log
      this.logger?.updateActionLog?.(
        message.requestId || '',
        'failed',
        `RDP error: ${error}`,
        error
      );

      // Forward error to client
      await this.forwardToClient(message, {
        action: 'rdp:error',
        deviceId,
        error
      });

      this.logger?.logRDP('error', deviceId, 'RDP error handled successfully');
    } catch (err) {
      this.logger?.logError('rdp', 'Failed to handle RDP error', { error: err, deviceId });
      throw err;
    }
  }

  private async forwardToDevice(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    const scope = MessageRouter.getScope({
      type: 'rdp',
      action: data.action,
      deviceId,
      data: {},
      timestamp: Date.now()
    } as any);

    const routingMessage = MessageFactory.createRDP(
      data.action.replace('rdp:', '') as any,
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

  private async forwardToClient(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    const scope = MessageRouter.getScope({
      type: 'rdp',
      action: data.action,
      deviceId,
      data: {},
      timestamp: Date.now()
    } as any);

    const routingMessage = MessageFactory.createRDP(
      data.action.replace('rdp:', '') as any,
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

  private async sendErrorResponse(deviceId: string, error: string, originalMessage: InMessage): Promise<void> {
    const scope = MessageRouter.getScope({
      type: 'rdp',
      action: 'error',
      deviceId,
      data: { error },
      timestamp: Date.now()
    } as any);

    const errorMessage = MessageFactory.createRDP(
      'error',
      deviceId,
      { error },
      {
        userId: originalMessage.userInfo.id,
        requestId: originalMessage.requestId,
        connectionId: (originalMessage as any).connectionId,
        protocol: (originalMessage as any).protocol,
        scope
      }
    );

    await publisher.publish(errorMessage);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const rdpHandler = new RDPHandlerClass();
