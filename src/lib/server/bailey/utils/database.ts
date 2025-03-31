import { getEnhancedPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * Get a Prisma client with admin privileges
 */
export function getAdminPrisma() {
    return getEnhancedPrisma({
        id: 'system',
        systemRole: 'ADMIN'
    });
}

/**
 * Update WhatsApp account status in the database
 */
export async function updateAccountStatus(accountId: string, status: string): Promise<boolean> {
    if (!accountId) {
        logger.warn('Cannot update WhatsApp account status: accountId is undefined or null');
        return false;
    }
    
    try {
        const prisma = getAdminPrisma();
        
        // First check if the account exists
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: accountId }
        });
        
        if (!account) {
            logger.warn(`Cannot update status: WhatsApp account ${accountId} not found`);
            return false;
        }
        
        await prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: { client_status: status }
        });
        
        logger.debug(`Updated WhatsApp account ${accountId} status to ${status}`);
        return true;
    } catch (error) {
        logger.error(`Failed to update WhatsApp account ${accountId} status`, { error });
        return false;
    }
}

/**
 * Update WhatsApp account client ID in the database
 */
export async function updateAccountClientId(accountId: string, clientId: string): Promise<boolean> {
    if (!accountId) {
        logger.warn('Cannot update WhatsApp account client ID: accountId is undefined or null');
        return false;
    }
    
    if (!clientId) {
        logger.warn(`Cannot update WhatsApp account ${accountId} client ID: clientId is undefined or null`);
        return false;
    }
    
    try {
        const prisma = getAdminPrisma();
        
        // First check if the account exists
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: accountId }
        });
        
        if (!account) {
            logger.warn(`Cannot update client ID: WhatsApp account ${accountId} not found`);
            return false;
        }
        
        await prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: { client_id: clientId }
        });
        
        logger.debug(`Updated WhatsApp account ${accountId} client ID to ${clientId}`);
        return true;
    } catch (error) {
        logger.error(`Failed to update WhatsApp account ${accountId} client ID`, { error });
        return false;
    }
}

/**
 * Get all WhatsApp accounts from the database
 */
export async function getAllWhatsAppAccounts() {
    try {
        const prisma = getAdminPrisma();
        return await prisma.whatsAppAccount.findMany();
    } catch (error) {
        logger.error('Failed to get WhatsApp accounts from database', { error });
        return [];
    }
}

/**
 * Get a WhatsApp account by ID
 */
export async function getWhatsAppAccount(accountId: string) {
    try {
        const prisma = getAdminPrisma();
        return await prisma.whatsAppAccount.findUnique({
            where: { id: accountId }
        });
    } catch (error) {
        logger.error(`Failed to get WhatsApp account ${accountId}`, { error });
        return null;
    }
}
