import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../../../admin/users/schema';
import { logger } from '$lib/server/logger';
import { rotateKey } from '../../../../../admin/jwt/signing_keys/service';

// Schema for rotating a key
const rotateKeySchema = z.object({
  keyId: z.string().min(1, 'Key ID is required')
});

export const POST = restrict(
  async ({ request, locals }) => {
    logger.info('Rotate JWT signing key API called');
    
    try {
      const data = await request.json();
      
      // Validate the request data
      const validationResult = rotateKeySchema.safeParse(data);
      
      if (!validationResult.success) {
        logger.error('Invalid request data:', validationResult.error);
        return json({ 
          success: false, 
          message: 'Invalid request data', 
          errors: validationResult.error.format() 
        }, { status: 400 });
      }
      
      const { keyId } = validationResult.data;
      
      // Find the existing key to verify it exists
      const existingKey = await locals.prisma.jwtSigningKey.findUnique({
        where: { id: keyId }
      });
      
      if (!existingKey) {
        return json({
          success: false,
          message: 'Key not found'
        }, { status: 404 });
      }
      
      // Rotate the key
      const keyResult = await rotateKey(
        locals.prisma,
        keyId,
        locals.user?.id || 'system'
      );
      
      if (!keyResult.success) {
        return json({
          success: false,
          message: keyResult.error || 'Failed to rotate key'
        }, { status: 500 });
      }
      
      return json({
        success: true,
        message: `${existingKey.keyType.toLowerCase()} key rotated successfully`,
        key: {
          id: keyResult.key.id,
          keyType: keyResult.key.keyType,
          algorithm: keyResult.key.algorithm,
          isActive: keyResult.key.isActive,
          isPrimary: keyResult.key.isPrimary,
          createdAt: keyResult.key.createdAt,
          updatedAt: keyResult.key.updatedAt,
          rotatedAt: keyResult.key.rotatedAt,
          expiresAt: keyResult.key.expiresAt
        }
      });
    } catch (err) {
      logger.error('Error rotating JWT signing key:', err);
      return json({
        success: false,
        message: 'An unexpected error occurred while rotating the key',
        error: err instanceof Error ? err.message : String(err)
      }, { status: 500 });
    }
  },
  [SystemRole.ADMIN]
);
