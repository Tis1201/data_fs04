import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';

// Schema for API key creation
const apiKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  expiresAt: z.date().optional().nullable()
});

export const load = restrict(
    async ({ request, locals, auth }:any) => {
    try {
      // Get the current user's API keys
      const apiKeys = await locals.prisma.apiKey.findMany({
        where: {
          userId: auth.user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          createdAt: true,
          expiresAt: true,
          lastUsedAt: true,
          key: true
        }
      });
      
      // Mask the API keys for security
      const maskedApiKeys = apiKeys.map(key => ({
        ...key,
        key: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`
      }));
      
      // Create an empty form for API key creation
      const form = await superValidate(zod(apiKeySchema));
      
            return {
        apiKeys: maskedApiKeys,
        form,
        meta: {
          title: 'User Profile',
          description: 'Manage your profile and API keys'
        }
      };
    } catch (err) {
      logger.error(`Error loading API keys: ${JSON.stringify(err)}`);
      throw error(500, {
        message: 'Failed to load API keys',
        code: 'API_KEYS_LOAD_ERROR',
        details: 'An error occurred while loading your API keys. Please try again later.'
      });
    }
  }, [SystemRole.USER]
);

export const actions: Actions = {
  createApiKey: restrict(
    async ({ request, locals, auth }) => {
      // Validate the form data
      const form = await superValidate(request, zod(apiKeySchema));
      
      if (!form.valid) {
        return fail(400, { form });
      }
      
      try {
        // Validate authentication
        if (!auth?.user) {
          throw new FormValidationError(
            'You must be logged in to create an API key',
            'AUTH_REQUIRED',
            401
          );
        }
        
        // Generate a random API key
        const key = randomBytes(32).toString('hex');
        
        // Create the API key
        const apiKey = await locals.prisma.apiKey.create({
          data: {
            name: form.data.name,
            description: form.data.description || undefined,
            key,
            expiresAt: form.data.expiresAt || undefined,
            userId: auth.user.id
          }
        });
        
        // Return success with the full API key (only time it's shown in full)
        return message(
          form,
          createSuccessResponse('API key created successfully!', {
            details: 'Make sure to copy your API key now. For security reasons, it will not be displayed again.',
            data: {
              id: apiKey.id,
              name: apiKey.name,
              key: apiKey.key
            }
          })
        );
      } catch (err) {
        return handleFormError({
          error: err,
          form,
          prisma: locals.prisma,
          defaultMessage: 'Failed to create API key.',
          action: 'API key creation'
        });
      }
    }, [SystemRole.USER]
  ),
  
  toggleApiKey: restrict(
    async ({ request, locals, auth }) => {
      const data = await request.formData();
      const id = data.get('id')?.toString();
      
      if (!id) {
        return fail(400, { 
          error: 'API key ID is required',
          code: 'MISSING_API_KEY_ID'
        });
      }
      
      try {
        // Validate authentication
        if (!auth?.user) {
          throw new FormValidationError(
            'You must be logged in to manage API keys',
            'AUTH_REQUIRED',
            401
          );
        }
        
        // Get the API key
        const apiKey = await locals.prisma.apiKey.findUnique({
          where: { id }
        });
        
        if (!apiKey) {
          return fail(404, { 
            error: 'API key not found',
            code: 'API_KEY_NOT_FOUND'
          });
        }
        
        // Verify ownership
        if (apiKey.userId !== auth.user.id) {
          return fail(403, { 
            error: 'You do not have permission to manage this API key',
            code: 'UNAUTHORIZED_ACCESS'
          });
        }
        
        // Toggle the active status
        const updatedApiKey = await locals.prisma.apiKey.update({
          where: { id },
          data: { active: !apiKey.active }
        });
        
        return createSuccessResponse(`API key ${updatedApiKey.active ? 'activated' : 'deactivated'} successfully`, {
          details: `API key '${updatedApiKey.name}' has been ${updatedApiKey.active ? 'activated' : 'deactivated'}.`,
          data: {
            id: updatedApiKey.id,
            active: updatedApiKey.active
          }
        });
      } catch (err) {
        logger.error(`Error toggling API key: ${JSON.stringify(err)}`);
        return fail(500, { 
          error: 'Failed to update API key',
          code: 'API_KEY_UPDATE_ERROR'
        });
      }
    }
  ),
  
  deleteApiKey: restrict(
    async ({ request, locals, auth }) => {
      const data = await request.formData();
      const id = data.get('id')?.toString();
      
      if (!id) {
        return fail(400, { 
          error: 'API key ID is required',
          code: 'MISSING_API_KEY_ID'
        });
      }
      
      try {
        // Validate authentication
        if (!auth?.user) {
          throw new FormValidationError(
            'You must be logged in to delete API keys',
            'AUTH_REQUIRED',
            401
          );
        }
        
        // Get the API key
        const apiKey = await locals.prisma.apiKey.findUnique({
          where: { id }
        });
        
        if (!apiKey) {
          return fail(404, { 
            error: 'API key not found',
            code: 'API_KEY_NOT_FOUND'
          });
        }
        
        // Verify ownership
        if (apiKey.userId !== auth.user.id) {
          return fail(403, { 
            error: 'You do not have permission to delete this API key',
            code: 'UNAUTHORIZED_ACCESS'
          });
        }
        
        // Delete the API key
        await locals.prisma.apiKey.delete({
          where: { id }
        });
        
        return createSuccessResponse('API key deleted successfully', {
          details: `API key '${apiKey.name}' has been deleted.`,
          data: {
            id: apiKey.id
          }
        });
      } catch (err) {
        logger.error(`Error deleting API key: ${JSON.stringify(err)}`);
        return fail(500, { 
          error: 'Failed to delete API key',
          code: 'API_KEY_DELETE_ERROR'
        });
      }
    }, [SystemRole.USER]
  )
};
