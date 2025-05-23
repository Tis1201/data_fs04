import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { listKeys, createKey, rotateKey } from '../service';

// Schema for creating a new key
const createKeySchema = z.object({
  keyType: z.literal('TOKEN'),
});

// Schema for rotating a key
const rotateKeySchema = z.object({
  keyId: z.string().min(1, 'Key ID is required'),
});

export const load = restrict(
  async ({ locals }) => {
    try {
      // Get all keys of type TOKEN
      const keys = await listKeys(locals.prisma, 'TOKEN');

      // Create empty forms
      const createForm = await superValidate(zod(createKeySchema), {
        id: 'token-create-form'
      });
      const rotateForm = await superValidate(zod(rotateKeySchema), {
        id: 'token-rotate-form'
      });

      return {
        keys,
        createForm,
        rotateForm,
        meta: {
          title: 'Token JWT Signing Keys',
          description: 'Manage token JWT signing keys'
        }
      };
    } catch (err) {
      logger.error('Error loading token JWT signing keys:', err);
      return {
        keys: [],
        createForm: await superValidate(zod(createKeySchema), {
          id: 'token-create-form'
        }),
        rotateForm: await superValidate(zod(rotateKeySchema), {
          id: 'token-rotate-form'
        }),
        error: {
          message: 'Failed to load token JWT signing keys',
          details: err instanceof Error ? err.message : String(err),
        },
        meta: {
          title: 'Token JWT Signing Keys',
          description: 'Manage token JWT signing keys'
        }
      };
    }
  },
  [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
  // Create a new key
  createKey: restrict(
    async ({ request, locals }) => {
      const form = await superValidate(request, zod(createKeySchema), {
        id: 'token-create-form'
      });

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
              message: `A token key already exists. Please use the rotate function instead.`,
            },
          });
        }

        // Create a new key
        const result = await createKey(locals.prisma, keyType, locals.user.id);
        
        if (!result.success) {
          logger.error('Failed to create token key:', result.error);
          return fail(400, {
            form,
            success: false,
            error: {
              message: result.error.message || 'Failed to create token key',
              details: result.error.details,
              code: result.error.code,
              meta: result.error.meta
            },
          });
        }

        // Return a success message with the key data
        logger.info(`Token key created successfully`);
        return message(
          form,
          createSuccessResponse(`Token key created successfully`, {
            details: `A new token key has been created.`,
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
      } catch (err) {
        logger.error('Error creating token JWT key:', err);
        return handleFormError({
          error: err,
          form,
          defaultMessage: 'An unexpected error occurred while creating the token key',
          prisma: locals.prisma,
          requestId: locals.requestId
        });
      }
    },
    [SystemRole.ADMIN]
  ),

  // Rotate an existing key
  rotateKey: restrict(
    async ({ request, locals }) => {
      logger.info('Rotate token key action called');
      const form = await superValidate(request, zod(rotateKeySchema), {
        id: 'token-rotate-form'
      });

      if (!form.valid) {
        logger.error('Form validation failed:', form.errors);
        return fail(400, { form });
      }

      try {
        const { keyId } = form.data;
        logger.info('Rotating token key with ID:', keyId);
        
        // Find the existing key to verify it exists
        const existingKey = await locals.prisma.jwtSigningKey.findUnique({
          where: { id: keyId }
        });
        
        if (!existingKey) {
          logger.error('Key not found with ID:', keyId);
          return fail(404, {
            form,
            success: false,
            error: {
              message: `Key not found. Please select a valid key to rotate.`,
            },
          });
        }
        
        if (existingKey.keyType !== 'TOKEN') {
          logger.error('Key is not a token key:', existingKey.keyType);
          return fail(400, {
            form,
            success: false,
            error: {
              message: `Selected key is not a token key.`,
            },
          });
        }
        
        logger.info('Found existing token key:', {
          id: existingKey.id,
          keyType: existingKey.keyType,
          isPrimary: existingKey.isPrimary
        });

        // Rotate the key using the ID directly from the form
        logger.info('Calling rotateKey service with keyId:', keyId);
        const result = await rotateKey(locals.prisma, keyId, locals.user.id);

        if (!result.success) {
          logger.error(`Failed to rotate token key: ${JSON.stringify(result.error)}`);
          return fail(400, {
            form,
            success: false,
            error: {
              message: result.error?.message || 'Failed to rotate token key',
              details: result.error?.details,
              code: result.error?.code || 'UNKNOWN_ERROR',
              meta: result.error?.meta
            },
          });
        }

        // Return a success message with the new key data
        logger.info(`Token key rotated successfully`);
        return message(
          form,
          createSuccessResponse(`Token key rotated successfully`, {
            details: `The token key has been rotated. The old key will remain active for a grace period.`,
            data: { 
              keyType: 'TOKEN',
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
      } catch (err) {
        logger.error('Error rotating token JWT key:', err);
        return handleFormError({
          error: err,
          form,
          defaultMessage: 'An unexpected error occurred while rotating the token key',
          prisma: locals.prisma,
          requestId: locals.requestId
        });
      }
    },
    [SystemRole.ADMIN]
  ),
};
