import { getClient, updateClient } from './store';
import { logger } from '$lib/server/logger';

/**
 * Send a WhatsApp message
 */
export async function sendWhatsAppMessage(clientId: string, to: string, message: string): Promise<boolean> {
    const clientData = getClient(clientId);
    if (!clientData || !clientData.client) {
        logger.error(`Cannot send message: Client ${clientId} not found or not initialized`);
        return false;
    }
    
    try {
        // Format the recipient number
        const recipient = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        
        // Send the message
        await clientData.client.sendMessage(recipient, { text: message });
        
        logger.debug(`Message sent to ${to}: ${message}`);
        return true;
    } catch (error) {
        logger.error(`Failed to send WhatsApp message to ${to}:`, { error });
        return false;
    }
}

/**
 * Generate a pairing code for a WhatsApp client
 */
export async function generatePairingCode(clientId: string, phoneNumber: string): Promise<string | null> {
    const clientData = getClient(clientId);
    if (!clientData || !clientData.client) {
        logger.error(`Cannot generate pairing code: Client ${clientId} not found or not initialized`);
        return null;
    }
    
    try {
        // Request pairing code from WhatsApp
        const pairingCode = await clientData.client.requestPairingCode(phoneNumber);
        
        // Store the pairing code
        updateClient(clientId, { pairingCode });
        
        // Send pairing code to the client
        if (clientData.socket) {
            clientData.socket.send(JSON.stringify({
                type: 'whatsapp',
                action: 'pairingCode',
                data: {
                    code: pairingCode
                }
            }));
        }
        
        logger.info(`Generated pairing code for client ${clientId}: ${pairingCode}`);
        return pairingCode;
    } catch (error) {
        logger.error(`Failed to generate pairing code for client ${clientId}:`, { error });
        return null;
    }
}
