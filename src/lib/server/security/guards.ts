import { error, json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByApiKey, userInfoByUserId } from '$lib/server/security/auth-utils';
import prisma, { getEnhancedPrisma } from '$lib/server/prisma';
import type { Device } from '@prisma/client';
import type { PermissionAction } from '$lib/constants/permissions';
import { hasModulePermission, getUserModulePermissions } from '$lib/server/security/modulePermissions';
import { getRouteModuleConfig, getActionForMethod } from '$lib/constants/routeModuleMap';
import { SYSTEM_ACCOUNT } from '$lib/constants/system';

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

    (event.locals as any).user = auth.user;
    
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

  // IMPORTANT: device auth must not depend on the request's session/user context.
  // Using locals.prisma here can apply RLS / anon restrictions and cause valid
  // device API keys to appear "invalid". Use the raw (unenhanced) Prisma client.
  const prisma = getEnhancedPrisma(null);

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

  if (!device.user) {
    logger.warn(`Device ${device.id} has no associated user`);
    return {
      error: 'Device has no associated user',
      code: 'DEVICE_NO_USER',
      response: json({ error: 'Device has no associated user', code: 'DEVICE_NO_USER' }, { status: 401 })
    };
  }

  // Add detailed logging of the device object to debug the issue
  logger.info(`Device ${device.id} (${device.name || 'unnamed'}) connected via API key, owned by: ${device.user.name}`);
  logger.debug('Device object structure:', {
    id: device.id,
    keys: Object.keys(device),
    hasId: 'id' in device
  });

  const userInfo = await userInfoByUserId(device.user.id);

  if (!userInfo) {
    logger.warn(`Could not find user info for device owner: ${device.user.id}`);
    return {
      error: 'Device owner not found',
      code: 'DEVICE_OWNER_NOT_FOUND',
      response: json({ error: 'Device owner not found', code: 'DEVICE_OWNER_NOT_FOUND' }, { status: 500 })
    };
  }

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
      currentAccountId = (event.params as Record<string, string>)[paramName] || null;
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
 * Module-authenticated event type
 * Includes auth info and module permission context
 */
export type ModuleAuthenticatedEvent = AuthenticatedEvent & {
  modulePermission: {
    module: string;
    action: PermissionAction;
    accountId: string;
  };
};

/**
 * Type for route handlers that receive module-authenticated events
 */
export type ModuleAuthenticatedRouteHandler<T> = (event: ModuleAuthenticatedEvent) => Promise<T>;

/**
 * Options for restrictModule guard
 */
export interface RestrictModuleOptions {
  /** Override the default action for this route */
  action?: PermissionAction;
  /** Additional system roles that can bypass module check (use sparingly, not recommended) */
  bypassRoles?: string[];
  /** Whether to skip module check entirely (for debugging only) */
  skipCheck?: boolean;
  /** Custom error message when permission is denied */
  errorMessage?: string;
}

/**
 * Restricts a route based on module permissions from the database
 * 
 * This guard:
 * 1. Validates user authentication
 * 2. Checks if the user has the required module permission via their groups
 * 3. All users (including ADMIN systemRole) must have proper permissions
 * 
 * Note: Module permissions are account-scoped. Even system admins need
 * proper group permissions within each account to access account-level modules.
 * 
 * For system-level operations (not account-scoped), use restrict([SystemRole.ADMIN])
 * instead of restrictModule.
 * 
 * @param handler The route handler function to protect
 * @param module The module name (e.g., 'USER_DEVICES', 'BUNDLES')
 * @param options Optional configuration
 * @returns A wrapped handler function that checks module permissions before executing
 * 
 * @example
 * ```typescript
 * // Basic usage
 * export const load = restrictModule(handler, 'USER_DEVICES');
 * 
 * // With specific action
 * export const load = restrictModule(handler, 'USER_DEVICES', { action: 'EDIT' });
 * 
 * // Allow specific roles to bypass (use sparingly)
 * export const load = restrictModule(handler, 'USER_DEVICES', { bypassRoles: ['SUPER_ADMIN'] });
 * ```
 */
