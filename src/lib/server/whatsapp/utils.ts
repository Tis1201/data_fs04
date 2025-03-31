import type { WhatsAppAccountClient } from './WhatsAppAccountClient';
import WebSocket from 'ws';
import { logger } from '$lib/server/logger';

/**
 * Set up event listeners for a WhatsAppAccountClient instance and forward events to WebSocket
 * @param client The WhatsAppAccountClient instance
 * @param socket WebSocket to send events to
 * @param clientId Client ID for logging purposes
 */
export function setupClientEventListeners(client: WhatsAppAccountClient, socket: WebSocket, clientId: string): void {
    // Set up QR code event listener
    client.on('qr', (qrCode) => {
        // Send QR code to WebSocket client
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'whatsapp_qr',
                data: { qrCode, clientId }
            }));
            logger.info(`QR code sent to WebSocket for client ${clientId}`);
        }
    });
    
    // Set up state change event listener
    client.on('state', (state) => {
        // Send state change to WebSocket client
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'whatsapp_state',
                data: { state, clientId }
            }));
            logger.info(`State change (${state}) sent to WebSocket for client ${clientId}`);
        }
    });
    
    // Listen for connected events and handle client info
    client.on('connected', (info) => {
        // Get client info
        const clientInfo = client.getInfo();
        
        // Send connected event to WebSocket client
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'whatsapp_connected',
                data: { clientId, info: clientInfo }
            }));
            logger.info(`Connected event sent to WebSocket for client ${clientId}`);
        }
    });
    
    // Listen for message events
    client.on('message', (message) => {
        // Send message to WebSocket client
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'whatsapp_message',
                data: { message, clientId }
            }));
            logger.debug(`Message event sent to WebSocket for client ${clientId}`);
        }
    });
}
