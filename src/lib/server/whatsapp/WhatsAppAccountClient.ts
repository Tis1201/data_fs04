import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';
import { MessageFactory, type InMessage, type RoutingMessage } from '../messaging/interfaces/message';
import type { UserInfo } from '../types/user';
import { userInfoByUserId } from '../security/auth-utils';
import { publisher } from '../messaging/core/publisher';
import { WhatsAppSession } from './WhatsAppSession';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { SystemUser } from '../messaging/interfaces/message';
import type { proto } from '@whiskeysockets/baileys';

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
    private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
    private lastConnectionUpdate: Date | null = null;

    constructor(id: string) {
        this.id = id;
        logger.info(`Created WhatsApp client instance with ID: ${this.id}`);
        this.prisma = getEnhancedPrisma({ id: '', systemRole: 'ADMIN' });
        this.session = new WhatsAppSession(this.prisma, this.id);
        
        // Bind the event handlers to ensure 'this' context is preserved
        this.session.on('qrcode', this.handle_qr.bind(this));
        this.session.on('authenticated', this.handle_authenticated.bind(this));
        this.session.on('ready', this.handle_ready.bind(this));
        this.session.on('disconnected', this.handle_disconnected.bind(this));
        this.session.on('error', this.handle_error.bind(this));
        this.session.on('message', this.handleIncomingMessage.bind(this));
        this.session.init();
    }

    private async handle_authenticated({ pushName, phoneNumber }: { pushName?: string | null; phoneNumber?: string | null }) {
        logger.info(`[${this.id}] Session authenticated - User: ${pushName} (${phoneNumber})`);
        
        try {
            // Update account info in database first
            try {
                await this.prisma.whatsAppAccount.update({
                    where: { client_id: this.id },
                    data: {
                        name: pushName || null,
                        phoneNumber: phoneNumber || null,
                        lastAuthenticated: new Date(),
                        isAuthenticated: true,
                        client_status: 'CONNECTED',
                        connectionState: 'connected'
                    }
                });
                logger.info(`[${this.id}] Updated account info in database`);
            } catch (error) {
                logger.error(`[${this.id}] Failed to update account info: ${error}`);
                throw error; // Re-throw to be caught by outer try-catch
            }

            // Send authenticated message
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

    private async updateConnectionState(state: 'connecting' | 'connected' | 'disconnected', error?: string) {
        if (this.connectionState === state) {
            return; // No state change needed
        }

        const previousState = this.connectionState;
        this.connectionState = state;
        this.lastConnectionUpdate = new Date();

        logger.debug(`[${this.id}] Connection state updated: ${previousState} -> ${state}`, {
            previousState,
            newState: state,
            timestamp: this.lastConnectionUpdate.toISOString()
        });

        try {
            await this.prisma.whatsAppAccount.update({
                where: { client_id: this.id },
                data: {
                    client_status: state.toUpperCase(),
                    connectionState: state,
                    lastConnectionUpdate: this.lastConnectionUpdate,
                    ...(error && { lastError: error })
                }
            });
            
            logger.info(`[${this.id}] Connection state updated: ${previousState} -> ${state}`, {
                previousState,
                newState: state,
                timestamp: this.lastConnectionUpdate.toISOString()
            });
        } catch (error) {
            logger.error(`[${this.id}] Failed to update connection state: ${error}`);
        }
    }

    private handle_ready() {
        logger.info(`[${this.id}] WhatsApp client is ready`);
        this.updateConnectionState('connected');
    }

    private handle_disconnected(reason: string) {
        logger.warn(`[${this.id}] WhatsApp client disconnected: ${reason}`);
        this.updateConnectionState('disconnected', reason);
    }

    private async handleIncomingMessage(msg: proto.IWebMessageInfo) {
        try {
            const remoteJid = msg.key.remoteJid || 'unknown';
            logger.debug(`[${this.id}] Received message from ${remoteJid}`);
            
            // Skip if message is from the current user
            if (msg.key.fromMe) {
                logger.warn(`[${this.id}] message from self`);
                // return;
            }

            // Create a clean message object without circular references
            const messageData = {
                id: msg.key.id,
                from: remoteJid,
                timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString(),
                content: msg.message?.conversation || '[Media message]',
                clientId: this.id
            };

            logger.debug(`[${this.id}] Creating routing message for WhatsApp client ${this.id}`);
            const routingMessage = MessageFactory.createSystemMessage(
                'whatsapp',
                `subscription:whatsapp:${this.id}`,
                {
                    action: 'message',
                    content: msg
                },
                SystemUser,
                {
                    targetConnectionId: this.id,
                    targetProtocol: 'whatsapp',
                    echoToSender: false,
                    sudo: true // Ensure message is delivered regardless of permissions
                }
            );

            logger.debug(`[${this.id}] Publishing message to scope: subscription:whatsapp:${this.id}`);
            await publisher.publish(routingMessage);
            logger.debug(`[${this.id}] Successfully published message: ${msg.key.id}`);
        } catch (error) {
            logger.error(`[${this.id}] Error handling incoming message: ${error}`);
            this.emit('error', { 
                type: 'message_handling', 
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private handle_qr(qr: string) {
        logger.debug(`[${this.id}] QR code received`);
        this.updateConnectionState('connecting');
        
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

    /********************************************************************************
     * Send an image message to a recipient.
     *
     * @param to - Recipient's phone number.
     * @param imageUrl - URL of the image to send.
     * @param caption - Optional caption for the image.
     * @param mimeType - MIME type of the image (default: 'image/jpeg').
     * @returns The message result object with status and message ID
     ********************************************************************************/
    async sendImageMessage(
        to: string, 
        imageUrl: string, 
        caption: string = '',
        mimeType: string = 'image/jpeg'
    ): Promise<any> {
        const recipientJid = `${to}@s.whatsapp.net`;
        logger.info(`Sending image to ${recipientJid}: ${imageUrl.substring(0, 100)}`);
        
        try {
            // Download the image from the URL
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
            }
            
            const imageBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);
            
            // Send the image using the WhatsApp session
            const result = await this.session.sendMessage(recipientJid, {
                image: buffer,
                caption: caption,
                mimetype: mimeType,
                // Optional: Add filename if available from URL
                filename: imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg'
            });
            
            logger.info(`Image sent to ${recipientJid} with ID: ${result.key.id}`);
            return {
                ...result,
                isMock: false
            };
        } catch (error: any) {
            logger.error(`Error sending image to ${to}:`, error);
            
            // Fallback to mock implementation if sending fails
            const messageId = 'wamid.' + Math.random().toString(36).substr(2, 34);
            logger.warn(`[FALLBACK] Using mock message ID for image to ${to}: ${messageId}`);
            return { 
                key: { id: messageId }, 
                status: 'mock',
                isMock: true
            };
        }
    }

    /********************************************************************************
     * Send a document file to a recipient.
     * 
     * @param to - Recipient's phone number.
     * @param documentUrl - URL of the document to send.
     * @param filename - Name of the document file.
     * @param caption - Optional caption for the document.
     * @param mimeType - MIME type of the document (default: 'application/pdf').
     * @returns The message result object with status and message ID
     ********************************************************************************/
    async sendDocumentMessage(
        to: string,
        documentUrl: string,
        filename: string,
        caption: string = '',
        mimeType: string = 'application/pdf'
    ): Promise<any> {
        const recipientJid = `${to}@s.whatsapp.net`;
        logger.info(`Sending document to ${recipientJid}: ${documentUrl.substring(0, 50)}`);
        
        try {
            // Download the document from the URL
            const response = await fetch(documentUrl);
            if (!response.ok) {
                throw new Error(`Failed to download document: ${response.status} ${response.statusText}`);
            }
            
            const documentBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(documentBuffer);
            
            // Send the document using the WhatsApp session
            const result = await this.session.sendMessage(recipientJid, {
                document: buffer,
                caption: caption,
                mimetype: mimeType,
                filename: filename
            });
            
            logger.info(`Document sent to ${recipientJid} with ID: ${result.key.id}`);
            return {
                ...result,
                isMock: false
            };
        } catch (error: any) {
            logger.error(`Error sending document to ${to}:`, error);
            
            // Fallback to mock implementation if sending fails
            const messageId = 'wamid.' + Math.random().toString(36).substr(2, 34);
            logger.warn(`[FALLBACK] Using mock message ID for document to ${to}: ${messageId}`);
            return { 
                key: { id: messageId }, 
                status: 'mock',
                isMock: true
            };
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

