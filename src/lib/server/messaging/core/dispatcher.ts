import type { Message } from "../interfaces/message";
// import { WebRTCHandler } from '../handlers/webrtcHandler';
// import { ChatHandler } from '../handlers/chatHandler';
// import { TerminalHandler } from '../handlers/terminalHandler';
// import { WebhookHandler } from '../handlers/webhookHandler';

export interface MessageDispatcher {
  dispatch(message: Message): Promise<void>;
}

export const MessageDispatcher: MessageDispatcher = {
  async dispatch(message: Message): Promise<void> {
    const { payload } = message;

    // Route based on message type prefix
    if (payload.type.startsWith('webrtc:')) {
    //   return WebRTCHandler.handle(message);
    }

    if (payload.type.startsWith('chat:')) {
    //   return ChatHandler.handle(message);
    }

    if (payload.type.startsWith('terminal:')) {
    //   return TerminalHandler.handle(message);
    }

    if (payload.type.startsWith('webhook:')) {
    //   return WebhookHandler.handle(message);
    }

    console.warn(`[Dispatcher] Unhandled message type: ${payload.type}: ${JSON.stringify(message)}`);
  }
};
