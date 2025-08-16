import { type InMessage, type RoutingMessage, MessageFactory } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { publisher } from '../core/publisher';
import { logger } from '$lib/server/logger';
import { v4 as uuidv4 } from 'uuid';

export const messageHandler: Handler = {
  supports(type: string): boolean {
    // We route generic device messages that don't match specialized handlers
    return type.startsWith('message:');
  },

  async handle(message: InMessage): Promise<void> {
    // Ensure scope exists; if missing, fallback to device or user scope
    const deviceId = (message as any)?.payload?.deviceId as string | undefined;
    const scope = (message as any)?.scope || (deviceId ? `subscription:device:${deviceId}` : `user:${message.userInfo.id}`);

    //{
    // "payload":{"type":"message","content":"test"},
    // "userInfo":{"id":"cm8ygueii0000hsswg8xuc0yz","email":"admin@admin.com","name":null,"systemRole":"ADMIN","source":"session"},"protocol":"websocket",
    //"connectionId":"a9554234-0810-45d4-91c0-5170c4d9b33c",
    //"scope":"user:cm8ygueii0000hsswg8xuc0yz"
    //}

    const { payload } = message;
    const { content } = payload;

    // payload.content = "echo: " + content;

    const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(message, { sudo: true, scope });
    await publisher.publish(routingMessage);

    // logger.debug(`[MessageHandler] Routing message: ${JSON.stringify(routingMessage)}`);
  }
};




