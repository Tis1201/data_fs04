import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { error } from '@sveltejs/kit';
import { createSuccessResponse, type ApiSuccessResponse } from '$lib/types/api';
import { restrict_api } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { handleApiError } from '$lib/server/errors/errorHandlers';
import { whatsAppAccountManager, WhatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import type { WhatsAppAccountClient } from '$lib/server/whatsapp/WhatsAppAccountClient';

interface WhatsAppMessageRequest {
  to: string;
  message: string;
  type?: 'text' | 'image' | 'document';
  caption?: string;
  filename?: string;
}

export const POST = restrict_api(async (event) => {
  const { request, locals, userInfo } = event;
  try {

   logger.debug(`User ${userInfo.email} is sending a WhatsApp message`);

    // Parse and validate request body
    let body: WhatsAppMessageRequest;
    
    try {
      body = await request.json();
    } catch (err) {
      logger.warn('Invalid JSON payload');
      throw error(400, 'Bad Request: Invalid JSON payload');
    }

    // Validate required fields
    const { to, message, type = 'text' } = body;
    
    if (!to || typeof to !== 'string') {
      throw error(400, 'Bad Request: "to" field is required and must be a string');
    }
    
    if (!message || typeof message !== 'string') {
      throw error(400, 'Bad Request: "message" field is required and must be a string');
    }

    // Validate message type
    const validTypes = ['text', 'image', 'document'];

    if (type && !validTypes.includes(type)) {
      throw error(400, `Bad Request: "type" must be one of: ${validTypes.join(', ')}`);
    }

    const account_id = event.params.id;

    const account = await locals.prisma.whatsAppAccount.findUnique({
      where: {
        id: account_id
      }
    })

    if (!account) {
      throw error(404, `Account not found: ${account_id}`);
    }

    // Log the message sending attempt
    logger.info(`User ${userInfo.email} using clientId: ${account.client_id},phone number: ${account.phoneNumber} to send ${type} message to ${to}`);

    const client:WhatsAppAccountClient | null = whatsAppAccountManager.getClient(account.client_id!);

    
    if(!client) {
      throw error(404, `Client not found for account: ${account_id}`);
    }

    const result = await client.sendTextMessage(to, message);
    
    
    // Create API success response directly
    const responseData: ApiSuccessResponse = {
      type: 'success',
      text: 'Message sent successfully',
      details: `Message sent to ${to}`,
      data: result,
      timestamp: new Date().toISOString()
    };
    
    // Log the successful message sending
    const messageId = result?.key?.id || 'unknown';
    logger.info(`Message from user ${userInfo.id} sent successfully to ${to} with ID: ${messageId}`);
    
    return json(responseData);

  } catch (err) {
    return handleApiError({
      error: err,
      defaultMessage: 'Failed to send WhatsApp message',
      action: 'send_whatsapp_message',
      prisma: locals.prisma
    });
  }
}, [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]);
