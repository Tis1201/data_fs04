import { getClient, updateClient, removeClient } from '../store';
import { updateAccountClientId, getAdminPrisma } from '../utils/database';
import { sendPhoneInfo } from '../utils/websocket';
import { findClientIdDirectory } from '../utils/auth';
import { logger } from '$lib/server/logger';

/**
 * Handle WhatsApp authentication events
 * This is called when a user is authenticated with WhatsApp
 */
export async function handleAuthentication(clientId: string, sock: any): Promise<void> {
    // Get the latest client data
    const clientData = getClient(clientId);
    if (!clientData) {
        logger.warn(`Authentication event for unknown client ${clientId}`);
        return;
    }
    
    try {
        // Get the connected user's information
        const phoneNumber = sock.user?.id?.split(':')[0];
        const pushName = sock.user?.name || 'Unknown';
        
        if (!phoneNumber) {
            logger.warn(`No phone number found for authenticated client ${clientId}`);
            return;
        }
        
        logger.info(`WhatsApp authenticated for ${phoneNumber} (${pushName})`);
        
        // Log the full user object for debugging
        logger.debug('WhatsApp user object:', { 
            user: sock.user,
            clientId,
            accountId: clientData.accountId
        });
        
        // Update client data with phone info
        updateClient(clientId, { 
            phoneNumber, 
            pushName,
            state: 'authenticated'
        });
        
        // Find the correct client ID directory
        if (clientData.accountId) {
            const actualClientId = findClientIdDirectory(clientId);
            
            if (actualClientId && actualClientId !== clientId) {
                logger.info(`Updating client ID from ${clientId} to ${actualClientId}`);
                
                // Update the WhatsApp account with the actual client ID
                await updateAccountClientId(clientData.accountId, actualClientId);
                
                // Create a new client entry with the actual ID
                const updatedClientData = {...clientData, id: actualClientId};
                
                // Remove the old client entry
                removeClient(clientId);
                
                // Add the new client entry with the actual ID
                updateClient(actualClientId, updatedClientData);
                
                // Return the new client ID
                return;
            }
            
            // If client ID is already correct, just update the database
            await updateAccountClientId(clientData.accountId, clientId);
        }
        
        // Send phone info to clients
        logger.debug(`Sending phone info to clients for ${phoneNumber} (${pushName})`);
        sendPhoneInfo(
            clientData.socket, 
            clientId, 
            clientData.accountId, 
            phoneNumber, 
            pushName
        );
        
        // Update account in database with phone info if we have an account ID
        if (clientData.accountId) {
            try {
                const prisma = getAdminPrisma();
                await prisma.whatsAppAccount.update({
                    where: { id: clientData.accountId },
                    data: { 
                        phoneNumber,
                        name: pushName !== 'Unknown' ? pushName : undefined
                    }
                });
                logger.info(`Updated WhatsApp account ${clientData.accountId} with phone info`);
            } catch (dbError) {
                logger.error(`Failed to update WhatsApp account ${clientData.accountId} with phone info`, { error: dbError });
            }
        }
        
    } catch (error) {
        logger.error(`Error handling authentication for client ${clientId}`, { error });
    }
}
