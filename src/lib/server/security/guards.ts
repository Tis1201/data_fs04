import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad } from '@sveltejs/kit';

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
    return handler(authenticatedEvent);
  };
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
