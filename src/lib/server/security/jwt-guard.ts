import { error, json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
import { getBearerTokenFromRequest } from '$lib/utils/JwtHelper';
import { getEnhancedPrisma } from '$lib/server/prisma';

/**
 * Type for JWT payload from device tokens
 */
export interface DeviceJWTPayload {
  deviceId: string;
  accountId: string;
  userId: string;
  deviceName?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  sub?: string;
}

/**
 * Type for authenticated event with JWT data
 */
export type JWTAuthenticatedEvent = RequestEvent & {
  auth: {
    user: UserInfo;
  };
  jwtPayload: DeviceJWTPayload;
  deviceId: string;
  accountId: string;
};

/**
 * Restricts access to a route using JWT Bearer token authentication
 * Validates JWT signature, expiration, and extracts user info
 * @param handler The route handler function to protect
 * @param allowedRoles Array of roles that are allowed to access the route
 * @returns A protected route handler that validates JWT
 */
export function restrictJWT(
  handler: (event: JWTAuthenticatedEvent) => Promise<Response>,
  allowedRoles: string[] = ['ADMIN', 'MEMBER', 'USER']
): RequestHandler {
  return async (event: RequestEvent): Promise<Response> => {
    const { request, locals } = event;

    try {
      // Extract Bearer token from Authorization header
      let token: string;
      try {
        token = getBearerTokenFromRequest(request);
      } catch (err) {
        logger.warn('Failed to extract Bearer token', {
          error: err instanceof Error ? err.message : String(err)
        });
        return json(
          { 
            success: false,
            error: 'Missing or invalid Authorization header',
            message: 'Authorization header must be in format: Bearer <token>' 
          },
          { status: 401 }
        );
      }

      // Decode the JWT header to get the key ID (kid)
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        logger.warn('JWT missing kid in header');
        return json(
          { 
            success: false,
            error: 'Invalid JWT',
            message: 'JWT must contain kid in header' 
          },
          { status: 401 }
        );
      }

      const kid = decoded.header.kid;

      // Fetch the signing key from database using kid
      const signingKey = await locals.prisma.jwtSigningKey.findUnique({
        where: {
          id: kid
        }
      });

      if (!signingKey || !signingKey.isActive || signingKey.keyType !== 'TOKEN') {
        logger.warn('Invalid or inactive signing key', { kid });
        return json(
          { 
            success: false,
            error: 'Invalid JWT',
            message: 'JWT signed with invalid or inactive key' 
          },
          { status: 401 }
        );
      }

      // Verify the JWT signature and expiration using PUBLIC key (not private key!)
      let payload: DeviceJWTPayload;
      try {
        const verified = jwt.verify(token, signingKey.publicKey, {
          algorithms: [signingKey.algorithm as jwt.Algorithm],
          audience: 'https://fs04.datarealities.com',
          issuer: 'fs04'
        });

        payload = verified as DeviceJWTPayload;
      } catch (err) {
        logger.warn('JWT verification failed', {
          error: err instanceof Error ? err.message : String(err),
          kid
        });
        
        if (err instanceof jwt.TokenExpiredError) {
          return json(
            { 
              success: false,
              error: 'Token expired',
              message: 'JWT has expired, please request a new token' 
            },
            { status: 401 }
          );
        }

        return json(
          { 
            success: false,
            error: 'Invalid JWT',
            message: err instanceof Error ? err.message : 'JWT verification failed' 
          },
          { status: 401 }
        );
      }

      // Extract user info from the JWT payload
      if (!payload.userId) {
        logger.warn('JWT missing userId in payload');
        return json(
          { 
            success: false,
            error: 'Invalid JWT',
            message: 'JWT must contain userId' 
          },
          { status: 401 }
        );
      }

      // Get user info from database
      const userInfo = await userInfoByUserId(payload.userId);

      if (!userInfo) {
        logger.warn('User not found for JWT userId', { userId: payload.userId });
        return json(
          { 
            success: false,
            error: 'User not found',
            message: 'User associated with JWT does not exist' 
          },
          { status: 401 }
        );
      }

      // Check if user has required role
      if (!userInfo.systemRole || !allowedRoles.includes(userInfo.systemRole)) {
        logger.warn('Insufficient permissions for JWT user', {
          userId: userInfo.id,
          userRole: userInfo.systemRole,
          requiredRoles: allowedRoles
        });
        return json(
          { 
            success: false,
            error: 'Forbidden',
            message: 'Insufficient permissions' 
          },
          { status: 403 }
        );
      }

      // Get account memberships for the user to set up access control
      const memberships = await event.locals.prisma.accountMembership.findMany({
        where: { userId: userInfo.id },
        include: {
          account: {
            select: { id: true, name: true, slug: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Set up enhanced Prisma client with user context for ZenStack access policies
      const enhancedPrisma = getEnhancedPrisma({
        id: userInfo.id,
        systemRole: userInfo.systemRole,
        accountMemberships: memberships
      });

      // Create authenticated event with JWT data
      const authenticatedEvent: JWTAuthenticatedEvent = {
        ...event,
        auth: {
          user: userInfo
        },
        jwtPayload: payload,
        deviceId: payload.deviceId,
        accountId: payload.accountId,
        // Override locals.prisma with enhanced client that enforces access policies
        locals: {
          ...event.locals,
          prisma: enhancedPrisma
        }
      };

      logger.debug('JWT authentication successful', {
        userId: userInfo.id,
        deviceId: payload.deviceId,
        accountId: payload.accountId,
        accountMemberships: memberships.map(m => m.accountId)
      });

      // Call the handler with authenticated event
      return handler(authenticatedEvent);

    } catch (err) {
      logger.error('JWT authentication error', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });

      return json(
        { 
          success: false,
          error: 'Authentication failed',
          message: 'An error occurred during authentication' 
        },
        { status: 500 }
      );
    }
  };
}

