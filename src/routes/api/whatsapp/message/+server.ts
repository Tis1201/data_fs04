import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

const messageSchema = z.object({
  accountId: z.string(),
  to: z.string(),
  message: z.string()
});

/**
 * Format a phone number for WhatsApp according to Baileys requirements
 * @param phoneNumber The phone number to format
 * @returns The formatted phone number with @s.whatsapp.net suffix
 */
function formatPhoneNumber(phoneNumber: string): string {
  // If the number already has the WhatsApp suffix, return it as is
  if (phoneNumber.includes('@s.whatsapp.net')) {
    return phoneNumber;
  }
  
  // Remove any non-digit characters except the + sign at the beginning
  let formatted = phoneNumber.trim().replace(/[^\d+]/g, '');
  
  // Remove the + sign if it exists (Baileys handles this internally)
  if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  }
  
  // Append @s.whatsapp.net suffix which is required by Baileys
  formatted = formatted + '@s.whatsapp.net';
  
  logger.debug(`Formatted phone number from ${phoneNumber} to ${formatted}`);
  return formatted;
}

/**
 * Send a WhatsApp message
 */
// Restrict to admin users only
const postHandler = restrict(async ({ request, locals }) => {
    
    try {
        const body = await request.json();
        const result = messageSchema.safeParse(body);

        if (!result.success) {
          return json({ 
            success: false, 
            error: 'Invalid request data', 
            details: result.error.format() 
          }, { status: 400 });
        }

        const { accountId, to, message } = result.data;
        
        if (!accountId || !to || !message) {
            return json({ 
                success: false, 
                error: 'Missing required fields: accountId, to, message' 
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
        
        // Format the phone number for WhatsApp
        const formattedTo = formatPhoneNumber(to);
        logger.info(`Attempting to send WhatsApp message to ${to} via account ${accountId}`);
        
        // Get the client ID from the client
        const clientId = client.getId();
        
        try {
            // Use the properly formatted phone number
            const messageId = await client.sendTextMessage(formattedTo, message);
            
            return json({
                success: true,
                messageId
            });
        } catch (error) {
            logger.error(`Error sending WhatsApp message: ${error}`);
            return json({ 
                success: false, 
                error: `Error sending WhatsApp message: ${error.message || error}` 
            }, { status: 500 });
        }
        
        
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        return json({ 
            success: false, 
            error: 'Server error' 
        }, { status: 500 });
    }
});

export const POST: RequestHandler = postHandler;

/**
 * Get WhatsApp client status
 */
// Restrict to admin users only
const getHandler = restrict(async ({ url, locals }) => {
    
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
});

export const GET: RequestHandler = getHandler;
