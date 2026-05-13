import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import { rotateKey } from '../../../../../../admin/jwt/signing_keys/service';

// Schema for rotating a key
const rotateKeySchema = z.object({
	keyId: z.string().min(1, 'Key ID is required')
});

/**
 * POST /api/v2/admin/jwt/signing-keys/rotate
 * Rotate a JWT signing key (Admin only)
 * Creates a new key and marks the old one as inactive
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ context }) => {
		const { request, prisma, session } = context;
		
		logger.info('[JWTKeys] Rotate JWT signing key API called');
		
		const data = await request.json();
		
		// Validate the request data
		const validationResult = rotateKeySchema.safeParse(data);
		
		if (!validationResult.success) {
			logger.error('[JWTKeys] Invalid request data:', validationResult.error);
			return {
				success: false,
				error: {
					code: ErrorCodes.INVALID_INPUT,
					message: 'Invalid request data',
					details: validationResult.error.format()
				}
			};
		}
		
		const { keyId } = validationResult.data;
		
		// Find the existing key to verify it exists
		const existingKey = await prisma.jwtSigningKey.findUnique({
			where: { id: keyId }
		});
		
		if (!existingKey) {
			return {
				success: false,
				error: {
					code: ErrorCodes.NOT_FOUND,
					message: 'Key not found'
				}
			};
		}
		
		// Rotate the key
		const keyResult = await rotateKey(
			prisma,
			keyId,
			session.user.id
		);
		
		if (!keyResult.success || !keyResult.key) {
			return {
				success: false,
				error: {
					code: ErrorCodes.INTERNAL_ERROR,
					message: keyResult.error?.message || 'Failed to rotate key'
				}
			};
		}
		
		return {
			success: true,
			data: {
				message: 'Key rotated successfully',
				oldKeyId: keyId,
				newKey: {
					id: keyResult.key.id,
					keyType: keyResult.key.keyType,
					algorithm: keyResult.key.algorithm,
					isActive: keyResult.key.isActive,
					isPrimary: keyResult.key.isPrimary,
					createdAt: keyResult.key.createdAt,
					updatedAt: keyResult.key.updatedAt
				}
			}
		};
	},
	{ permission: 'admin.jwtKeys' }
);

