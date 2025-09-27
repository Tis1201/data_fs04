/**
 * Clean WebRTC Handler
 * 
 * Dedicated WebRTC handler that replaces the messy mixed approach.
 * Provides clean separation of concerns for WebRTC functionality.
 */

import type { InMessage } from '../messaging/interfaces/message';
import type { Handler } from '../messaging/interfaces/handler';
import { MessageFactory, MessageValidator, MessageRouter } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { publisher } from '../messaging/core/publisher';

// ============================================================================
// WEBRTC HANDLER CLASS
// ============================================================================

class WebRTCHandlerClass implements Handler {
  private logger = getLoggingManager();

  supports(type: string): boolean {
    return type === 'webrtc' || 
           (type === 'device' && this.isWebRTCMessage(type));
  }

  async handle(message: InMessage): Promise<void> {
    this.logger?.logWebRTC('handle', message.deviceId || 'unknown', 'Handling WebRTC message', {
      messageType: message.type,
      payloadType: (message as any)?.payload?.type
    });

    try {
      // Validate message
      if (!MessageValidator.validate(message)) {
        this.logger?.logError('webrtc', 'Invalid WebRTC message format', { message });
        throw new Error('Invalid message format');
      }

      const webrtcMessage = message as any as InMessage & { payload: { type: string; deviceId: string; [key: string]: any } };
      const deviceId = webrtcMessage.payload?.deviceId || webrtcMessage.deviceId || 'unknown';

      // Handle different WebRTC actions
      switch (webrtcMessage.payload?.type) {
        case 'webrtc:connect':
          await this.handleConnect(webrtcMessage);
          break;
        case 'webrtc:disconnect':
          await this.handleDisconnect(webrtcMessage);
          break;
        case 'webrtc:offer':
          await this.handleOffer(webrtcMessage);
          break;
        case 'webrtc:answer':
          await this.handleAnswer(webrtcMessage);
          break;
        case 'webrtc:ice-candidate':
          await this.handleIceCandidate(webrtcMessage);
          break;
        case 'webrtc:error':
          await this.handleError(webrtcMessage);
          break;
        default:
          this.logger?.logWarn('webrtc', `Unknown WebRTC message type: ${webrtcMessage.payload?.type}`);
      }

      this.logger?.logWebRTC('handle', deviceId, 'WebRTC message handled successfully');
    } catch (error) {
      this.logger?.logError('webrtc', 'Failed to handle WebRTC message', { error, message });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isWebRTCMessage(type: string): boolean {
    return type === 'device' && this.isWebRTCPayload(type);
  }

  private isWebRTCPayload(payload: any): boolean {
    return payload?.type && payload.type.startsWith('webrtc:');
  }

  private async handleConnect(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logWebRTC('connect', deviceId, 'Handling WebRTC connect');

    try {
      // Create action log
      const actionLogId = this.logger?.createActionLog?.(
        deviceId,
        'webrtc',
        message.userInfo.id,
        'WebRTC connection initiated'
      );

      // Check device online status
      // This would typically check the database
      const isDeviceOnline = true; // Mock for now

      if (!isDeviceOnline) {
        this.logger?.logWarn('webrtc', 'Device is offline', { deviceId });
        await this.sendErrorResponse(deviceId, 'Device is offline', message);
        return;
      }

      // Forward connect message to device
      await this.forwardToDevice(message, {
        action: 'webrtc:connect',
        deviceId,
        connectionState: 'connecting'
      });

      this.logger?.logWebRTC('connect', deviceId, 'WebRTC connect handled successfully');
    } catch (error) {
      this.logger?.logError('webrtc', 'Failed to handle WebRTC connect', { error, deviceId });
      throw error;
    }
  }

  private async handleDisconnect(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logWebRTC('disconnect', deviceId, 'Handling WebRTC disconnect');

    try {
      // Update action log
      this.logger?.updateActionLog?.(
        message.requestId || '',
        'success',
        'WebRTC disconnected'
      );

      // Forward disconnect message to device
      await this.forwardToDevice(message, {
        action: 'webrtc:disconnect',
        deviceId,
        connectionState: 'disconnected'
      });

      this.logger?.logWebRTC('disconnect', deviceId, 'WebRTC disconnect handled successfully');
    } catch (error) {
      this.logger?.logError('webrtc', 'Failed to handle WebRTC disconnect', { error, deviceId });
      throw error;
    }
  }

  private async handleOffer(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logWebRTC('offer', deviceId, 'Handling WebRTC offer');

    try {
      // Forward offer to device
      await this.forwardToDevice(message, {
        action: 'webrtc:offer',
        deviceId,
        sdp: (message as any)?.payload?.sdp
      });

      this.logger?.logWebRTC('offer', deviceId, 'WebRTC offer handled successfully');
    } catch (error) {
      this.logger?.logError('webrtc', 'Failed to handle WebRTC offer', { error, deviceId });
      throw error;
    }
  }

  private async handleAnswer(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logWebRTC('answer', deviceId, 'Handling WebRTC answer');

    try {
      // Forward answer to device
      await this.forwardToDevice(message, {
        action: 'webrtc:answer',
        deviceId,
        sdp: (message as any)?.payload?.sdp
      });

      this.logger?.logWebRTC('answer', deviceId, 'WebRTC answer handled successfully');
    } catch (error) {
      this.logger?.logError('webrtc', 'Failed to handle WebRTC answer', { error, deviceId });
      throw error;
    }
  }

  private async handleIceCandidate(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    this.logger?.logWebRTC('ice-candidate', deviceId, 'Handling WebRTC ICE candidate');

    try {
      // Forward ICE candidate to device
      await this.forwardToDevice(message, {
        action: 'webrtc:ice-candidate',
        deviceId,
        candidate: (message as any)?.payload?.candidate
      });

      this.logger?.logWebRTC('ice-candidate', deviceId, 'WebRTC ICE candidate handled successfully');
    } catch (error) {
      this.logger?.logError('webrtc', 'Failed to handle WebRTC ICE candidate', { error, deviceId });
      throw error;
    }
  }

  private async handleError(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const error = (message as any)?.payload?.error || 'Unknown WebRTC error';
    
    this.logger?.logError('webrtc', 'WebRTC error received', { error, deviceId });

    try {
      // Update action log
      this.logger?.updateActionLog?.(
        message.requestId || '',
        'failed',
        `WebRTC error: ${error}`,
        error
      );

      // Forward error to device
      await this.forwardToDevice(message, {
        action: 'webrtc:error',
        deviceId,
        error
      });

      this.logger?.logWebRTC('error', deviceId, 'WebRTC error handled successfully');
    } catch (err) {
      this.logger?.logError('webrtc', 'Failed to handle WebRTC error', { error: err, deviceId });
      throw err;
    }
  }

  private async forwardToDevice(message: InMessage, data: any): Promise<void> {
    const deviceId = data.deviceId;
    const scope = MessageRouter.getScope({
      type: 'webrtc',
      action: data.action,
      deviceId,
      data: {},
      timestamp: Date.now()
    } as any);

    const routingMessage = MessageFactory.createWebRTC(
      data.action.replace('webrtc:', '') as any,
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
      type: 'webrtc',
      action: 'error',
      deviceId,
      data: { error },
      timestamp: Date.now()
    } as any);

    const errorMessage = MessageFactory.createWebRTC(
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

export const webrtcHandler = new WebRTCHandlerClass();
