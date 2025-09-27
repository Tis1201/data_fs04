import type { InMessage } from "../interfaces/message";
// import { WebRTCHandler } from '../handlers/webrtcHandler';
// import { ChatHandler } from '../handlers/chatHandler';
// import { TerminalHandler } from '../handlers/terminalHandler';
// import { WebhookHandler } from '../handlers/webhookHandler';
import { messageHandler } from '../handlers/messageHandler';
import { whatsappHandler } from "../handlers/whatsappHandler";
import { deviceHandler } from "../handlers/deviceHandler";
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
    if (type == 'webrtc') {
    //   return WebRTCHandler.handle(message);
    }

    if (type === 'terminal') {
    //   return TerminalHandler.handle(message);
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

    if ( type === 'device'){
      console.log(`[Dispatcher] ===== ROUTING TO DEVICE HANDLER =====`);
      console.log(`[Dispatcher] Calling deviceHandler.handle with message:`, message);
      try {
        await deviceHandler.handle(message);
        console.log(`[Dispatcher] deviceHandler.handle completed successfully`);
      } catch (error) {
        console.error(`[Dispatcher] Error in deviceHandler.handle:`, error);
        console.error(`[Dispatcher] Error stack:`, error.stack);
      }
      return;
    }

    console.warn(`[Dispatcher] ===== UNHANDLED MESSAGE TYPE =====`);
    console.warn(`[Dispatcher] Unhandled message type: ${type}`);
    console.warn(`[Dispatcher] Full message:`, JSON.stringify(message, null, 2));
  }
};
