import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { listKeys, createKey, rotateKey } from './service';

// Schema for creating a new key
const createKeySchema = z.object({
  keyType: z.enum(['FACTORY', 'TOKEN', 'LINK']),
});

// Schema for rotating a key
const rotateKeySchema = z.object({
  keyId: z.string().min(1, 'Key ID is required'),
});

export const load = restrict(
  async (event: AuthenticatedLoadEvent) => {
    const { locals } = event;
    try {
      // Get all keys
      const keys = await listKeys(locals.prisma);

      // Create empty forms
      const form = await superValidate(zod(createKeySchema));
      const rotateForm = await superValidate(zod(rotateKeySchema));

      return {
        keys,
        form,
        rotateForm,
        meta: {
          title: 'JWT Signing Keys',
          description: 'Manage JWT signing keys for factory, tokens, and links'
        }
      };
    } catch (error) {
      logger.error('Error loading JWT signing keys', { error });
      return {
        keys: [],
        form: await superValidate(zod(createKeySchema)),
        rotateForm: await superValidate(zod(rotateKeySchema)),
        error: {
          message: 'Failed to load JWT signing keys',
          details: error instanceof Error ? error.message : String(error),
        },
        meta: {
          title: 'JWT Signing Keys',
          description: 'Manage JWT signing keys for factory, tokens, and links'
        }
      };
    }
  },
  [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
  // Create a new key
  createKey: restrict(
    async (event: AuthenticatedEvent) => {
      const { request, locals } = event;
      const form = await superValidate(request, zod(createKeySchema));

      if (!form.valid) {
        return fail(400, { form });
      }

      try {
        const { keyType } = form.data;
        
        // Check if a key of this type already exists
        const existingKeys = await locals.prisma.jwtSigningKey.findMany({
          where: { keyType }
        });
        
        if (existingKeys.length > 0) {
          return fail(400, {
            form,
            success: false,
            error: {
              message: `A ${keyType.toLowerCase()} key already exists. Please use the rotate function instead.`,
            },
          });
        }

        // Create a new key
        if (!locals.user) {
          return fail(401, { form, error: { message: 'Unauthorized' } });
        }

        const result = await createKey(locals.prisma, keyType, locals.user.id);
        
        if (!result.success) {
          logger.error('Failed to create key', { error: result.error });
          const errorData = result.error as any;
          return fail(400, {
            form,
            success: false,
            error: {
              message: result.error?.message || 'Failed to create key',
              details: errorData?.details,
              code: result.error?.code,
              meta: errorData?.meta
            },
          });
        }

        // Return a success message with the key data
        logger.info(`${keyType} key created successfully`);
        return message(
          form,
          createSuccessResponse(`${keyType} key created successfully`, {
            details: `A new ${keyType.toLowerCase()} key has been created.`,
            data: { 
              keyType,
              key: result.key ? {
                id: result.key.id,
                keyId: result.key.keyId,
                keyType: result.key.keyType,
                algorithm: result.key.algorithm,
                isActive: result.key.isActive,
                isPrimary: result.key.isPrimary,
                createdAt: result.key.createdAt,
                updatedAt: result.key.updatedAt,
                rotatedAt: result.key.rotatedAt,
                expiresAt: result.key.expiresAt
              } : undefined
            }
          })
        );
      } catch (error) {
        logger.error('Error creating JWT key', { error });
        return handleFormError({
          error,
          form,
          defaultMessage: 'An unexpected error occurred while creating the key',
          prisma: locals.prisma,
          requestId: locals.requestId
        });
      }
    },
    [SystemRole.ADMIN]
  ),

  // Rotate an existing key
  rotateKey: restrict(
    async (event: AuthenticatedEvent) => {
      const { request, locals } = event;
      logger.info('Rotate key action called');
      const form = await superValidate(request, zod(rotateKeySchema));
      logger.info('Form data:', form.data);

      if (!form.valid) {
        logger.error('Form validation failed:', form.errors);
        return fail(400, { form });
      }

      try {
        const { keyId } = form.data;
        logger.info('Rotating key with ID', { keyId });
        
        // Find the existing key to verify it exists
        const existingKey = await locals.prisma.jwtSigningKey.findUnique({
          where: { id: keyId }
        });
        
        if (!existingKey) {
          logger.error('Key not found with ID', { keyId });
          return fail(404, {
            form,
            success: false,
            error: {
              message: `Key not found. Please select a valid key to rotate.`,
            },
          });
        }
        
        logger.info('Found existing key', {
          id: existingKey.id,
          keyType: existingKey.keyType,
          isPrimary: existingKey.isPrimary
        });

        // Rotate the key using the ID directly from the form
        logger.info('Calling rotateKey service with keyId', { keyId });
        if (!locals.user) {
          return fail(401, { form, error: { message: 'Unauthorized' } });
        }
        const result = await rotateKey(locals.prisma, keyId, locals.user.id);

        if (!result.success) {
          logger.error('Failed to rotate key', { error: result.error });
          const errorData = result.error as any;
          return fail(400, {
            form,
            success: false,
            error: {
              message: result.error?.message || 'Failed to rotate key',
              details: errorData?.details,
              code: result.error?.code || 'UNKNOWN_ERROR',
              meta: errorData?.meta
            },
          });
        }

        // Return a success message with the new key data
        logger.info(`${existingKey.keyType} key rotated successfully`);
        return message(
          form,
          createSuccessResponse(`${existingKey.keyType} key rotated successfully`, {
            details: `The ${existingKey.keyType.toLowerCase()} key has been rotated successfully.`,
            data: { 
              keyType: existingKey.keyType, 
              keyId,
              newKey: result.key ? {
                id: result.key.id,
                keyId: result.key.keyId,
                keyType: result.key.keyType,
                algorithm: result.key.algorithm,
                isActive: result.key.isActive,
                isPrimary: result.key.isPrimary,
                createdAt: result.key.createdAt,
                updatedAt: result.key.updatedAt,
                rotatedAt: result.key.rotatedAt,
                expiresAt: result.key.expiresAt
              } : undefined
            }
          })
        );
      } catch (error) {
        logger.error('Error rotating JWT key', { error });
        return handleFormError({
          error,
          form,
          defaultMessage: 'An unexpected error occurred while rotating the key',
          prisma: locals.prisma,
          requestId: locals.requestId
        });
      }
    },
    [SystemRole.ADMIN]
  ),
};
