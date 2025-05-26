import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByUserId } from '$lib/server/security/auth-utils';

/**
 * Type for route handlers that can be protected
 */
export type RouteHandler<T> = (event: RequestEvent) => Promise<T>;

/**
 * Type for the enhanced event with auth information
 */
export type AuthenticatedEvent = RequestEvent & {
  auth: Awaited<ReturnType<RequestEvent['locals']['auth']['validate']>>
};

/**
 * Type for route handlers that receive authenticated events
 */
export type AuthenticatedRouteHandler<T> = (event: AuthenticatedEvent) => Promise<T>;

/**
 * Restricts a route to users with specific roles
 * @param handler The route handler function to protect
 * @param allowedRoles Array of roles that are allowed to access the route
 * @returns A wrapped handler function that checks permissions before executing
 */
export function restrict<T>(
  handler: AuthenticatedRouteHandler<T> | RouteHandler<T>,
  allowedRoles: string[] = ['ADMIN']
): RouteHandler<T> {
  return async (event: RequestEvent) => {
    const auth = await event.locals.auth.validate();
    
    if (!auth?.user) {
      throw error(401, 'Unauthorized');
    }
    
    if (!auth.user.systemRole || !allowedRoles.includes(auth.user.systemRole)) {
      console.log('systemRole', auth.user.systemRole, !auth.user.systemRole , !allowedRoles.includes(auth.user.systemRole));
      console.log('Unauthorized access attempt: ', auth.user.systemRole, allowedRoles); 
      throw error(403, 'Forbidden');
    }
    
    // Create an enhanced event with auth information
    const authenticatedEvent = {
      ...event,
      auth
    } as AuthenticatedEvent;
    
    // Pass the enhanced event to the handler
    return handler(authenticatedEvent as any);
  };
}

/**
 * Type for the device authentication result
 */
export type DeviceAuthResult = {
  device: any;
  userInfo: UserInfo;
} | {
  error: string;
  code?: string;
  response: Response;
};

/**
 * Type for the event object passed to the restrict_device function
 */
export type DeviceAuthEvent = {
  locals: RequestEvent['locals'];
  request: Request;
};

/**
 * Authenticates a device using an API key
 * @param event Object containing locals and request
 * @returns Object with device and userInfo if successful, or error response if not
 */
export async function restrict_device(
  event: DeviceAuthEvent
): Promise<DeviceAuthResult> {
  const { locals, request } = event;
  // Try both header variations to handle case sensitivity issues
  const apiKey = request.headers.get('x-api-key') || request.headers.get('x-api-Key');

  if (!apiKey) {
    logger.warn('No API Key provided');
    return {
      error: 'No API Key provided',
      response: json({ error: 'No API Key provided' }, { status: 400 })
    };
  }

  const prisma = locals.prisma;

  // Find device by apiKey
  const device = await prisma.device.findFirst({
    where: { apiKey },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          systemRole: true
        }
      }
    }
  });

  if (!device) {
    logger.warn(`Invalid API key: ${apiKey.substring(0, 8)}...`);
    return {
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
      response: json({ error: 'Invalid API key', code: 'INVALID_API_KEY' }, { status: 401 })
    };
  }

  // Add detailed logging of the device object to debug the issue
  logger.info(`Device ${device.id} (${device.name || 'unnamed'}) connected via API key, owned by: ${device.user.name}`);
  logger.debug('Device object structure:', {
    id: device.id,
    keys: Object.keys(device),
    hasId: 'id' in device
  });

  const userInfo: UserInfo = await userInfoByUserId(device.user.id);
  
  return { device, userInfo };
}

/**
 * Restricts a route to authenticated users only
 * @param handler The route handler function to protect
 * @returns A wrapped handler function that checks authentication before executing
 */
export function restrictAuth<T>(
  handler: RouteHandler<T>
): RouteHandler<T> {
  return async (event: RequestEvent) => {
    const auth = await event.locals.auth.validate();
    
    if (!auth?.user) {
      throw error(401, 'Unauthorized');
    }
    
    return handler(event);
  };
}

/**
 * Allows unrestricted access to a route
 * This is a pass-through function that doesn't add any security checks
 * Useful for explicitly marking routes as public
 * @param handler The route handler function
 * @returns The original handler without any security checks
 */
export function unrestricted<T>(handler: RouteHandler<T>): RouteHandler<T> {
  return handler;
}
