import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { apiGuard } from '$lib/server/security/api-guard';

/**
 * Send a WhatsApp message
 */
export const POST: RequestHandler = apiGuard(['ADMIN'], async ({ request, locals }) => {
    
    try {
        const body = await request.json();
        const { clientId, to, message } = body;
        
        if (!clientId || !to || !message) {
            return json({ 
                success: false, 
                error: 'Missing required fields: clientId, to, message' 
            }, { status: 400 });
        }
        
        // Check if client exists
        const client = whatsAppAccountManager.getClient(clientId);
        if (!client) {
            return json({ 
                success: false, 
                error: `WhatsApp client ${clientId} not found` 
            }, { status: 404 });
        }
        
        // Send the message
        const success = await client.sendTextMessage(to, message);
        
        if (success) {
            return json({ success: true, message: 'Message sent successfully' });
        } else {
            return json({ 
                success: false, 
                error: 'Failed to send message' 
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        return json({ 
            success: false, 
            error: 'Server error' 
        }, { status: 500 });
    }
};

/**
 * Get WhatsApp client status
 */
export const GET: RequestHandler = apiGuard(['ADMIN'], async ({ url, locals }) => {
    
    try {
        const clientId = url.searchParams.get('clientId');
        
        if (!clientId) {
            return json({ 
                success: false, 
                error: 'Missing required parameter: clientId' 
            }, { status: 400 });
        }
        
        // Check if client exists and get its state
        const client = whatsAppAccountManager.getClient(clientId);
        if (!client) {
            return json({ 
                success: false, 
                error: `WhatsApp client ${clientId} not found` 
            }, { status: 404 });
        }
        
        return json({ 
            success: true, 
            data: {
                clientId,
                state: client.state,
                phoneNumber: client.phoneNumber,
                hasQrCode: !!client.qrCode,
                accountId: client.accountId
            }
        });
    } catch (error) {
        console.error('Error getting WhatsApp client status:', error);
        return json({ 
            success: false, 
            error: 'Server error' 
        }, { status: 500 });
    }
};
