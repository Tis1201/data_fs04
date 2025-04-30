import { type InMessage, type RoutingMessage, MessageFactory } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { publisher } from '../core/publisher';
import { logger } from '$lib/server/logger';
import { whatsAppAccountManager, WhatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { subscriptionRegistry } from '../core/subscriptionRegistry';

export class WhatsAppHandler implements Handler {
    supports(type: string): boolean {
        return type.startsWith('message:');
    }

    async handle(message: InMessage): Promise<void> {
        const { payload } = message;
        const { action, content } = payload;

        logger.debug(`[WhatsAppHandler] Received message: ${JSON.stringify(message)}`);

        switch (action) {
            case 'request_qr':
                await this.handleQRRequest(message);
                break;
            case 'message':
                await this.handleMessage(message);
                break;
            default:
                logger.warn(`[WhatsAppHandler] Unhandled action: ${action}`);
                break;
        }
    }

    private async handleQRRequest(message: InMessage): Promise<void> {
        const { payload } = message;
        const { action } = payload;

        logger.info(`[WhatsAppHandler] Handling QR code request: ${JSON.stringify(message)}`);

        // TODO: Implement actual QR code request handling
        // This would typically involve:
        // 1. Creating a new WhatsApp client instance
        // 2. Generating a QR code
        // 3. Sending the QR code back to the client
        const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient(message.userInfo.id);
        const qrCode = await qrCodePromise;

        message.payload.content = qrCode;

        subscriptionRegistry.addSubscription(`subscription:whatsapp:${clientId}`, `subscriber:connection:${message.connectionId}`);

        // Create routing message with overrides
        const qrMessage: InMessage = {
            type: 'whatsapp',
            scope: message.scope,
            protocol: message.protocol,
            connectionId: message.connectionId,
            userInfo: message.userInfo,
            payload: {
                action: 'qrCode',
                content:{
                    qrCode: qrCode,
                    clientId: clientId
                }
            }
        };

        // Create routing message with overrides
        const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(qrMessage, {
            systemGenerated: true,
            echoToSender: true
        });

        publisher.publish(routingMessage);


    }

    private async handleMessage(message: InMessage): Promise<void> {
        const { payload } = message;
        const { content } = payload;

        logger.info(`[WhatsAppHandler] Handling message: ${JSON.stringify(message)}`);

        // Echo the message back
        payload.content = `Echo: ${content}`;
        const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(message);
        publisher.publish(routingMessage);
    }
}

// Export an instance of the handler
export const whatsappHandler = new WhatsAppHandler();
