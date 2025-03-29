import WebSocket from 'ws';
import { WebSocketServer } from '../websocket';
import { WhatsAppWebSocketMessage } from '../types';
import { logger } from '$lib/server/logger';

/**
 * Send a message to a specific WebSocket client
 */
export function sendToClient(socket: WebSocket | null, message: WhatsAppWebSocketMessage): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    
    try {
        socket.send(JSON.stringify(message));
        return true;
    } catch (error) {
        logger.error('Failed to send message to WebSocket client', { error });
        return false;
    }
}

/**
 * Broadcast a message to all connected WebSocket clients
 */
export function broadcast(message: WhatsAppWebSocketMessage): void {
    WebSocketServer.broadcast(message);
}

/**
 * Send a QR code to a client
 */
export function sendQrCode(socket: WebSocket | null, clientId: string, accountId: string | null, qrCode: string): void {
    logger.info(`Sending QR code for client ${clientId} to WebSocket clients`);
    logger.debug(`QR code length: ${qrCode.length}, first 20 chars: ${qrCode.substring(0, 20)}...`);
    
    // Send to specific client if available
    if (socket) {
        const message = {
            type: 'whatsapp',
            action: 'qrCode',
            data: { 
                qrCode,
                clientId,
                accountId 
            }
        };
        
        logger.debug(`Sending QR code message to specific client: ${JSON.stringify(message).substring(0, 100)}...`);
        
        const success = sendToClient(socket, message);
        logger.info(`QR code sent to specific client: ${success ? 'success' : 'failed'}`);
    }
    
    // Always broadcast to all clients
    const broadcastMessage = {
        type: 'whatsapp',
        action: 'qrCode',
        data: { clientId, accountId, qrCode }
    };
    
    logger.debug(`Broadcasting QR code message: ${JSON.stringify(broadcastMessage).substring(0, 100)}...`);
    broadcast(broadcastMessage);
    logger.debug('QR code broadcast to all WebSocket clients');
}

/**
 * Send connection status to a client
 */
export function sendConnectionStatus(socket: WebSocket | null, clientId: string, accountId: string | null, status: string): void {
    // Send to specific client
    sendToClient(socket, {
        type: 'whatsapp',
        action: 'connectionStatus',
        data: { status }
    });
    
    // Broadcast to all clients
    broadcast({
        type: 'whatsapp',
        action: 'connectionStatus',
        data: { clientId, accountId, status }
    });
}

/**
 * Send phone information to a client
 */
export function sendPhoneInfo(socket: WebSocket | null, clientId: string, accountId: string | null, phoneNumber: string, pushName: string): void {
    // Send to specific client
    sendToClient(socket, {
        type: 'whatsapp',
        action: 'phoneInfo',
        data: { phoneNumber, pushName }
    });
    
    // Broadcast to all clients
    broadcast({
        type: 'whatsapp',
        action: 'phoneInfo',
        data: { clientId, accountId, phoneNumber, pushName }
    });
}

/**
 * Send an error message to a client
 */
export function sendError(socket: WebSocket | null, message: string): void {
    sendToClient(socket, {
        type: 'whatsapp',
        action: 'error',
        data: { message }
    });
}
