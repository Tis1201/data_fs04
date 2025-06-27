import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';
import { MessageFactory, type InMessage, type RoutingMessage } from '../messaging/interfaces/message';
import type { UserInfo } from '../types/user';
import { userInfoByUserId } from '../security/auth-utils';
import { publisher } from '../messaging/core/publisher';

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
    private socket: any;
    private qrCode: string | null = null;
    private qrCodeTimestamp: number = 0;
    private qrCodeRefreshTimer?: NodeJS.Timeout;
    private phoneNumber?: string;
    private accountId?: string;
    private pushName?: string;
    private autoReconnect: boolean = true;
    private reconnectCount: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 3000; // in milliseconds
    private createdAt: number = Date.now();
    private baileysLogger: any;

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
     * Send Text Message
     *
     * Sends a text message to the specified recipient.
     *
     * @param to - Recipient's address (phone number or group).
     * @param text - Text content of the message.
     * @returns Message ID if sent successfully, or null on failure.
     ********************************************************************************/
    async sendTextMessage(to: string, text: string): Promise<string | null> {
        // if (!this.socket || this.state !== WhatsAppClientState.Connected) {
        //     throw new Error('Client not connected');
        // }

        // logger.info(`Sending message to ${to}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
        
        // try {
        //     // Send the message to the actual recipient
        //     const result = await this.socket.sendMessage(to, { text });
        //     logger.info(`Message sent to ${to}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
        //     return result?.key?.id || null;
        // } catch (error) {
        //     // Log the detailed error for debugging
        //     logger.error(`Error sending message to ${to}: ${error.message || error}`);
            
        //     // Re-throw the error to be handled by the caller
        //     throw error;
        // }
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

