import baileys from '@whiskeysockets/baileys';
const { proto } = baileys;
import { getClient } from '../store';
import { WebSocketServer } from '../websocket';
import { logger } from '$lib/server/logger';
import WebSocket from 'ws';

/**
 * Handle incoming WhatsApp messages
 */
export function handleIncomingMessages(messagesUpsert: { 
    messages: proto.IWebMessageInfo[],
    type: 'notify' | 'append'
}, clientId: string): void {
    // Get the latest client data
    const clientData = getClient(clientId);
    if (!clientData) {
        logger.warn(`Message received for unknown client ${clientId}`);
        return;
    }
    
    logger.debug(`New message received for client ${clientId}`);
    
    // Process only new messages
    if (messagesUpsert.type === 'notify') {
        for (const msg of messagesUpsert.messages) {
            // Skip messages sent by the current user
            if (msg.key.fromMe) continue;
            
            // Get message content
            const messageContent = msg.message?.conversation || 
                                  msg.message?.extendedTextMessage?.text || 
                                  msg.message?.imageMessage?.caption || 
                                  'Media message';
            
            // Get sender information
            const sender = msg.key.remoteJid?.split('@')[0] || 'Unknown';
            
            logger.debug(`Message from ${sender}: ${messageContent}`);
            
            // Create message data
            const messageData = {
                clientId,
                accountId: clientData.accountId,
                sender,
                content: messageContent,
                timestamp: new Date().toISOString(),
                messageId: msg.key.id,
                rawMessage: msg
            };
            
            // Broadcast message to all connected clients
            WebSocketServer.broadcast({
                type: 'whatsapp',
                action: 'message',
                data: messageData
            });
            
            // Send to specific client if connected
            if (clientData.socket && clientData.socket.readyState === WebSocket.OPEN) {
                clientData.socket.send(JSON.stringify({
                    type: 'whatsapp',
                    action: 'message',
                    data: {
                        sender,
                        content: messageContent,
                        timestamp: new Date().toISOString(),
                        messageId: msg.key.id
                    }
                }));
            }
        }
    }
}
