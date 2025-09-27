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
    const { type, payload, scope } = message;
    
    console.log(`[Dispatcher] Received message type: ${type}, action: ${payload?.action}`);
    
    // Log the received message for auditing
    AuditLogger.logReceived(message);

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
      console.log(`[Dispatcher] Routing device message to deviceHandler`);
      return deviceHandler.handle(message);
    }

    console.warn(`[Dispatcher] Unhandled message type: ${type}: ${JSON.stringify(message)}`);
  }
};
