import type { InMessage } from "../interfaces/message";
import { webrtcHandler } from '../handlers/webrtcHandler';
import { terminalHandler } from '../handlers/terminalHandler';
// import { ChatHandler } from '../handlers/chatHandler';
// import { WebhookHandler } from '../handlers/webhookHandler';
import { messageHandler } from '../handlers/messageHandler';
import { whatsappHandler } from "../handlers/whatsappHandler";
import { deviceHandler } from "../handlers/deviceHandler";
import { handleDeviceConnection } from "../handlers/device/connectionHandler";
import { AuditLogger } from "./auditLogger";

export interface MessageDispatcher {
  dispatch(message: InMessage): Promise<void>;
}

export const MessageDispatcher: MessageDispatcher = {
  async dispatch(message: InMessage): Promise<void> {
    console.log(`[Dispatcher] ===== DISPATCHER CALLED =====`);
    console.log(`[Dispatcher] Full message received:`, JSON.stringify(message, null, 2));
    
    const { type, payload, scope } = message;
    
    console.log(`[Dispatcher] Extracted - type: ${type}, action: ${payload?.action}, scope: ${scope}`);
    console.log(`[Dispatcher] Message connectionId: ${message.connectionId}`);
    console.log(`[Dispatcher] Message protocol: ${message.protocol}`);
    
    // Log the received message for auditing
    console.log(`[Dispatcher] Calling AuditLogger.logReceived...`);
    AuditLogger.logReceived(message);
    console.log(`[Dispatcher] AuditLogger.logReceived completed`);

    // Route based on message type prefix
    if (type === 'webrtc') {
      console.log(`[Dispatcher] ===== ROUTING TO WEBRTC HANDLER =====`);
      console.log(`[Dispatcher] Calling webrtcHandler.handle with message:`, message);
      try {
        await webrtcHandler.handle(message);
        console.log(`[Dispatcher] webrtcHandler.handle completed successfully`);
      } catch (error) {
        console.error(`[Dispatcher] Error in webrtcHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    if (type === 'terminal') {
      console.log(`[Dispatcher] ===== ROUTING TO TERMINAL HANDLER =====`);
      console.log(`[Dispatcher] Calling terminalHandler.handle with message:`, message);
      try {
        await terminalHandler.handle(message);
        console.log(`[Dispatcher] terminalHandler.handle completed successfully`);
      } catch (error) {
        console.error(`[Dispatcher] Error in terminalHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      }
      return;
    }

    if (type === 'webhook') {
    //   return WebhookHandler.handle(message);
    }

    if (type === 'message') {
      return messageHandler.handle(message);
    }

    if ( type === 'whatsapp') {
      return whatsappHandler.handle(message);
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

    if ( type === 'device'){
      // Check if this is a WebRTC message and route to webrtcHandler
      if (payload?.type && typeof payload.type === 'string' && payload.type.startsWith('webrtc:')) {
        console.log(`[Dispatcher] ===== ROUTING DEVICE MESSAGE TO WEBRTC HANDLER =====`);
        console.log(`[Dispatcher] Calling webrtcHandler.handle with message:`, message);
        try {
          await webrtcHandler.handle(message);
          console.log(`[Dispatcher] webrtcHandler.handle completed successfully`);
        } catch (error) {
          console.error(`[Dispatcher] Error in webrtcHandler.handle:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }
      
      // Check if this is a terminal message and route to terminalHandler
      if (payload?.type && typeof payload.type === 'string' && payload.type.startsWith('terminal:')) {
        console.log(`[Dispatcher] ===== ROUTING DEVICE MESSAGE TO TERMINAL HANDLER =====`);
        console.log(`[Dispatcher] Calling terminalHandler.handle with message:`, message);
        try {
          await terminalHandler.handle(message);
          console.log(`[Dispatcher] terminalHandler.handle completed successfully`);
        } catch (error) {
          console.error(`[Dispatcher] Error in terminalHandler.handle:`, error);
          console.error(`[Dispatcher] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        }
        return;
      }
      
      // Default device handler for other device messages
      console.log(`[Dispatcher] ===== ROUTING TO DEVICE HANDLER =====`);
      console.log(`[Dispatcher] Calling deviceHandler.handle with message:`, message);
      try {
        await deviceHandler.handle(message);
        console.log(`[Dispatcher] deviceHandler.handle completed successfully`);
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
