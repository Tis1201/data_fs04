import baileys from '@whiskeysockets/baileys';
const { DisconnectReason } = baileys;
import { Boom } from '@hapi/boom';
import { getClient, updateClient } from '../store';
import { updateAccountStatus } from '../utils/database';
import { sendConnectionStatus, sendQrCode } from '../utils/websocket';
import { logger } from '$lib/server/logger';
import { startClient } from '../connection';

/**
 * Handle WhatsApp connection updates
 */
export function handleConnectionUpdate(update: any, clientId: string): void {
    const { connection, lastDisconnect, qr } = update;
    
    // Get the latest client data
    const clientData = getClient(clientId);
    if (!clientData) {
        logger.warn(`Connection update for unknown client ${clientId}`);
        return;
    }
    
    logger.debug(`Connection update for client ${clientId}: ${JSON.stringify(update)}`);
    
    // Handle QR code updates
    if (qr) {
        // Store the QR code
        updateClient(clientId, { qrCode: qr, state: 'connecting' });
        
        // Log QR code for debugging (first 20 chars)
        logger.info(`QR code generated for client ${clientId}: ${qr.substring(0, 20)}...`);
        
        // Send QR code to clients
        if (clientData.socket) {
            sendQrCode(clientData.socket, clientId, clientData.accountId, qr);
            logger.info(`QR code sent to WebSocket for client ${clientId}`);
        } else {
            logger.warn(`No WebSocket available to send QR code for client ${clientId}`);
        }
    }
    
    // Handle connection state changes
    if (connection) {
        let newState = clientData.state;
        
        switch (connection) {
            case 'connecting':
                newState = 'connecting';
                // Update database status
                if (clientData.accountId) {
                    updateAccountStatus(clientData.accountId, 'connecting');
                }
                logger.info(`Client ${clientId} connecting...`);
                break;
                
            case 'open':
                newState = 'authenticated';
                // Update database status
                if (clientData.accountId) {
                    updateAccountStatus(clientData.accountId, 'connected');
                }
                logger.info(`Client ${clientId} connected`);
                break;
                
            case 'close':
                newState = 'disconnected';
                
                // Update database status
                if (clientData.accountId) {
                    updateAccountStatus(clientData.accountId, 'disconnected');
                }
                
                // Check if we need to reconnect
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    // Attempt to reconnect
                    logger.info(`Reconnecting WhatsApp client ${clientId}...`);
                    // Use setTimeout to avoid immediate reconnection
                    setTimeout(() => {
                        startClient(clientId)
                            .catch(error => logger.error(`Failed to reconnect client ${clientId}`, { error }));
                    }, 3000);
                } else {
                    logger.info(`WhatsApp client ${clientId} logged out`);
                }
                break;
        }
        
        // Update client state
        updateClient(clientId, { state: newState });
        
        // Notify clients of the state change
        sendConnectionStatus(clientData.socket, clientId, clientData.accountId, newState);
    }
}
