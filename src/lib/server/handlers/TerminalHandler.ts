/**
 * Clean Terminal Handler
 * 
 * Dedicated Terminal handler that replaces the messy mixed approach.
 * Provides clean separation of concerns for Terminal functionality.
 */

import type { InMessage, RoutingMessage } from '../messaging/interfaces/message';
import type { Handler } from '../messaging/interfaces/handler';
import { MessageFactory, SystemUser } from '../messaging/interfaces/message';
import { MessageValidator, MessageRouter } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { publisher } from '../messaging/core/publisher';
import { getMessageRelay } from '../pushpin/middleware';
import { logger } from '../logger';

// ============================================================================
// TERMINAL HANDLER CLASS
// ============================================================================

class TerminalHandlerClass implements Handler {
  private logger = getLoggingManager();

  supports(type: string, message?: any): boolean {
    console.log(`[TerminalHandler] supports called with:`, { type, message: message ? { type: message.type, payload: message.payload } : null });
    const result = type === 'terminal' || 
           (type === 'device' && message && this.isTerminalMessage(message));
    console.log(`[TerminalHandler] supports result:`, result);
    return result;
  }

  async handle(message: InMessage): Promise<void> {
    const terminalMessage = message as any as InMessage & { payload: { type: string; deviceId: string; [key: string]: any } };
    const deviceId: string = String(terminalMessage.payload?.deviceId || terminalMessage.deviceId || message.deviceId || 'unknown');
    
    this.logger?.logTerminal('handle', deviceId, `Handling Terminal message (type: ${message.type}, payloadType: ${terminalMessage.payload?.type})`);

    try {
      // Validate message
      if (!MessageValidator.validate(message)) {
        logger.error(`[TerminalHandler] Invalid Terminal message format: ${JSON.stringify(message)}`);
        throw new Error('Invalid message format');
      }

      // Handle different Terminal actions
      switch (terminalMessage.payload?.type) {
        case 'terminal:connect':
          await this.handleConnect(terminalMessage);
          break;
        case 'terminal:disconnect':
          await this.handleDisconnect(terminalMessage);
          break;
        case 'terminal:input':
          await this.handleInput(terminalMessage);
          break;
        case 'terminal:output':
          await this.handleOutput(terminalMessage);
          break;
        case 'terminal:resize':
          await this.handleResize(terminalMessage);
          break;
        case 'terminal:error':
          await this.handleError(terminalMessage);
          break;
        default:
          logger.warn(`[TerminalHandler] Unknown Terminal message type: ${terminalMessage.payload?.type}`);
      }

      this.logger?.logTerminal('handle', deviceId, 'Terminal message handled successfully');
    } catch (error) {
      logger.error(`[TerminalHandler] Failed to handle Terminal message: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isTerminalMessage(message: any): boolean {
    console.log(`[TerminalHandler] isTerminalMessage called with:`, { 
      messageType: message?.type, 
      payload: message?.payload 
    });
    const result = message?.type === 'device' && this.isTerminalPayload(message.payload);
    console.log(`[TerminalHandler] isTerminalMessage result:`, result);
    return result;
  }

  private isTerminalPayload(payload: any): boolean {
    console.log(`[TerminalHandler] isTerminalPayload called with:`, { payload });
    const result = payload?.type && payload.type.startsWith('terminal:');
    console.log(`[TerminalHandler] isTerminalPayload result:`, result);
    return result;
  }

  private async handleConnect(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logTerminal('connect', deviceId, 'Handling Terminal connect');

    try {
      // Create action log
      const actionLogId = this.logger?.createActionLog?.(
        deviceId,
        'terminal',
        message.userInfo.id,
        'Terminal connection initiated'
      );

      // Check device online status
      const isDeviceOnline = true; // Mock for now

      if (!isDeviceOnline) {
        logger.warn(`[TerminalHandler] Device is offline: ${deviceId}`);
        await this.sendErrorResponse(deviceId, 'Device is offline', message);
        return;
      }

      // Forward connect message to device
      await this.forwardToDevice(message, {
        action: 'terminal:connect',
        deviceId,
        connectionState: 'connecting'
      });

      // Send success response back to UI
      if (message.requestId) {
        await this.sendSuccessResponse(message, {
          action: 'terminal:connect',
          deviceId,
          message: 'Terminal connection initiated'
        });
      }

      this.logger?.logTerminal('connect', deviceId, 'Terminal connect handled successfully');
    } catch (error) {
      logger.error(`[TerminalHandler] Failed to handle Terminal connect for device ${deviceId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async handleDisconnect(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logTerminal('disconnect', deviceId, 'Handling Terminal disconnect');

    try {
      // Update action log
      this.logger?.updateActionLog?.(
        message.requestId || '',
        'success',
        'Terminal disconnected'
      );

      // Forward disconnect message to device
      await this.forwardToDevice(message, {
        action: 'terminal:disconnect',
        deviceId,
        connectionState: 'disconnected'
      });

      this.logger?.logTerminal('disconnect', deviceId, 'Terminal disconnect handled successfully');
    } catch (error) {
      logger.error(`[TerminalHandler] Failed to handle Terminal disconnect for device ${deviceId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async handleInput(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const input = (message as any)?.payload?.input || '';
    
    this.logger?.logTerminal('input', deviceId, 'Handling Terminal input', { input });

    try {
      // Forward input to device
      await this.forwardToDevice(message, {
        action: 'terminal:input',
        deviceId,
        input
      });

      // Send success response back to UI
      if (message.requestId) {
        await this.sendSuccessResponse(message, {
          action: 'terminal:input',
          deviceId,
          message: 'Terminal input sent'
        });
      }

      this.logger?.logTerminal('input', deviceId, 'Terminal input handled successfully');
    } catch (error) {
      logger.error(`[TerminalHandler] Failed to handle Terminal input for device ${deviceId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async handleOutput(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const output = (message as any)?.payload?.output || '';
    
    this.logger?.logTerminal('output', deviceId, 'Handling Terminal output', { output });

    try {
      // Forward output to client
      await this.forwardToClient(message, {
        action: 'terminal:output',
        deviceId,
        output
      });

      this.logger?.logTerminal('output', deviceId, 'Terminal output handled successfully');
    } catch (error) {
      logger.error(`[TerminalHandler] Failed to handle Terminal output for device ${deviceId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async handleResize(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const rows = (message as any)?.payload?.rows || 24;
    const cols = (message as any)?.payload?.cols || 80;
    
    this.logger?.logTerminal('resize', deviceId, 'Handling Terminal resize', { rows, cols });

    try {
      // Forward resize to device
      await this.forwardToDevice(message, {
        action: 'terminal:resize',
        deviceId,
        rows,
        cols
      });

      // Send success response back to UI
      if (message.requestId) {
        await this.sendSuccessResponse(message, {
          action: 'terminal:resize',
          deviceId,
          rows,
          cols,
          message: 'Terminal resized'
        });
      }

      this.logger?.logTerminal('resize', deviceId, 'Terminal resize handled successfully');
    } catch (error) {
      logger.error(`[TerminalHandler] Failed to handle Terminal resize for device ${deviceId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async handleError(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const error = (message as any)?.payload?.error || 'Unknown Terminal error';
    
    logger.error(`[TerminalHandler] Terminal error received for device ${deviceId}: ${error}`);

    try {
      // Update action log
      this.logger?.updateActionLog?.(
        message.requestId || '',
        'failed',
        `Terminal error: ${error}`,
        error
      );

      // Forward error to client
      await this.forwardToClient(message, {
        action: 'terminal:error',
        deviceId,
        error
      });

      this.logger?.logTerminal('error', deviceId, 'Terminal error handled successfully');
    } catch (err) {
      logger.error(`[TerminalHandler] Failed to handle Terminal error for device ${deviceId}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  private async forwardToDevice(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    
    // Use MessageRelay to publish to device via Pushpin
    const messageRelay = getMessageRelay();
    
    if (!messageRelay) {
      const error = 'MessageRelay not available - cannot send terminal message to device';
      logger.error(`[TerminalHandler] ${error} (deviceId: ${deviceId}, action: ${data.action})`);
      throw new Error(error);
    }
    
    // Prepare terminal message for device
    // Device expects messages in format: { type: 'terminal:input', data: '...', timestamp: ... }
    const terminalMessage: any = {
      type: data.action, // terminal:input, terminal:resize, terminal:connect, terminal:disconnect
      timestamp: Date.now()
    };
    
    // Add specific fields based on action type
    if (data.action === 'terminal:input') {
      terminalMessage.data = data.input;
    } else if (data.action === 'terminal:resize') {
      terminalMessage.rows = data.rows;
      terminalMessage.cols = data.cols;
    } else if (data.action === 'terminal:connect' || data.action === 'terminal:disconnect') {
      terminalMessage.connectionState = data.connectionState;
    }
    
    // Publish to device via Pushpin
    await messageRelay.publishToDevice(deviceId, terminalMessage);
    
    this.logger?.logTerminal(data.action, deviceId, `Published to device via Pushpin`, {
      action: data.action,
      ...(data.action === 'terminal:input' ? { inputLength: data.input?.length } : {}),
      ...(data.action === 'terminal:resize' ? { rows: data.rows, cols: data.cols } : {})
    });
    
    logger.debug(`[TerminalHandler] Published ${data.action} to device ${deviceId} via Pushpin`);
  }

  private async forwardToClient(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    
    // Use subscription scope so all UI connections subscribed to this device receive the message
    const scope = `subscription:device:${deviceId}`;

    // Create a proper RoutingMessage for the publisher
    // The type field in payload will be used as the SSE event type
    const routingMessage = MessageFactory.createSystemMessage(
      data.action, // terminal:output, terminal:error - this becomes the SSE event type
      scope,
      {
        type: data.action, // terminal:output, terminal:error
        deviceId,
        ...data // Include output, error, etc.
      },
      SystemUser,
      {
        excludeDevices: true // Exclude device connections - terminal output should only go to UI
      }
    );
    
    // Preserve requestId if it exists
    if (message.requestId) {
      routingMessage.requestId = message.requestId;
    }

    this.logger?.logTerminal(data.action, deviceId, `Publishing to UI via SSE`, {
      action: data.action,
      scope
    });

    await publisher.publish(routingMessage);
  }

  private async sendSuccessResponse(originalMessage: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    
    // Send response back to the original sender connection
    const responseMessage = MessageFactory.createSystemMessage(
      'terminal',
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
    this.logger?.logTerminal(data.action, deviceId, 'Sent success response to UI');
  }

  private async sendErrorResponse(deviceId: string, error: string, originalMessage: InMessage): Promise<void> {
    // Send error response back to the original sender connection
    const errorMessage = MessageFactory.createSystemMessage(
      'terminal',
      `connection:${originalMessage.connectionId}`,
      {
        type: 'terminal:error',
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

export const terminalHandler = new TerminalHandlerClass();
