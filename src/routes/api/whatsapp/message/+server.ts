import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWhatsAppClient, sendWhatsAppMessage } from '$lib/server/bailey/client';

/**
 * Send a WhatsApp message
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    // Validate authentication
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        return json({ success: false, error: 'Not authorized' }, { status: 403 });
    }
    
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
        const client = getWhatsAppClient(clientId);
        if (!client) {
            return json({ 
                success: false, 
                error: `WhatsApp client ${clientId} not found` 
            }, { status: 404 });
        }
        
        // Send the message
        const success = await sendWhatsAppMessage(clientId, to, message);
        
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
export const GET: RequestHandler = async ({ url, locals }) => {
    // Validate authentication
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        return json({ success: false, error: 'Not authorized' }, { status: 403 });
    }
    
    try {
        const clientId = url.searchParams.get('clientId');
        
        if (!clientId) {
            return json({ 
                success: false, 
                error: 'Missing required parameter: clientId' 
            }, { status: 400 });
        }
        
        // Check if client exists and get its state
        const client = getWhatsAppClient(clientId);
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
