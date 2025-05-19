import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Check if the user has the required role in the current account
 */
export function hasRole(locals: App.Locals, requiredRoles: Role | Role[]): boolean {
    const { currentAccount } = locals;
    
    if (!currentAccount) return false;
    
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(currentAccount.role as Role);
}

/**
 * Require the user to have specific roles in the current account
 * Throws a 403 error if the user doesn't have the required role
 */
export function requireRole(locals: App.Locals, requiredRoles: Role | Role[], message = 'Insufficient permissions'): void {
    if (!hasRole(locals, requiredRoles)) {
        throw error(403, { message });
    }
}

/**
 * Require the user to be authenticated
 * Throws a 401 error if the user is not authenticated
 */
export function requireAuth(locals: App.Locals, message = 'Authentication required'): void {
    if (!locals.user) {
        throw error(401, { message });
    }
}

/**
 * Require the user to have a current account selected
 * Throws a 400 error if no account is selected
 */
export function requireAccount(locals: App.Locals, message = 'No account selected'): void {
    if (!locals.currentAccount) {
        throw error(400, { message });
    }
}

/**
 * Helper to restrict access to admin pages
 * Use this in +page.server.ts load functions
 */
export function restrict(event: RequestEvent, requiredRoles: Role | Role[] = ['OWNER', 'ADMIN']) {
    requireAuth(event.locals);
    requireAccount(event.locals);
    requireRole(event.locals, requiredRoles);
}

/**
 * Check if the user has system admin role
 */
export function isSystemAdmin(locals: App.Locals): boolean {
    return locals.user?.systemRole === 'ADMIN' || locals.user?.systemRole === 'SUPER_ADMIN';
}
