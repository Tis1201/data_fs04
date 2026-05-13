import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

/**
 * POST /api/v2/admin/jwt/signing-keys/factory/generate
 * Generate a factory JWT token (Admin only)
 * Used for device registration and factory provisioning
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ context }) => {
		const { request, prisma } = context;
		
		const data = await request.json();
		const keyId = String(data.keyId || '');
		const aud = String(data.aud || 'device-register');
		const typ = String(data.typ || 'factory');
		const ttlSec = parseInt(String(data.ttl || '900'), 10);

		if (!keyId) {
			return {
				success: false,
				error: {
					code: ErrorCodes.INVALID_INPUT,
					message: 'keyId is required'
				}
			};
		}

		const key = await prisma.jwtSigningKey.findUnique({ where: { id: keyId } });

		if (!key || !key.isActive || key.keyType !== 'FACTORY') {
			return {
				success: false,
				error: {
					code: ErrorCodes.INVALID_INPUT,
					message: 'Invalid or inactive factory key'
				}
			};
		}

		const now = Math.floor(Date.now() / 1000);
		const exp = now + Math.max(60, Math.min(ttlSec, 24 * 60 * 60));
		const jti = randomUUID();
		const payload: Record<string, unknown> = {
			aud,
			typ,
			iat: now,
			exp,
			jti,
			scope: 'device:register'
		};

		const token = jwt.sign(payload, key.privateKey, {
			algorithm: 'RS256',
			keyid: key.keyId
		});

		return {
			success: true,
			data: {
				token,
				jti,
				exp,
				expiresIn: exp - now
			}
		};
	},
	{ permission: 'admin.jwtKeys' }
);

