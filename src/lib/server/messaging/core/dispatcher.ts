import type { InMessage } from "../interfaces/message";
// import { WebRTCHandler } from '../handlers/webrtcHandler';
// import { ChatHandler } from '../handlers/chatHandler';
// import { TerminalHandler } from '../handlers/terminalHandler';
// import { WebhookHandler } from '../handlers/webhookHandler';
import { messageHandler } from '../handlers/messageHandler';

export interface MessageDispatcher {
  dispatch(message: InMessage): Promise<void>;
}

export const MessageDispatcher: MessageDispatcher = {
  async dispatch(message: InMessage): Promise<void> {
    const { type, payload, scope } = message;

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

    console.warn(`[Dispatcher] Unhandled message type: ${payload.type}: ${JSON.stringify(message)}`);
  }
};
