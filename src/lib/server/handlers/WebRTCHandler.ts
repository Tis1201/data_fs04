/**
 * Clean WebRTC Handler
 * 
 * Dedicated WebRTC handler that replaces the messy mixed approach.
 * Provides clean separation of concerns for WebRTC functionality.
 */

import type { InMessage, RoutingMessage } from '../messaging/interfaces/message';
import type { Handler } from '../messaging/interfaces/handler';
import { MessageFactory, MessageValidator, MessageRouter } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { publisher } from '../messaging/core/publisher';

// ============================================================================
// WEBRTC HANDLER CLASS
// ============================================================================

class WebRTCHandlerClass implements Handler {
  private logger = getLoggingManager();

  supports(type: string, message?: any): boolean {
    return type === 'webrtc' || 
           (type === 'device' && message && this.isWebRTCMessage(message));
  }

  async handle(message: InMessage): Promise<void> {
    this.logger?.logWebRTC('handle', message.deviceId || 'unknown', 'Handling WebRTC message');

    try {
      // Validate message
      if (!MessageValidator.validate(message)) {
        this.logger?.error('webrtc', 'Invalid WebRTC message format', { message });
        throw new Error('Invalid message format');
      }

      const webrtcMessage = message as any as InMessage & { payload: { type: string; deviceId: string; [key: string]: any } };
      const deviceId = webrtcMessage.payload?.deviceId || webrtcMessage.deviceId || 'unknown';
      const messageType = webrtcMessage.payload?.type;

      switch (messageType) {
        case 'webrtc:connect':
          await this.handleConnect(message);
          break;
        case 'webrtc:offer':
          await this.handleOffer(message);
          break;
        case 'webrtc:answer':
          await this.handleAnswer(message);
          break;
        case 'webrtc:ice-candidate':
          await this.handleIceCandidate(message);
          break;
        default:
          this.logger?.warn('webrtc', `Unknown WebRTC message type: ${messageType}`);
      }

      this.logger?.logWebRTC('handle', deviceId, 'WebRTC message handled successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle WebRTC message', { error, message });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isWebRTCMessage(message: any): boolean {
    return message?.type === 'device' && this.isWebRTCPayload(message.payload);
  }

  private isWebRTCPayload(payload: any): boolean {
    return payload?.type && payload.type.startsWith('webrtc:');
  }

  private async handleConnect(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    
    this.logger?.logWebRTC('connect', deviceId, 'Handling WebRTC connect');

    try {
      const actionLogId = this.logger?.createActionLog?.(
        deviceId,
        'webrtc',
        message.userInfo.id,
        'WebRTC connection initiated'
      );

      // Check if device connection exists
      const { ConnectionManager } = await import('../messaging/core/connectionManager');
      const deviceConnection = await ConnectionManager.getConnectionByDeviceId(deviceId);

      if (!deviceConnection) {
        this.logger?.warn('webrtc', 'Device is offline', { deviceId });
        await this.sendErrorResponse(deviceId, 'Device is offline', message);
        return;
      }

      // Forward connect message to device
      const targetScope = `subscription:device:${deviceId}`;
      
      const routingMessage: RoutingMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'device',
        scope: targetScope,
        payload: {
          type: 'webrtc:connect',
          deviceId,
          action: 'message',
          connectionState: 'connecting'
        },
        userInfo: message.userInfo,
        protocol: message.protocol,
        connectionId: message.connectionId,
        senderConnectionId: message.connectionId, // Pass the web client connection ID
        requestId: message.requestId,
        systemGenerated: false,
        sudo: false
      };

      await publisher.publish(routingMessage);
      this.logger?.logWebRTC('connect', deviceId, 'WebRTC connect handled successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle WebRTC connect', { error, deviceId });
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
      this.logger?.error('webrtc', 'Failed to handle WebRTC disconnect', { error, deviceId });
      throw error;
    }
  }

  private async handleOffer(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const sdp = (message as any)?.payload?.sdp;
    this.logger?.debug('webrtc', 'Handling WebRTC offer', { deviceId, scope: message.scope });

    try {
      const targetScope = message.scope;
      
      // Create routing message directly to preserve the scope
      const routingMessage: RoutingMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'device',
        scope: targetScope, // Preserve the device's target scope
        payload: {
          type: 'webrtc:offer',
          deviceId,
          action: 'message',
          sdp: sdp
        },
        userInfo: message.userInfo,
        protocol: message.protocol,
        connectionId: message.connectionId,
        requestId: message.requestId,
        systemGenerated: false,
        sudo: (message as any).sudo
      };

      await publisher.publish(routingMessage);
      this.logger?.debug('webrtc', 'WebRTC offer handled successfully', { deviceId, scope: targetScope });
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle WebRTC offer', { error, deviceId });
      throw error;
    }
  }

