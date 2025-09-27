/**
 * Clean Terminal Handler
 * 
 * Dedicated Terminal handler that replaces the messy mixed approach.
 * Provides clean separation of concerns for Terminal functionality.
 */

import type { InMessage } from '../messaging/interfaces/message';
import type { Handler } from '../messaging/interfaces/handler';
import { MessageFactory, MessageValidator, MessageRouter } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { publisher } from '../messaging/core/publisher';

// ============================================================================
// TERMINAL HANDLER CLASS
// ============================================================================

class TerminalHandlerClass implements Handler {
  private logger = getLoggingManager();

  supports(type: string): boolean {
    return type === 'terminal' || 
           (type === 'device' && this.isTerminalMessage(type));
  }

  async handle(message: InMessage): Promise<void> {
    this.logger?.logTerminal('handle', message.deviceId || 'unknown', 'Handling Terminal message', {
      messageType: message.type,
      payloadType: (message as any)?.payload?.type
    });

    try {
      // Validate message
      if (!MessageValidator.validate(message)) {
        this.logger?.logError('terminal', 'Invalid Terminal message format', { message });
        throw new Error('Invalid message format');
      }

      const terminalMessage = message as any as InMessage & { payload: { type: string; deviceId: string; [key: string]: any } };
      const deviceId = terminalMessage.payload?.deviceId || terminalMessage.deviceId || 'unknown';

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
          this.logger?.logWarn('terminal', `Unknown Terminal message type: ${terminalMessage.payload?.type}`);
      }

      this.logger?.logTerminal('handle', deviceId, 'Terminal message handled successfully');
    } catch (error) {
      this.logger?.logError('terminal', 'Failed to handle Terminal message', { error, message });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isTerminalMessage(type: string): boolean {
    return type === 'device' && this.isTerminalPayload(type);
  }

  private isTerminalPayload(payload: any): boolean {
    return payload?.type && payload.type.startsWith('terminal:');
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
        this.logger?.logWarn('terminal', 'Device is offline', { deviceId });
        await this.sendErrorResponse(deviceId, 'Device is offline', message);
        return;
      }

      // Forward connect message to device
      await this.forwardToDevice(message, {
        action: 'terminal:connect',
        deviceId,
        connectionState: 'connecting'
      });

      this.logger?.logTerminal('connect', deviceId, 'Terminal connect handled successfully');
    } catch (error) {
      this.logger?.logError('terminal', 'Failed to handle Terminal connect', { error, deviceId });
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
      this.logger?.logError('terminal', 'Failed to handle Terminal disconnect', { error, deviceId });
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

      this.logger?.logTerminal('input', deviceId, 'Terminal input handled successfully');
    } catch (error) {
      this.logger?.logError('terminal', 'Failed to handle Terminal input', { error, deviceId, input });
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
      this.logger?.logError('terminal', 'Failed to handle Terminal output', { error, deviceId, output });
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

      this.logger?.logTerminal('resize', deviceId, 'Terminal resize handled successfully');
    } catch (error) {
      this.logger?.logError('terminal', 'Failed to handle Terminal resize', { error, deviceId, rows, cols });
      throw error;
    }
  }

  private async handleError(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const error = (message as any)?.payload?.error || 'Unknown Terminal error';
    
    this.logger?.logError('terminal', 'Terminal error received', { error, deviceId });

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
      this.logger?.logError('terminal', 'Failed to handle Terminal error', { error: err, deviceId });
      throw err;
    }
  }

  private async forwardToDevice(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    const scope = MessageRouter.getScope({
      type: 'terminal',
      action: data.action,
      deviceId,
      data: {},
      timestamp: Date.now()
    } as any);

    const routingMessage = MessageFactory.createTerminal(
      data.action.replace('terminal:', '') as any,
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
      type: 'terminal',
      action: data.action,
      deviceId,
      data: {},
      timestamp: Date.now()
    } as any);

    const routingMessage = MessageFactory.createTerminal(
      data.action.replace('terminal:', '') as any,
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
      type: 'terminal',
      action: 'error',
      deviceId,
      data: { error },
      timestamp: Date.now()
    } as any);

    const errorMessage = MessageFactory.createTerminal(
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

export const terminalHandler = new TerminalHandlerClass();
