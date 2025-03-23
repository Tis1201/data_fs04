import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad } from '@sveltejs/kit';

/**
 * Type for route handlers that can be protected
 */
export type RouteHandler<T> = (event: RequestEvent) => Promise<T>;

/**
 * Restricts a route to users with specific roles
 * @param handler The route handler function to protect
 * @param allowedRoles Array of roles that are allowed to access the route
 * @returns A wrapped handler function that checks permissions before executing
 */
export function restrict<T>(
  handler: RouteHandler<T>,
  allowedRoles: string[] = ['admin']
): RouteHandler<T> {
  return async (event: RequestEvent) => {
    const auth = await event.locals.auth.validate();
    
    if (!auth?.user) {
      throw error(401, 'Unauthorized');
    }
    
    if (!allowedRoles.includes(auth.user.rolesString)) {
      throw error(403, 'Forbidden');
    }
    
    return handler(event);
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
