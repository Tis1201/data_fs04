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

// WhatsApp API limits
const WHATSAPP_MAX_MESSAGE_LENGTH = 4096; // characters for text messages
const WHATSAPP_MAX_MEDIA_SIZE_MB = 16; // 16MB is WhatsApp's limit for media
const WHATSAPP_MAX_MEDIA_SIZE_BYTES = WHATSAPP_MAX_MEDIA_SIZE_MB * 1024 * 1024;

// Supported MIME types for media messages
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/plain'
];

// Combined list of all supported MIME types
const SUPPORTED_MEDIA_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES
];

interface WhatsAppMessageRequest {
  to: string;
  message: string; // Can be text, URL, or base64 data URL
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
      // Limit request size to prevent DoS
      const contentLength = Number(request.headers.get('content-length') || '0');
      if (contentLength > WHATSAPP_MAX_MEDIA_SIZE_BYTES * 2) { // Allow some overhead for JSON structure
        throw error(413, `Payload too large. Maximum size is ${WHATSAPP_MAX_MEDIA_SIZE_MB}MB`);
      }
      
      body = await request.json();
      
      // Validate required fields and message type
      if (!body.to || !body.message) {
        throw error(400, 'Missing required fields: to and message are required');
      }

      // Validate message type if provided
      if (body.type && !['text', 'image', 'document'].includes(body.type)) {
        throw error(400, 'Invalid message type. Must be one of: text, image, document');
      }

      // Validate message length based on type
      const messageType = body.type || 'text';
      if (messageType === 'text' && body.message.length > WHATSAPP_MAX_MESSAGE_LENGTH) {
        throw error(400, `Text message too long. Maximum length is ${WHATSAPP_MAX_MESSAGE_LENGTH} characters`);
      }
      
      // For base64 data URLs, validate MIME type and size
      if (body.message.startsWith('data:')) {
        const [header, base64Data = ''] = body.message.split(',');
        const mimeMatch = header.match(/^data:(.+?)(;|$)/);
        const mimeType = mimeMatch?.[1] || '';
        
        // Validate MIME type if specified
        if (mimeType && body.type !== 'text') {
          if (body.type === 'image' && !SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
            throw error(400, `Unsupported image type: ${mimeType}. Supported types: ${SUPPORTED_IMAGE_TYPES.join(', ')}`);
          }
          if (body.type === 'document' && !SUPPORTED_DOCUMENT_TYPES.includes(mimeType)) {
            throw error(400, `Unsupported document type: ${mimeType}. Supported types: ${SUPPORTED_DOCUMENT_TYPES.join(', ')}`);
          }
        }
        
        // Validate size
        const sizeInBytes = Math.ceil(base64Data.length * 3 / 4); // Approximate base64 size
        if (sizeInBytes > WHATSAPP_MAX_MEDIA_SIZE_BYTES) {
          throw error(400, `Media too large. Maximum size is ${WHATSAPP_MAX_MEDIA_SIZE_MB}MB`);
        }
      }
      
    } catch (err: any) {
      if (err.status) throw err; // Re-throw our custom errors
      // logger.warn('Invalid request:', String(err));
      throw error(400, `Bad Request: Invalid request format: ${err}`);
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

    let result;
    
    // Handle different message types
    if (type === 'image') {
      result = await client.sendImageMessage(
        to, 
        message, // image URL
        body.caption || '',
        body.mimeType || 'image/jpeg'
      );
    } else {
      // Default to text message
      result = await client.sendTextMessage(to, message);
    }
    
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
