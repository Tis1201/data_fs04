import { type InMessage, type RoutingMessage, MessageFactory } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { publisher } from '../core/publisher';
import { logger } from '$lib/server/logger';
import { whatsAppAccountManager, WhatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { subscriptionRegistry } from '../core/subscriptionRegistry';
import { v4 as uuidv4 } from 'uuid';

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
            case 'cleanup_client':
                await this.handleCleanupClient(message);
                break;
            default:
                logger.warn(`[WhatsAppHandler] Unhandled action: ${action}`);
                break;
        }
    }

    private async handleQRRequest(message: InMessage): Promise<void> {
        const { payload, requestId } = message;
        const { action } = payload;

        logger.info(`[WhatsAppHandler] Handling QR code request: ${JSON.stringify({ messageId: message.id, requestId })}`);

        try {
            // Create a new WhatsApp client instance and get the QR code
            const clientId = uuidv4();
            const { client } = await whatsAppAccountManager.create(clientId, message.userInfo.id);
            
            // Wait for the QR code to be generated
            // const qrCode = await qrCodePromise;
            // logger.debug(`Generated QR code for client ${clientId} for user ${message.userInfo.id}`);
            // Add subscription for this client
            // subscriptionRegistry.addSubscription(`subscription:whatsapp:${clientId}`, `subscriber:connection:${message.connectionId}`);

            // Create response message with the same requestId
            // const qrMessage: InMessage = {
            //     id: message.id, // Preserve original message ID if available
            //     type: 'whatsapp',
            //     scope: message.scope,
            //     protocol: message.protocol,
            //     connectionId: message.connectionId,
            //     userInfo: message.userInfo,
            //     requestId: requestId, // IMPORTANT: Preserve the requestId
            //     payload: {
            //         action: 'qrCode',
            //         content: {
            //             qrCode: null, // Initial response has null QR code
            //             clientId: clientId
            //         }
            //     }
            // };

            // // Send initial response to unblock the client
            // const initialResponse: RoutingMessage = MessageFactory.toRoutingMessage(qrMessage, {
            //     systemGenerated: true,
            //     echoToSender: true
            // });
            // publisher.publish(initialResponse);
            
            // // The actual QR code will be sent via subscription
            // // This ensures the client gets both an immediate response and the QR code when ready
            // if (qrCode) {
            //     // Create a separate message for the subscription with the actual QR code
            //     const subscriptionMessage: InMessage = {
            //         type: 'whatsapp',
            //         scope: `subscription:whatsapp:${clientId}`,
            //         protocol: message.protocol,
            //         connectionId: clientId, // Use clientId as the connection ID for the subscription message
            //         userInfo: message.userInfo,
            //         payload: {
            //             action: 'qrCode',
            //             content: {
            //                 qrCode: qrCode,
            //                 clientId: clientId
            //             }
            //         }
            //     };
                
            //     const subscriptionRoutingMessage: RoutingMessage = MessageFactory.toRoutingMessage(subscriptionMessage, {
            //         systemGenerated: true
            //     });
                
            //     publisher.publish(subscriptionRoutingMessage);
            // }
        } catch (error) {
            logger.error(`[WhatsAppHandler] Error handling QR request: ${error.message}`, error);
            
            // Send error response with the same requestId
            const errorMessage: InMessage = {
                type: 'whatsapp',
                scope: message.scope,
                protocol: message.protocol,
                connectionId: message.connectionId,
                userInfo: message.userInfo,
                requestId: requestId, // IMPORTANT: Preserve the requestId
                payload: {
                    action: 'error',
                    content: {
                        error: 'Failed to generate QR code',
                        message: error.message
                    }
                }
            };
            
            const errorRoutingMessage: RoutingMessage = MessageFactory.toRoutingMessage(errorMessage, {
                systemGenerated: true,
                echoToSender: true
            });
            
            publisher.publish(errorRoutingMessage);
        }
    }

    private async handleMessage(message: InMessage): Promise<void> {
        const { payload, requestId } = message;
        const { content } = payload;

        logger.info(`[WhatsAppHandler] Handling message: ${JSON.stringify({ messageId: message.id, requestId })}`);

        try {
            // Process the message (currently just echoing)
            const responseContent = `Echo: ${content}`;
            
            // Create response with the same requestId
            const responseMessage: InMessage = {
                id: message.id, // Preserve original message ID if available
                type: 'whatsapp',
                scope: message.scope,
                protocol: message.protocol,
                connectionId: message.connectionId,
                userInfo: message.userInfo,
                requestId: requestId, // IMPORTANT: Preserve the requestId
                payload: {
                    action: 'message_response',
                    content: responseContent
                }
            };
            
            const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(responseMessage, {
                systemGenerated: true,
                echoToSender: true
            });
            
            publisher.publish(routingMessage);
        } catch (error) {
            logger.error(`[WhatsAppHandler] Error handling message: ${error.message}`, error);
            
            // Send error response with the same requestId
            const errorMessage: InMessage = {
                type: 'whatsapp',
                scope: message.scope,
                protocol: message.protocol,
                connectionId: message.connectionId,
                userInfo: message.userInfo,
                requestId: requestId, // IMPORTANT: Preserve the requestId
                payload: {
                    action: 'error',
                    content: {
                        error: 'Failed to process message',
                        message: error.message
                    }
                }
            };
            
            const errorRoutingMessage: RoutingMessage = MessageFactory.toRoutingMessage(errorMessage, {
                systemGenerated: true,
                echoToSender: true
            });
            
            publisher.publish(errorRoutingMessage);
        }
    }

    /**
     * Handles cleanup of a WhatsApp client that was created but not associated with an account
     * @param message - The incoming message containing cleanup details
     */
    private async handleCleanupClient(message: InMessage): Promise<void> {
        const { payload, requestId } = message;
        const { clientId } = payload as { clientId: string };

        if (!clientId) {
            logger.warn('[WhatsAppHandler] cleanup_client action requires clientId');
            return;
        }

        logger.info(`[WhatsAppHandler] Cleaning up client: ${clientId}`);

        try {
            // Clean up the client
            await whatsAppAccountManager.cleanupClient(clientId);
            
            // Send success response
            const response = MessageFactory.createResponse(
                'whatsapp',
                { success: true },
                message,
                requestId
            );
            
            await publisher.publish(response);
            logger.info(`[WhatsAppHandler] Successfully cleaned up client: ${clientId}`);
        } catch (error) {
            logger.error(`[WhatsAppHandler] Error cleaning up client ${clientId}:`, error);
            
            // Send error response
            const errorResponse = MessageFactory.createResponse(
                'whatsapp',
                { 
                    success: false,
                    error: 'Failed to clean up client',
                    details: error.message
                },
                message,
                requestId
            );
            
            await publisher.publish(errorResponse);
        }
    }
}

// Export an instance of the handler
export const whatsappHandler = new WhatsAppHandler();
