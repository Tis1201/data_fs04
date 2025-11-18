/**
 * Clean RDP Handler
 * 
 * Dedicated RDP handler that replaces the messy mixed approach.
 * Provides clean separation of concerns for RDP functionality.
 */

import type { InMessage, RoutingMessage } from '../messaging/interfaces/message';
import type { Handler } from '../messaging/interfaces/handler';
import { MessageFactory, SystemUser } from '../messaging/interfaces/message';
import { MessageValidator } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { publisher } from '../messaging/core/publisher';
import { getMessageRelay } from '../pushpin/middleware';
import { logger } from '../logger';

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

      // Send success response back to UI
      if (message.requestId) {
        await this.sendSuccessResponse(message, {
          action: 'rdp:start',
          deviceId,
          message: 'RDP session started'
        });
      }

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

      // Send success response back to UI
      if (message.requestId) {
        await this.sendSuccessResponse(message, {
          action: 'rdp:stop',
          deviceId,
          message: 'RDP session stopped'
        });
      }

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

      // Send success response back to UI (optional, for request-response matching)
      if (message.requestId) {
        await this.sendSuccessResponse(message, {
          action: 'rdp:mouse',
          deviceId,
          message: 'Mouse event sent'
        });
      }

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

      // Send success response back to UI (optional, for request-response matching)
      if (message.requestId) {
        await this.sendSuccessResponse(message, {
          action: 'rdp:keyboard',
          deviceId,
          message: 'Keyboard event sent'
        });
      }

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
    
    // Use MessageRelay to publish to device via Pushpin
    const messageRelay = getMessageRelay();
    
    if (!messageRelay) {
      const error = 'MessageRelay not available - cannot send RDP message to device';
      logger.error(`[RDPHandler] ${error} (deviceId: ${deviceId}, action: ${data.action})`);
      throw new Error(error);
    }
    
    // Prepare RDP message for device
    // Device expects messages in format: { type: 'rdp:start', options: {...}, timestamp: ... }
    const rdpMessage: any = {
      type: data.action, // rdp:start, rdp:stop, rdp:mouse, rdp:keyboard
      timestamp: Date.now()
    };
    
    // Add specific fields based on action type
    if (data.action === 'rdp:start') {
      rdpMessage.options = data.options || {};
    } else if (data.action === 'rdp:mouse') {
      rdpMessage.mouse = data.mouse || {};
    } else if (data.action === 'rdp:keyboard') {
      rdpMessage.keyboard = data.keyboard || {};
    }
    
    // Publish to device via Pushpin
    await messageRelay.publishToDevice(deviceId, rdpMessage);
    
    this.logger?.logRDP(data.action, deviceId, `Published to device via Pushpin`, {
      action: data.action
    });
    
    logger.debug(`[RDPHandler] Published ${data.action} to device ${deviceId} via Pushpin`);
  }

  private async forwardToClient(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    
    // Use subscription scope so all UI connections subscribed to this device receive the message
    const scope = `subscription:device:${deviceId}`;

    // Create a proper RoutingMessage for the publisher
    // The type field in payload will be used as the SSE event type
    const routingMessage = MessageFactory.createSystemMessage(
      data.action, // rdp:error - this becomes the SSE event type
      scope,
      {
        type: data.action, // rdp:error
        deviceId,
        ...data // Include error, etc.
      },
      SystemUser,
      {
        excludeDevices: true // Exclude device connections - RDP messages should only go to UI
      }
    );
    
    // Preserve requestId if it exists
    if (message.requestId) {
      routingMessage.requestId = message.requestId;
    }

    this.logger?.logRDP(data.action, deviceId, `Publishing to UI via SSE`, {
      action: data.action,
      scope
    });

    await publisher.publish(routingMessage);
  }

  private async sendSuccessResponse(originalMessage: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    
    // Send response back to the original sender connection
    const responseMessage = MessageFactory.createSystemMessage(
      'rdp',
      `connection:${originalMessage.connectionId}`,
      {
        type: data.action,
        deviceId,
        success: true,
        ...data
      },
      SystemUser,
      {
        targetConnectionId: originalMessage.connectionId,
        targetProtocol: originalMessage.protocol,
        echoToSender: true
      }
    );

    // Preserve requestId so UI can match response to request
    if (originalMessage.requestId) {
      responseMessage.requestId = originalMessage.requestId;
    }

    await publisher.publish(responseMessage);
    this.logger?.logRDP(data.action, deviceId, 'Sent success response to UI');
  }

  private async sendErrorResponse(deviceId: string, error: string, originalMessage: InMessage): Promise<void> {
    // Send error response back to the original sender connection
    const errorMessage = MessageFactory.createSystemMessage(
      'rdp',
      `connection:${originalMessage.connectionId}`,
      {
        type: 'rdp:error',
        deviceId,
        success: false,
        error
      },
      SystemUser,
      {
        targetConnectionId: originalMessage.connectionId,
        targetProtocol: originalMessage.protocol,
        echoToSender: true
      }
    );

    // Preserve requestId so UI can match response to request
    if (originalMessage.requestId) {
      errorMessage.requestId = originalMessage.requestId;
    }

    await publisher.publish(errorMessage);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const rdpHandler = new RDPHandlerClass();