  private async handleAnswer(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const sdp = (message as any)?.payload?.sdp;
    
    console.log('[WebRTCHandler] ===== HANDLING WEBRTC ANSWER =====');
    console.log('[WebRTCHandler] Device ID:', deviceId);
    console.log('[WebRTCHandler] Message scope:', message.scope);
    
    this.logger?.logWebRTC('answer', deviceId, 'Handling WebRTC answer');

    try {
      // Preserve the scope to route answer back to the device
      const targetScope = message.scope;
      
      console.log('[WebRTCHandler] Forwarding answer to scope:', targetScope);
      
      const routingMessage: RoutingMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'device',
        scope: targetScope, // Preserve scope
        payload: {
          type: 'webrtc:answer',
          deviceId,
          action: 'message',
          sdp: sdp
        },
        userInfo: message.userInfo,
        protocol: message.protocol,
        connectionId: message.connectionId,
        requestId: message.requestId,
        systemGenerated: false,
        sudo: (message as any).sudo
      };

      await publisher.publish(routingMessage);
      this.logger?.logWebRTC('answer', deviceId, 'WebRTC answer handled successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle WebRTC answer', { error, deviceId });
      throw error;
    }
  }

  private async handleIceCandidate(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const candidate = (message as any)?.payload?.candidate;
    this.logger?.logWebRTC('ice-candidate', deviceId, 'Handling WebRTC ICE candidate');

    try {
      const targetScope = message.scope;
      
      const routingMessage: RoutingMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'device',
        scope: targetScope, // Preserve scope
        payload: {
          type: 'webrtc:ice-candidate',
          deviceId,
          action: 'message',
          candidate: candidate
        },
        userInfo: message.userInfo,
        protocol: message.protocol,
        connectionId: message.connectionId,
        requestId: message.requestId,
        systemGenerated: false,
        sudo: (message as any).sudo
      };

      await publisher.publish(routingMessage);
      this.logger?.logWebRTC('ice-candidate', deviceId, 'WebRTC ICE candidate handled successfully');
    } catch (error) {
      this.logger?.error('webrtc', 'Failed to handle WebRTC ICE candidate', { error, deviceId });
      throw error;
    }
  }

  private async handleError(message: InMessage): Promise<void> {
    const deviceId = (message as any)?.payload?.deviceId || message.deviceId || 'unknown';
    const error = (message as any)?.payload?.error || 'Unknown WebRTC error';
    
    this.logger?.error('webrtc', 'WebRTC error received', { error, deviceId });

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
      this.logger?.error('webrtc', 'Failed to handle WebRTC error', { error: err, deviceId });
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

    const routingMessage: RoutingMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'device',
      scope,
      payload: {
        type: data.action,
        deviceId,
        ...data,
        action: 'message' // Ensure action is always 'message' for device compatibility
      },
      userInfo: message.userInfo,
      protocol: message.protocol,
      connectionId: message.connectionId,
      requestId: message.requestId,
      systemGenerated: false,
      sudo: (message as any).sudo
    };

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

    const errorMessage: RoutingMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'device',
      scope,
      payload: {
        action: 'message',
        type: 'webrtc:error',
        deviceId,
        error
      },
      userInfo: originalMessage.userInfo,
      protocol: originalMessage.protocol,
      connectionId: originalMessage.connectionId,
      requestId: originalMessage.requestId,
      systemGenerated: false,
      sudo: (originalMessage as any).sudo
    };

    await publisher.publish(errorMessage);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const webrtcHandler = new WebRTCHandlerClass();
