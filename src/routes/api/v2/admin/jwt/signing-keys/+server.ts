import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import { createKey } from '../../../../../admin/jwt/signing_keys/service';

// Schema for creating a new key
const createKeySchema = z.object({
	keyType: z.enum(['FACTORY', 'LINK', 'TOKEN'], { 
		required_error: 'Key type is required',
		invalid_type_error: 'Key type must be one of: FACTORY, LINK, TOKEN'
	})
});

/**
 * POST /api/v2/admin/jwt/signing-keys
 * Create a new JWT signing key (Admin only)
 * Used to generate factory, link, or token signing keys
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ context }) => {
		const { request, prisma, session } = context;
		
		logger.info('[JWTKeys] Create JWT signing key API called');
		
		const data = await request.json();
		
		// Validate the request data
		const validationResult = createKeySchema.safeParse(data);
		
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
		
		const { keyType } = validationResult.data;
		
		// Check if a key of this type already exists
		const existingKeys = await prisma.jwtSigningKey.findMany({
			where: { keyType }
		});
		
		if (existingKeys.length > 0) {
			return {
				success: false,
				error: {
					code: ErrorCodes.CONFLICT,
					message: `A ${keyType.toLowerCase()} key already exists. Please use the rotate function instead.`
				}
			};
		}
		
		// Create the key
		const keyResult = await createKey(
			prisma,
			keyType,
			session.user.id
		);
		
		if (!keyResult.success || !keyResult.key) {
			return {
				success: false,
				error: {
					code: ErrorCodes.INTERNAL_ERROR,
					message: keyResult.error?.message || 'Failed to create key'
				}
			};
		}
		
		return {
			success: true,
			data: {
				message: `${keyType.toLowerCase()} key created successfully`,
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
			}
		};
	},
	{ permission: 'admin.jwtKeys' }
);

