import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';
import { MessageFactory, type InMessage, type RoutingMessage } from '../messaging/interfaces/message';
import type { UserInfo } from '../types/user';
import { userInfoByUserId } from '../security/auth-utils';
import { publisher } from '../messaging/core/publisher';
import { WhatsAppSession } from './WhatsAppSession';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { SystemUser } from '../messaging/interfaces/message';

/****************************************************
 * WhatsAppAccountClient Class
 *
 * Represents a single WhatsApp account connection.
 * The public API (methods, events, properties) remains unchanged.
 ****************************************************/
export class WhatsAppAccountClient{
    
    private id: string;
    private createdBy?: string;
    private userInfo: UserInfo | null = null;
    private prisma: any;
    private session: WhatsAppSession;

    public getId(): string {
        return this.id;
    }
    /********************************************************************************
     * Constructor
     *
     * Initializes the WhatsAppAccountClient instance by setting up directories,
     * creating a unique ID (if not provided), and setting default values.
     *
     * @param id - Optional client identifier.
     * @param phoneNumber - Optional phone number for the client.
     * @param accountId - Optional account identifier for database reference.
     * @param createdBy - Optional identifier for the user who created the client.
     * @param options - Optional directories for authentication and media storage.
     ********************************************************************************/
    constructor(id: string) {
        this.id = id;
        logger.info(`Created WhatsApp client instance with ID: ${this.id}`);
        this.prisma = getEnhancedPrisma({ id: '', systemRole: 'ADMIN' });
        this.session = new WhatsAppSession(this.prisma, this.id);
        
        // Bind the event handlers to ensure 'this' context is preserved
        this.session.on('qrcode', this.handle_qr.bind(this));
        this.session.on('authenticated', this.handle_authenticated.bind(this));
        this.session.on('error', this.handle_error.bind(this));
        this.session.init();
    }

