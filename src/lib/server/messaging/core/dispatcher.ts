import type { InMessage } from "../interfaces/message";
import { webrtcHandler } from '../../handlers/WebRTCHandler';
import { terminalHandler } from '../../handlers/TerminalHandler';
import { rdpHandler } from '../../handlers/RDPHandler';
import { messageHandler } from '../handlers/messageHandler';
import { deviceHandler } from "../handlers/deviceHandler";
import { handleDeviceConnection } from "../handlers/device/connectionHandler";
import { roomHandler } from "../handlers/roomHandler";
import { AuditLogger } from "./auditLogger";

export interface MessageDispatcher {
  dispatch(message: InMessage): Promise<void>;
}

export const MessageDispatcher: MessageDispatcher = {
  async dispatch(message: InMessage): Promise<void> {
    const { type, payload, scope } = message;

    // Debug logging for all messages
    console.log(`[Dispatcher] Received message:`, {
      type,
      payload: payload ? { action: payload.action, type: payload.type, deviceId: payload.deviceId } : null,
      scope
    });

    // Log the received message for auditing
    AuditLogger.logReceived(message);

    // Route based on message type prefix
    if (type === 'webrtc' || (type === 'device' && webrtcHandler.supports(type, message))) {
      console.log(`[Dispatcher] Routing webrtc message:`, { type, payload: message.payload });
      try {
        await webrtcHandler.handle(message);
        console.log(`[Dispatcher] WebRTC handler completed successfully`);
      } catch (error) {
        console.error(`[Dispatcher] Error in webrtcHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    // Debug: Log if WebRTC message was not caught
    if (type === 'device' && typeof message.payload?.type === 'string' && message.payload.type.startsWith('webrtc:')) {
      console.log(`[Dispatcher] WARNING: WebRTC message not caught by handler!`, {
        type,
        payloadType: message.payload.type,
        supportsResult: webrtcHandler.supports(type, message)
      });
    }

    if (type === 'terminal') {
      try {
        await terminalHandler.handle(message);
      } catch (error) {
        console.error(`[Dispatcher] Error in terminalHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    if (type === 'rdp') {
      try {
        await rdpHandler.handle(message);
      } catch (error) {
        console.error(`[Dispatcher] Error in rdpHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    if (type === 'message') {
      return messageHandler.handle(message);
    }

    if (type === 'room') {
      try {
        await roomHandler.handle(message);
      } catch (error) {
        console.error(`[Dispatcher] Error in roomHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    if (type === 'device:connection') {
      console.log(`[Dispatcher] ===== ROUTING TO DEVICE CONNECTION HANDLER =====`);
      console.log(`[Dispatcher] Calling handleDeviceConnection with message:`, message);
      try {
        await handleDeviceConnection(message);
        console.log(`[Dispatcher] handleDeviceConnection completed successfully`);
      } catch (error) {
        console.error(`[Dispatcher] Error in handleDeviceConnection:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    if (type === 'device' || type.startsWith('device:')) {
      console.log(`[Dispatcher] Processing device message:`, { type, payload: message.payload });
      // Check if this is a WebRTC message and route to webrtcHandler
      if (webrtcHandler.supports(type, message)) {
        console.log(`[Dispatcher] WebRTC handler supports this message, routing to webrtcHandler`);
        try {
          await webrtcHandler.handle(message);
        } catch (error) {
          console.error(`[Dispatcher] Error in webrtcHandler.handle:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Check if this is a terminal message and route to terminalHandler
      if (terminalHandler.supports(type, message)) {
        console.log(`[Dispatcher] Terminal handler supports this message, routing to terminalHandler`);
        try {
          await terminalHandler.handle(message);
        } catch (error) {
          console.error(`[Dispatcher] Error in terminalHandler.handle:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Handle device:restartAck messages specifically
      if (type === 'device:restartAck') {
        try {
          // Convert device:restartAck to device message format for the handler
          const convertedMessage = {
            ...message,
            type: 'device',
            payload: {
              ...payload,
              action: 'restartAck'
            }
          };
          await deviceHandler.handle(convertedMessage);
        } catch (error) {
          console.error(`[Dispatcher] Error in deviceHandler.handle for restartAck:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Handle device:rebootAck messages specifically
      if (type === 'device:rebootAck') {
        try {
          // Convert device:rebootAck to device message format for the handler
          const convertedMessage = {
            ...message,
            type: 'device',
            payload: {
              ...payload,
              action: 'rebootAck'
            }
          };
          await deviceHandler.handle(convertedMessage);
        } catch (error) {
          console.error(`[Dispatcher] Error in deviceHandler.handle for rebootAck:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Handle device:rebootComplete messages specifically
      if (type === 'device:rebootComplete') {
        try {
          // Convert device:rebootComplete to device message format for the handler
          const convertedMessage = {
            ...message,
            type: 'device',
            payload: {
              ...payload,
              action: 'rebootComplete'
            }
          };
          await deviceHandler.handle(convertedMessage);
        } catch (error) {
          console.error(`[Dispatcher] Error in deviceHandler.handle for rebootComplete:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Handle device:installApp messages specifically (supports both naming conventions)
      if (type === 'device:installApp' || type === 'device:install_app') {
        try {
          // Convert device:install_app to device message format for the handler
          const convertedMessage = {
            ...message,
            type: 'device',
            payload: {
              ...payload,
              action: 'install_app'
            }
          };
          await deviceHandler.handle(convertedMessage);
        } catch (error) {
          console.error(`[Dispatcher] Error in deviceHandler.handle for install_app:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Handle device:pull_file messages specifically
      if (type === 'device:pullFile' || type === 'device:pull_file') {
        try {
          // Convert device:pull_file to device message format for the handler
          const convertedMessage = {
            ...message,
            type: 'device',
            payload: {
              ...payload,
              action: 'pull_file'
            }
          };
          await deviceHandler.handle(convertedMessage);
        } catch (error) {
          console.error(`[Dispatcher] Error in deviceHandler.handle for pull_file:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Handle device:push_file messages specifically
      if (type === 'device:pushFile' || type === 'device:push_file') {
        try {
          // Convert device:push_file to device message format for the handler
          const convertedMessage = {
            ...message,
            type: 'device',
            payload: {
              ...payload,
              action: 'push_file'
            }
          };
          await deviceHandler.handle(convertedMessage);
        } catch (error) {
          console.error(`[Dispatcher] Error in deviceHandler.handle for push_file:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Handle device:progressUpdate messages specifically
      if (type === 'device:progressUpdate') {
        try {
          // Convert device:progressUpdate to device message format for the handler
          const convertedMessage = {
            ...message,
            type: 'device',
            payload: {
              ...payload,
              action: 'progressUpdate'
            }
          };
          await deviceHandler.handle(convertedMessage);
        } catch (error) {
          console.error(`[Dispatcher] Error in deviceHandler.handle for progressUpdate:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }

      // Default device handler for other device messages
      try {
        await deviceHandler.handle(message);
      } catch (error) {
        console.error(`[Dispatcher] Error in deviceHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    console.warn(`[Dispatcher] ===== UNHANDLED MESSAGE TYPE =====`);
    console.warn(`[Dispatcher] Unhandled message type: ${type}`);
    console.warn(`[Dispatcher] Full message:`, JSON.stringify(message, null, 2));
  }
};
