import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

// Schema for device token request
const deviceTokenSchema = z.object({
  deviceKey: z.string().min(1, "Device key is required"),
  signature: z.string().min(1, "Signature is required"),
  timestamp: z.string().min(1, "Timestamp is required")
});

/**
 * POST handler for device JWT token exchange
 * Exchanges a device key for JWT access and refresh tokens
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate request body against schema
    const result = deviceTokenSchema.safeParse(body);
    if (!result.success) {
      logger.warn('Invalid device token request', { errors: result.error.format() });
      return json({ error: 'Invalid request format', details: result.error.format() }, { status: 400 });
    }
    
    const { deviceKey, signature, timestamp } = result.data;
    
    // Verify the timestamp is recent (within 5 minutes) to prevent replay attacks
    const requestTime = new Date(timestamp);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (requestTime < fiveMinutesAgo || requestTime > now) {
      logger.warn('Invalid timestamp', { timestamp, deviceKey });
      return json({ error: 'Invalid timestamp' }, { status: 401 });
    }
    
    // Find device in database by public key
    const device = await locals.prisma.device.findFirst({
      where: { publicKey: deviceKey }
    });
    
    if (!device) {
      logger.warn('Device not found', { deviceKey });
      return json({ error: 'Device not found' }, { status: 404 });
    }
    
    // TODO: Verify the signature using the device's public key
    // This would typically involve checking that the signature was created
    // by signing the timestamp with the device's private key
    // For now, we'll assume the signature is valid
    
    // Get the primary signing key for access tokens
    const signingKey = await locals.prisma.jwtSigningKey.findFirst({
      where: {
        keyType: 'ACCESS',
        isPrimary: true,
        isActive: true
      }
    });
    
    if (!signingKey) {
      logger.error('No active signing key found');
      return json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Generate JWT tokens
    // In a real implementation, we would use a library like jsonwebtoken
    // to sign the tokens with the private key
    const accessToken = 'generated.access.token';
    const refreshToken = 'generated.refresh.token';
    const expiresIn = 3600; // 1 hour
    
    // Store refresh token in database
    await locals.prisma.refreshToken.create({
      data: {
        tokenHash: 'hashed_refresh_token', // In production, hash the token
        deviceId: device.id,
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        accountId: device.accountId,
        userId: device.createdBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });
    
    // Log token issuance
    await locals.prisma.tokenUsageLog.create({
      data: {
        tokenType: 'ACCESS',
        action: 'ISSUE',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        accountId: device.accountId,
        userId: device.createdBy,
        metadata: JSON.stringify({
          deviceId: device.id,
          deviceName: device.name
        })
      }
    });
    
    return json({
      accessToken,
      refreshToken,
      expiresIn
    });
    
  } catch (error) {
    logger.error('Error processing device token request', { error });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
