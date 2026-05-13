import jwt from 'jsonwebtoken';
import { logger } from '$lib/server/logger';

export type JwtHeader = { alg?: string; kid?: string; [k: string]: unknown };
export type JwtClaims = Record<string, unknown>;

export function getBearerTokenFromRequest(request: Request): string {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header (expected Bearer token)');
    throw new Response(JSON.stringify({ error: 'Missing Authorization Bearer token' }), { status: 400 });
  }
  return auth.slice('Bearer '.length).trim();
}

export function decodeJwtComplete(token: string): { header: JwtHeader; payload: JwtClaims } {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded !== 'object' || !decoded.header || !decoded.payload) {
    logger.warn('Unable to decode JWT');
    throw new Response(JSON.stringify({ error: 'Invalid JWT' }), { status: 400 });
  }
  return { header: decoded.header as JwtHeader, payload: decoded.payload as JwtClaims };
}

export function logJwtDecoded(label: string, header: JwtHeader, claims: JwtClaims): void {
  logger.debug(`${label} header: ${JSON.stringify({ alg: header.alg, kid: header.kid })}`);
  logger.debug(`${label} claims: ${JSON.stringify(claims)}`);
}

/**
 * Convenience: extract, decode and log from a Request in one call.
 */
export function extractAndDecodeJwtFromRequest(request: Request, label = 'JWT'): {
  token: string;
  header: JwtHeader;
  claims: JwtClaims;
} {
  const token = getBearerTokenFromRequest(request);
  const { header, payload } = decodeJwtComplete(token);
  logJwtDecoded(label, header, payload);
  return { token, header, claims: payload };
}