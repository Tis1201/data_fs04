import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';

/**
 * Get WhatsApp message history for a specific contact
 */
// Restrict to admin users only
const handler = restrict(async ({ url, locals }) => {
    try {
        const accountId = url.searchParams.get('accountId');
        const contact = url.searchParams.get('contact');
        
        if (!accountId || !contact) {
            return json({ 
                success: false, 
                error: 'Missing required parameters: accountId, contact' 
            }, { status: 400 });
        }
        
        // Check if client exists by account ID
        const client = whatsAppAccountManager.getClientByAccountId(accountId);
        if (!client) {
            // Log all available clients for debugging
            const clients = whatsAppAccountManager.getAllClients();
            logger.debug(`Available WhatsApp clients:`);
            for(const c of clients){
                logger.debug(`- clientId: ${c.getId()}, accountId: ${c.getAccountId()}`);
            }
            
            return json({ 
                success: false, 
                error: `WhatsApp account ${accountId} not found or not connected` 
            }, { status: 404 });
        }
        
        // For now, return mock data since we don't have actual message history storage
        // In a real implementation, you would fetch this from your database
        const mockMessages = [
            {
                id: '1',
                direction: 'outgoing',
                content: 'Hello, this is a test message.',
                timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                status: 'delivered'
            },
            {
                id: '2',
                direction: 'incoming',
                content: 'Hi there! I received your test message.',
                timestamp: new Date(Date.now() - 3000000).toISOString(), // 50 minutes ago
                status: 'read'
            },
            {
                id: '3',
                direction: 'outgoing',
                content: 'Great! How are you doing today?',
                timestamp: new Date(Date.now() - 2400000).toISOString(), // 40 minutes ago
                status: 'delivered'
            },
            {
                id: '4',
                direction: 'incoming',
                content: 'I\'m doing well, thank you for asking! How about you?',
                timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
                status: 'read'
            }
        ];
        
        return json({ 
            success: true, 
            messages: mockMessages
        });
    } catch (error) {
        console.error('Error getting WhatsApp message history:', error);
        return json({ 
            success: false, 
            error: 'Server error' 
        }, { status: 500 });
    }
});

export const GET: RequestHandler = handler;