    private handle_authenticated({ pushName, phoneNumber }: { pushName?: string | null; phoneNumber?: string | null }) {
        logger.info(`[${this.id}] Session authenticated - User: ${pushName} (${phoneNumber})`);
        
        try {
            const routingMessage = MessageFactory.createSystemMessage(
                'whatsapp',
                `subscription:whatsapp:${this.id}`,
                {
                    action: 'authenticated',
                    content: {
                        clientId: this.id,
                        pushName: pushName || 'Unknown',
                        phoneNumber: phoneNumber || 'Unknown',
                        timestamp: new Date().toISOString()
                    }
                },
                SystemUser,
                {
                    targetConnectionId: this.id,
                    targetProtocol: 'whatsapp',
                    echoToSender: true,
                    sudo: true
                }
            );

            logger.debug(`[${this.id}] Publishing authenticated message`, {
                targetConnectionId: this.id,
                messageId: routingMessage.id
            });
            
            publisher.publish(routingMessage);
            logger.info(`[${this.id}] Authenticated message published successfully`);
            
        } catch (error) {
            logger.error(`${logContext} Error in handle_authenticated`, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                pushName,
                phoneNumber
            });
            
            // Emit error to ensure it's not silently swallowed
            this.emit('error', { 
                type: 'authentication_message', 
                error: error instanceof Error ? error.message : 'Unknown error in handle_authenticated'
            });
        }
    }

    private handle_error(error: { type: string; error: string }) {
        logger.error(`Error in WhatsApp session ${this.id}: ${error.type} - ${error.error}`);
        
        const routingMessage = MessageFactory.createSystemMessage(
            'whatsapp',
            `subscription:whatsapp:${this.id}`,
            {
                action: 'error',
                content: {
                    clientId: this.id,
                    type: error.type,
                    message: error.error
                }
            },
            SystemUser,
            {
                targetConnectionId: this.id,
                targetProtocol: 'whatsapp',
                echoToSender: true,
                sudo: true
            }
        );

        publisher.publish(routingMessage);
    }

    private handle_qr(qr: string) {
        logger.debug(`QR code received for client ${this.id}`); 
        
        const routingMessage = MessageFactory.createSystemMessage(
            'whatsapp',
            `subscription:whatsapp:${this.id}`,
            {
                action: 'qrCode',
                content: {
                    qrCode: qr,
                    clientId: this.id,
                }
            },
            SystemUser,
            {
                targetConnectionId: this.id,
                targetProtocol: 'whatsapp',
                echoToSender: true,
                sudo: true
            }
        );

        publisher.publish(routingMessage);
    }

    async init(): Promise<void> {
        
    
    }

    
    //QR Code Routing   
            // Send QR code via RoutingMessage if userInfo is available
            // if (this.userInfo) {
            //     const qrMessage: InMessage = {
            //         type: 'whatsapp',
            //         scope: `subscription:whatsapp:${this.id}`,
            //         protocol: 'whatsapp',
            //         connectionId: this.id,
            //         userInfo: this.userInfo,
            //         payload: {
            //             action: 'qrCode',
            //             content: {
            //                 qrCode: qr,
            //                 clientId: this.id,
            //                 accountId: this.accountId
            //             }
            //         }
            //     };

            //     // Create routing message with overrides
            //     const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(qrMessage, {
            //         systemGenerated: true,
            //         echoToSender: true
            //     });

            //     publisher.publish(routingMessage);
            

      



    

   

    /********************************************************************************
     * Send a text message to a recipient.
     *
     * @param to - Recipient's address (phone number or group).
     * @param text - Text content of the message.
     * @returns The full message result object or a mock result object with ID if sending fails
     ********************************************************************************/
    async sendTextMessage(to: string, text: string): Promise<any> {
        try {
            // Format the recipient's phone number
            let recipientJid: string;
            
            recipientJid = `${to}@s.whatsapp.net`;
            
            logger.info(`Sending message to formatted JID: ${recipientJid}`);
            
            // Send the message to the actual recipient
            const result = await this.session.sendMessage(recipientJid, { text });
            logger.info(`Message sent to ${recipientJid}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
            return result; // Return the full result object
        } catch (error: any) {
            // Log the detailed error for debugging
            logger.error(`Error sending message to ${to}:`, error);
            
            // Fallback to mock implementation if sending fails
            const messageId = 'wamid.' + Math.random().toString(36).substr(2, 34);
            logger.warn(`[FALLBACK] Using mock message ID for ${to}: ${messageId}`);
            return { key: { id: messageId }, status: 'mock' }; // Return a mock result object
        }
    }



    //disconnect
            
            // Send disconnection notification via RoutingMessage if userInfo is available
            // if (this.userInfo) {
            //     const disconnectMessage: InMessage = {
            //         type: 'whatsapp',
            //         scope: `subscription:whatsapp:${this.id}`,
            //         protocol: "whatsapp",
            //         connectionId: this.id,
            //         userInfo: this.userInfo,
            //         payload: {
            //             action: 'disconnected',
            //             content: {
            //                 clientId: this.id,
            //                 reason: 'manual_disconnect'
            //             }
            //         }
            //     };

            //     // Create routing message with overrides
            //     const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(disconnectMessage, {
            //         systemGenerated: true,
            //         echoToSender: true
            //     });

            //     publisher.publish(routingMessage);
            // }
            
        
        //Reconnect         
            // Send the connected notification via RoutingMessage
            // if (this.userInfo) {
            //     const connectionMessage: InMessage = {
            //         type: 'whatsapp',
            //         scope: `subscription:whatsapp:${this.id}`,
            //         protocol: "whatsapp",
            //         connectionId: this.id,
            //         userInfo: this.userInfo,
            //         payload: {
            //             action: 'connected',
            //             content: {
            //                 clientId: this.id,
            //                 pushName: this.pushName,
            //                 displayName: this.pushName,
            //                 phoneNumber: this.phoneNumber
            //             }
            //         }
            //     };

            //     // Create routing message with overrides
            //     const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(connectionMessage, {
            //         systemGenerated: true,
            //         echoToSender: true
            //     });

            //     publisher.publish(routingMessage);
          
    

        //Disconnect Message
            // Send disconnection notification via RoutingMessage if userInfo is available
            // if (this.userInfo) {
            //     const disconnectMessage: InMessage = {
            //         type: 'whatsapp',
            //         scope: `subscription:whatsapp:${this.id}`,
            //         protocol: "whatsapp",
            //         connectionId: this.id,
            //         userInfo: this.userInfo,
            //         payload: {
            //             action: 'disconnected',
            //             content: {
            //                 clientId: this.id,
            //                 error: error ? JSON.stringify(error) : null
            //             }
            //         }
            //     };

            //     // Create routing message with overrides
            //     const routingMessage: RoutingMessage = MessageFactory.toRoutingMessage(disconnectMessage, {
            //         systemGenerated: true,
            //         echoToSender: true
            //     });

            //     publisher.publish(routingMessage);
            // }

            

}

