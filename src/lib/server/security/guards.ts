import { error, json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import type { PageServerLoad } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByApiKey, userInfoByUserId } from '$lib/server/security/auth-utils';
import type { Device } from '@prisma/client';

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
 * Type for authenticated load functions that includes depends
 * Use this for PageServerLoad functions that need depends()
 */
export type AuthenticatedLoadEvent = AuthenticatedEvent & {
  depends: (tag: string) => void;
};

/**
 * Type for the enhanced event with both auth and account information
 */
export type AccountAuthenticatedEvent = RequestEvent & {
  auth: Awaited<ReturnType<RequestEvent['locals']['auth']['validate']>>;
  accountMembership: {
    accountId: string;
    role: string;
    userId: string;
  };
};

/**
 * Type for route handlers that receive account-authenticated events
 */
export type AccountAuthenticatedRouteHandler<T> = (event: AccountAuthenticatedEvent) => Promise<T>;

/**
 * Restricts a route to users with specific roles
 * @param handler The route handler function to protect
 * @param allowedRoles Array of roles that are allowed to access the route
 * @returns A wrapped handler function that checks permissions before executing
 */
export function restrict<T>(
  handler: AuthenticatedRouteHandler<T> | RouteHandler<T> | ((event: AuthenticatedLoadEvent) => Promise<T>),
  allowedRoles: string[] = ['ADMIN']
): RouteHandler<T> {
  return async (event: RequestEvent) => {

    const auth = await event.locals.auth.validate();

    if (!auth?.user) {
      throw error(401, 'Unauthorized');
    }

    if (!auth.user.systemRole || !allowedRoles.includes(auth.user.systemRole)) {
      console.log('systemRole', auth.user.systemRole, !auth.user.systemRole, !allowedRoles.includes(auth.user.systemRole));
      console.log('Unauthorized access attempt: ', auth.user.systemRole, allowedRoles);
      throw error(403, 'Forbidden');
    }

    // Create an enhanced event with auth information
    // Include depends if it exists on the event (for load functions)
    const authenticatedEvent = {
      ...event,
      auth,
      ...(('depends' in event) && { depends: (event as any).depends })
    } as AuthenticatedEvent & Partial<Pick<AuthenticatedLoadEvent, 'depends'>>;

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

export type ApiAuthEvent = {
  locals: RequestEvent['locals'];
  request: Request;
};

export function restrictDevice(
  handler: (e: RequestEvent & { device: Device; userInfo: UserInfo }) => Promise<Response>
): RequestHandler {
  return async (event) => {
      const result = await restrict_device(event);
      if ('error' in result) return result.response;
      return handler({ ...event, ...result });
  };
}

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

/*************************************************************************************
 *
 *  A restriction for api
 *  - validate the x-api-key
 *  - get the userInfo by querying db to get the creator of this x-api-key
 *  - same check if 'ADMIN' or 'USER'
 *
 *************************************************************************************/
export function restrict_api<T>(
  handler: (event: RequestEvent & { userInfo: UserInfo }) => Promise<Response>,
  allowedRoles: string[] = ['ADMIN']
) {
  return async (event: RequestEvent): Promise<Response> => {
    const { request } = event;

    // Try both header variations to handle case sensitivity issues
    const apiKey = request.headers.get('x-api-key') || request.headers.get('x-api-Key');

    if (!apiKey) {
      logger.warn('No API Key provided');
      return json({ error: 'No API Key provided' }, { status: 400 });
    }

    const userInfo = await userInfoByApiKey(apiKey);

    if (!userInfo) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userInfo.systemRole || !allowedRoles.includes(userInfo.systemRole)) {
      logger.warn(`Unauthorized access attempt by ${userInfo.email} with role ${userInfo.systemRole}`);
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create enhanced event with userInfo
    const enhancedEvent = {
      ...event,
      userInfo
    } as RequestEvent & { userInfo: UserInfo };

    return handler(enhancedEvent);
  };
}



/**
 * Restricts access to a route using API key authentication
 * Similar to restrict but uses API key instead of session
 * @param handler The route handler function to protect
 * @returns A protected route handler that validates API key
 */
export function restrict_api_2<T>(
  handler: (event: RequestEvent & { auth: { user: UserInfo } }) => Promise<T>,
  allowedRoles: string[] = ['ADMIN']
): (event: RequestEvent) => Promise<T | Response> {
  return async (event: RequestEvent) => {
      const { request } = event;
      // Try both header variations to handle case sensitivity issues
      const apiKey = request.headers.get('x-api-key') || request.headers.get('x-api-Key');

      if (!apiKey) {
        logger.warn('No API Key provided');
        return json({ error: 'No API Key provided' }, { status: 400 });
      }

      const userInfo = await userInfoByApiKey(apiKey);

      if (!userInfo) {
        throw error(401, 'Unauthorized');
      }

      if (!userInfo.systemRole || !allowedRoles.includes(userInfo.systemRole)) {
        console.log('systemRole', userInfo.systemRole, !userInfo.systemRole, !allowedRoles.includes(userInfo.systemRole));
        console.log('Unauthorized access attempt: ', userInfo.systemRole, allowedRoles);
        throw error(403, 'Forbidden');
      }

      // Create an enhanced event with auth information
      const authenticatedEvent = {
        ...event,
        userInfo,
      } as unknown as AuthenticatedEvent;

      // Pass the enhanced event to the handler
      return handler(authenticatedEvent as any);
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

/**
 * Restricts a route to users with specific account roles
 * @param handler The route handler function to protect
 * @param allowedAccountRoles Array of account roles that are allowed to access the route
 * @param options Optional configuration
 * @returns A wrapped handler function that checks account permissions before executing
 */
export function restrictAccountRole<T>(
  handler: AccountAuthenticatedRouteHandler<T> | RouteHandler<T>,
  allowedAccountRoles: string[] = ['ADMIN', 'OWNER'],
  options: {
    accountIdSource?: 'cookie' | 'params';
    cookieName?: string;
    paramName?: string;
  } = {}
): RouteHandler<T> {
  const {
    accountIdSource = 'cookie',
    cookieName = 'current_account_id',
    paramName = 'accountId'
  } = options;

  return async (event: RequestEvent) => {
    // Check authentication first
    const auth = await event.locals.auth.validate();

    if (!auth?.user) {
      throw error(401, 'Unauthorized');
    }

    // Get current account ID based on source
    let currentAccountId: string | null = null;

    if (accountIdSource === 'cookie') {
      currentAccountId = event.cookies.get(cookieName) || null;
    } else if (accountIdSource === 'params') {
      currentAccountId = event.params[paramName] || null;
    }

    if (!currentAccountId) {
      logger.warn('No current account selected', {
        userId: auth.user.id,
        source: accountIdSource
      });
      throw error(400, 'No current account selected');
    }

    // Get user's membership in the current account
    const currentUserMembership = await event.locals.prisma.accountMembership.findFirst({
      where: {
        userId: auth.user.id,
        accountId: currentAccountId,
        role: { not: 'SYSTEM' }
      }
    });

    if (!currentUserMembership) {
      logger.warn('User not member of requested account', {
        userId: auth.user.id,
        accountId: currentAccountId
      });
      throw error(403, 'Access denied to this account');
    }

    // Check if user has required account role
    if (!allowedAccountRoles.includes(currentUserMembership.role)) {
      logger.warn('Insufficient account permissions', {
        userId: auth.user.id,
        accountId: currentAccountId,
        userRole: currentUserMembership.role,
        requiredRoles: allowedAccountRoles
      });
      throw error(403, 'Insufficient account permissions');
    }

    // Create an enhanced event with both auth and account information
    const accountAuthenticatedEvent = {
      ...event,
      auth,
      accountMembership: {
        accountId: currentAccountId,
        role: currentUserMembership.role,
        userId: auth.user.id
      }
    } as AccountAuthenticatedEvent;

    // Pass the enhanced event to the handler
    return handler(accountAuthenticatedEvent as any);
  };
}

/**
 * Restricts a route to users who can edit a specific user
 * This checks both account role permissions and self-editing permissions
 * @param handler The route handler function to protect
 * @param allowedAccountRoles Array of account roles that can edit any user
 * @returns A wrapped handler function that checks edit permissions before executing
 */
export function restrictUserEdit<T>(
  handler: AccountAuthenticatedRouteHandler<T> | RouteHandler<T>,
  allowedAccountRoles: string[] = ['ADMIN', 'OWNER']
): RouteHandler<T> {
  return async (event: RequestEvent) => {
    // First apply account role restrictions
    const accountRestricted = restrictAccountRole(
      handler,
      [...allowedAccountRoles, 'MEMBER'], // Allow members too, we'll check specific permissions below
      { accountIdSource: 'cookie' }
    );

    try {
      return await accountRestricted(event);
    } catch (err: any) {
      // If account role check failed, check if user is editing themselves
      if (err.status === 403) {
        const auth = await event.locals.auth.validate();
        const targetUserId = event.params.id;

        if (auth?.user && targetUserId === auth.user.id) {
          // User is editing themselves, allow it
          const accountAuthenticatedEvent = {
            ...event,
            auth,
            accountMembership: {
              accountId: event.cookies.get('current_account_id') || '',
              role: 'SELF_EDIT',
              userId: auth.user.id
            }
          } as AccountAuthenticatedEvent;

          return handler(accountAuthenticatedEvent as any);
        }
      }

      throw err;
    }
  };
}
