import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createKey } from '../../../../../admin/jwt/signing_keys/service';

// Schema for creating a new key
const createKeySchema = z.object({
  keyType: z.enum(['FACTORY', 'LINK', 'TOKEN'], { 
    required_error: 'Key type is required',
    invalid_type_error: 'Key type must be one of: FACTORY, LINK, TOKEN'
  })
});

export const POST = restrict(
  async ({ request, locals }: AuthenticatedEvent) => {
    logger.info('Create JWT signing key API called');
    
    try {
      const data = await request.json();
      
      // Validate the request data
      const validationResult = createKeySchema.safeParse(data);
      
      if (!validationResult.success) {
        logger.error('Invalid request data:', validationResult.error);
        return json({ 
          success: false, 
          message: 'Invalid request data', 
          errors: validationResult.error.format() 
        }, { status: 400 });
      }
      
      const { keyType } = validationResult.data;
      
      // Check if a key of this type already exists
      const existingKeys = await locals.prisma.jwtSigningKey.findMany({
        where: { keyType }
      });
      
      if (existingKeys.length > 0) {
        return json({
          success: false,
          message: `A ${keyType.toLowerCase()} key already exists. Please use the rotate function instead.`
        }, { status: 400 });
      }
      
      // Create the key
      const keyResult = await createKey(
        locals.prisma,
        keyType,
        locals.user?.id || 'system'
      );
      
      if (!keyResult.success) {
        return json({
          success: false,
          message: keyResult.error || 'Failed to create key'
        }, { status: 500 });
      }
      
      const key = keyResult.key!;
      
      return json({
        success: true,
        message: `${keyType.toLowerCase()} key created successfully`,
        key: {
          id: key.id,
          keyType: key.keyType,
          algorithm: key.algorithm,
          isActive: key.isActive,
          isPrimary: key.isPrimary,
          createdAt: key.createdAt,
          updatedAt: key.updatedAt,
          rotatedAt: key.rotatedAt,
          expiresAt: key.expiresAt
        }
      });
    } catch (err) {
      logger.error('Error creating JWT signing key:', { error: err });
      return json({
        success: false,
        message: 'An unexpected error occurred while creating the key',
        error: err instanceof Error ? err.message : String(err)
      }, { status: 500 });
    }
  },
  [SystemRole.ADMIN]
);
