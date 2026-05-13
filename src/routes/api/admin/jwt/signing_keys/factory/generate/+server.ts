import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export const POST: RequestHandler = restrict(async ({ request, locals }: AuthenticatedEvent) => {
  try {
    const form = await request.formData();
    const keyId = String(form.get('keyId') || '');
    const aud = String(form.get('aud') || 'device-register');
    const typ = String(form.get('typ') || 'factory');
    const ttlSec = parseInt(String(form.get('ttl') || '900'), 10);

    if (!keyId) {
      return new Response(JSON.stringify({ error: 'keyId is required' }), { status: 400 });
    }

    const key = await locals.prisma.jwtSigningKey.findUnique({ where: { id: keyId } });

    if (!key || !key.isActive || key.keyType !== 'FACTORY') {
      return new Response(JSON.stringify({ error: 'Invalid or inactive factory key' }), { status: 400 });
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

    const filename = `factory-token-${key.keyId}-${jti}.jwt`;
    return new Response(token, {
      status: 200,
      headers: {
        'Content-Type': 'application/jwt',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (err) {
    logger.error(`Error generating factory JWT: ${err instanceof Error ? err.message : String(err)}`);
    return new Response(JSON.stringify({ error: 'Failed to generate JWT' }), { status: 500 });
  }
}, [SystemRole.ADMIN]);
