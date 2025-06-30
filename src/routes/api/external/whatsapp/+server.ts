import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { createSuccessResponse } from '$lib/types/api';
import { restrict, restrict_api } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { handleApiError } from '$lib/server/errors/errorHandlers';
import type { ApiSuccessResponse } from '$lib/types/api';

/**
 * POST /api/whatsapp
 * 
 * Sends a WhatsApp message using the specified client ID and recipient
 * 
 * Request body:
 * {
 *   clientId: string;   // WhatsApp client ID
 *   recipient: string;  // Phone number in international format (e.g., "+1234567890")
 *   message: string;    // Message text to send
 * }
 */
export const POST = restrict_api(async ({ request, locals, auth }) => {
    try {
        const userInfo = auth.user;
        logger.debug(`User ${userInfo.id} is sending a WhatsApp message`);

        // Parse and validate request body
        let body;
        
        try {
            body = await request.json();
        } catch (err) {
            logger.warn('Invalid JSON payload');
            throw error(400, 'Bad Request: Invalid JSON payload');
        }

        const { clientId, recipient, message } = body;

        // Validate required fields
        if (!clientId || typeof clientId !== 'string') {
            throw error(400, 'Bad Request: clientId is required and must be a string');
        }
        if (!recipient || typeof recipient !== 'string') {
            throw error(400, 'Bad Request: recipient is required and must be a string');
        }
        if (!message || typeof message !== 'string') {
            throw error(400, 'Bad Request: message is required and must be a string');
        }

        // Log the message sending attempt
        logger.info(`Sending WhatsApp message to ${recipient} via client ${clientId}`);

        // TODO: Implement actual WhatsApp message sending logic
        // This is a placeholder - replace with your actual implementation
        // const result = await whatsAppService.sendMessage(clientId, recipient, message);
        
        // For now, simulate a successful response
        const messageId = `wa-${Date.now()}`;
        const timestamp = new Date().toISOString();

        // Return success response with message ID and status
        const response = createSuccessResponse('Message sent', {
            data: { messageId, status: 'sent', timestamp }
        });
        
        return response;

    } catch (error: unknown) {
        return handleApiError({
            error,
            defaultMessage: 'Failed to send WhatsApp message',
            action: 'send_whatsapp_message',
            prisma: locals.prisma
        });
    }
});