export function restrictModule<T>(
  handler: ModuleAuthenticatedRouteHandler<T> | AuthenticatedRouteHandler<T> | RouteHandler<T> | ((event: AuthenticatedLoadEvent) => Promise<T>),
  module: string,
  options: RestrictModuleOptions = {}
): RouteHandler<T> {
  const {
    action = 'VIEW',
    bypassRoles = [],
    skipCheck = false,
    errorMessage = 'You do not have permission to access this module'
  } = options;

  return async (event: RequestEvent) => {
    // First authenticate the user
    const auth = await event.locals.auth.validate();

    if (!auth?.user) {
      throw error(401, 'Unauthorized');
    }

    const userId = auth.user.id;
    const systemRole = auth.user.systemRole;

    // REMOVED: ADMIN system role bypass
    // Module permissions are account-scoped and should be respected by all users.
    // System admins should be assigned to appropriate groups for permissions.
    // For system-level operations, use restrict([SystemRole.ADMIN]) instead.

    // Check additional bypass roles (if explicitly configured)
    if (bypassRoles.includes(systemRole)) {
      logger.debug('Module check bypassed by role', { userId, module, action, systemRole });
      
      // Set auth and user in locals for backward compatibility
      (event.locals as any).auth = auth;
      (event.locals as any).user = auth.user;
      (event.locals as any).modulePermissions = {}; // Empty for bypass roles
      
      const authenticatedEvent = {
        ...event,
        auth,
        modulePermission: {
          module,
          action,
          accountId: (event.locals as any).currentAccount?.account?.id || ''
        },
        ...(('depends' in event) && { depends: (event as any).depends })
      } as ModuleAuthenticatedEvent & Partial<Pick<AuthenticatedLoadEvent, 'depends'>>;

      return handler(authenticatedEvent as any);
    }

    // Skip check if explicitly disabled
    if (skipCheck) {
      logger.debug('Module check skipped by option', { userId, module, action });
      
      // Set auth and user in locals for backward compatibility
      (event.locals as any).auth = auth;
      (event.locals as any).user = auth.user;
      (event.locals as any).modulePermissions = {}; // Empty when skipCheck
      
      const authenticatedEvent = {
        ...event,
        auth,
        modulePermission: {
          module,
          action,
          accountId: (event.locals as any).currentAccount?.account?.id || ''
        },
        ...(('depends' in event) && { depends: (event as any).depends })
      } as ModuleAuthenticatedEvent & Partial<Pick<AuthenticatedLoadEvent, 'depends'>>;

      return handler(authenticatedEvent as any);
    }

    // Check if user is SYSTEM_ACCOUNT member - bypass all ACL checks
    // Note: SYSTEM_ACCOUNT memberships can have role 'SYSTEM', so we don't filter by role
    const systemAccountMembership = await event.locals.prisma.accountMembership.findFirst({
      where: {
        userId,
        account: {
          OR: [
            { slug: SYSTEM_ACCOUNT },
            { isSystem: true }
          ]
        }
        // Don't filter by role - SYSTEM_ACCOUNT memberships can have role 'SYSTEM'
      },
      include: {
        account: {
          select: { id: true, slug: true, isSystem: true }
        }
      }
    });

    // SYSTEM_ACCOUNT members have full access - bypass all permission checks
    if (systemAccountMembership) {
      logger.debug('SYSTEM_ACCOUNT member - bypassing ACL check', { 
        userId, 
        accountId: systemAccountMembership.account.id,
        module,
        action 
      });
      
      // Set auth and user in locals
      (event.locals as any).auth = auth;
      (event.locals as any).user = auth.user;
      (event.locals as any).modulePermissions = { __SYSTEM_ACCOUNT__: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] } as any;
      
      const authenticatedEvent = {
        ...event,
        auth,
        modulePermission: {
          module,
          action,
          accountId: systemAccountMembership.account.id
        },
        ...(('depends' in event) && { depends: (event as any).depends })
      } as ModuleAuthenticatedEvent & Partial<Pick<AuthenticatedLoadEvent, 'depends'>>;

      return handler(authenticatedEvent as any);
    }

    // Get current account ID
    const accountId = (event.locals as any).currentAccount?.account?.id;

    // For admin routes, if no currentAccount is set, try to get first non-system account
    // This allows admin users to access admin routes even without explicit account selection
    let effectiveAccountId = accountId;
    if (!effectiveAccountId && systemRole === 'ADMIN') {
      const adminMemberships = await event.locals.prisma.accountMembership.findMany({
        where: {
          userId,
          role: { not: 'SYSTEM' }
        },
        include: {
          account: {
            select: { id: true, isSystem: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });
      
      if (adminMemberships.length > 0) {
        effectiveAccountId = adminMemberships[0].account.id;
        logger.debug('Using first non-system account for admin module check', { 
          userId, 
          accountId: effectiveAccountId,
          module,
          action 
        });
      }
    }

    if (!effectiveAccountId) {
      logger.warn('No current account for module permission check', { userId, module, action, systemRole });
      throw error(400, 'No current account selected. Please select an account to access this module.');
    }

    // Check module permission
    let hasPermission = false;
    try {
      // Always use raw Prisma for ACL reads (avoid ZenStack-enhanced client missing models)
      hasPermission = await hasModulePermission({
        userId,
        accountId: effectiveAccountId,
        module,
        action,
        prismaClient: prisma
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      logger.error('Error checking module permission', {
        error: err,
        message: err.message,
        stack: err.stack,
        userId,
        accountId: effectiveAccountId,
        module,
        action,
        path: event.url.pathname,
        hasPrisma: !!prisma
      });
      // If permission check fails, deny access for security.
      // In dev, include the underlying error message to make debugging fast.
      const isDev = process.env.NODE_ENV !== 'production';
      throw error(500, isDev ? `Failed to verify permissions: ${err.message}` : 'Failed to verify permissions. Please try again later.');
    }

    if (!hasPermission) {
      logger.warn('Module permission denied', {
        userId,
        accountId: effectiveAccountId,
        module,
        action,
        path: event.url.pathname,
        systemRole
      });
      throw error(403, errorMessage);
    }

    // Set user in locals for backward compatibility (like restrict function)
    (event.locals as any).user = auth.user;
    
    // Fetch and cache module permissions in locals for convenience
    try {
      // Always use raw Prisma for ACL reads (avoid ZenStack-enhanced client missing models)
      const modulePermissions = await getUserModulePermissions(userId, effectiveAccountId, prisma);
      (event.locals as any).modulePermissions = modulePermissions;
    } catch (e) {
      logger.warn('Failed to fetch module permissions for locals', { error: e });
      (event.locals as any).modulePermissions = {};
    }

    // Create enhanced event with auth and module permission info
    const authenticatedEvent = {
      ...event,
      auth,
      modulePermission: {
        module,
        action,
        accountId: effectiveAccountId
      },
      ...(('depends' in event) && { depends: (event as any).depends })
    } as ModuleAuthenticatedEvent & Partial<Pick<AuthenticatedLoadEvent, 'depends'>>;

    return handler(authenticatedEvent as any);
  };
}

/**
 * Restricts a route based on the route path and automatic module detection
 * Uses the routeModuleMap to determine which module permission is required
 * 
 * @param handler The route handler function to protect
 * @param options Optional configuration
 * @returns A wrapped handler function that checks module permissions before executing
 * 
 * @example
 * ```typescript
 * // Automatically detect module from route path
 * export const load = restrictByRoute(handler);
 * 
 * // With action override
 * export const load = restrictByRoute(handler, { action: 'EDIT' });
 * ```
 */
export function restrictByRoute<T>(
  handler: ModuleAuthenticatedRouteHandler<T> | AuthenticatedRouteHandler<T> | RouteHandler<T> | ((event: AuthenticatedLoadEvent) => Promise<T>),
  options: RestrictModuleOptions = {}
): RouteHandler<T> {
  return async (event: RequestEvent) => {
    const path = event.url.pathname;
    const method = event.request.method;

    // Look up module configuration for this route
    const routeConfig = getRouteModuleConfig(path);

    if (!routeConfig) {
      // No module configuration found - fall back to basic auth check
      logger.warn('No module configuration found for route', { path });
      
      const auth = await event.locals.auth.validate();
      if (!auth?.user) {
        throw error(401, 'Unauthorized');
      }

      const authenticatedEvent = {
        ...event,
        auth,
        ...(('depends' in event) && { depends: (event as any).depends })
      } as AuthenticatedEvent & Partial<Pick<AuthenticatedLoadEvent, 'depends'>>;

      return handler(authenticatedEvent as any);
    }

    // Check if module check should be skipped
    if (routeConfig.skipCheck) {
      const auth = await event.locals.auth.validate();
      if (!auth?.user) {
        throw error(401, 'Unauthorized');
      }

      const authenticatedEvent = {
        ...event,
        auth,
        modulePermission: {
          module: routeConfig.module,
          action: options.action || routeConfig.defaultAction,
          accountId: (event.locals as any).currentAccount?.account?.id || ''
        },
        ...(('depends' in event) && { depends: (event as any).depends })
      } as ModuleAuthenticatedEvent & Partial<Pick<AuthenticatedLoadEvent, 'depends'>>;

      return handler(authenticatedEvent as any);
    }

    // Determine the required action
    const action = options.action || getActionForMethod(method, routeConfig);

    // Use restrictModule with the determined module and action
    return restrictModule(handler, routeConfig.module, {
      ...options,
      action
    })(event);
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
