/**
 * Permission Helper Utilities
 * 
 * Client-side utilities for checking module permissions and controlling UI visibility.
 * These helpers work with the modulePermissions data passed from the server.
 * 
 * @example
 * ```svelte
 * <script>
 *   import { canView, canCreate, canEdit, canDelete, hasPermission } from '$lib/utils/permissions';
 *   export let data;
 *   
 *   $: showCreateBtn = canCreate(data.modulePermissions, 'USER_DEVICES', data.user?.systemRole);
 * </script>
 * ```
 */

import type { PermissionAction } from '$lib/constants/permissions';

/**
 * Module permissions map type
 * Key is module name, value is array of allowed actions
 */
export type ModulePermissions = Record<string, PermissionAction[]>;

/**
 * All possible permission actions
 */
export const ALL_ACTIONS: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];

/**
 * Check if user has a specific permission action for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name to check
 * @param action - The action to check (VIEW, CREATE, EDIT, DELETE)
 * @param userSystemRole - Optional user system role (ADMIN bypasses all checks)
 * @returns True if user has the permission
 * 
 * @example
 * ```typescript
 * const canEditDevice = hasPermission(permissions, 'USER_DEVICES', 'EDIT', 'USER');
 * ```
 */
export function hasPermission(
	permissions: ModulePermissions | undefined | null,
	module: string,
	action: PermissionAction,
	userSystemRole?: string | null
): boolean {
	// ADMIN always has all permissions
	if (userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN') {
		return true;
	}

	// No permissions = no access
	if (!permissions || !module || !action) {
		return false;
	}

	// Check if module exists and has the action
	const modulePerms = permissions[module];
	if (!modulePerms || !Array.isArray(modulePerms)) {
		return false;
	}

	return modulePerms.includes(action);
}

/**
 * Check if user has VIEW permission for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name to check
 * @param userSystemRole - Optional user system role
 * @returns True if user can view the module
 */
export function canView(
	permissions: ModulePermissions | undefined | null,
	module: string,
	userSystemRole?: string | null
): boolean {
	return hasPermission(permissions, module, 'VIEW', userSystemRole);
}

/**
 * Check if user has CREATE permission for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name to check
 * @param userSystemRole - Optional user system role
 * @returns True if user can create in the module
 */
export function canCreate(
	permissions: ModulePermissions | undefined | null,
	module: string,
	userSystemRole?: string | null
): boolean {
	return hasPermission(permissions, module, 'CREATE', userSystemRole);
}

/**
 * Check if user has EDIT permission for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name to check
 * @param userSystemRole - Optional user system role
 * @returns True if user can edit in the module
 */
export function canEdit(
	permissions: ModulePermissions | undefined | null,
	module: string,
	userSystemRole?: string | null
): boolean {
	return hasPermission(permissions, module, 'EDIT', userSystemRole);
}

/**
 * Check if user has DELETE permission for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name to check
 * @param userSystemRole - Optional user system role
 * @returns True if user can delete in the module
 */
export function canDelete(
	permissions: ModulePermissions | undefined | null,
	module: string,
	userSystemRole?: string | null
): boolean {
	return hasPermission(permissions, module, 'DELETE', userSystemRole);
}

/**
 * Check if user has any of the specified actions for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name to check
 * @param actions - Array of actions to check
 * @param userSystemRole - Optional user system role
 * @returns True if user has at least one of the actions
 */
export function hasAnyPermission(
	permissions: ModulePermissions | undefined | null,
	module: string,
	actions: PermissionAction[],
	userSystemRole?: string | null
): boolean {
	if (userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN') {
		return true;
	}

	return actions.some(action => hasPermission(permissions, module, action, userSystemRole));
}

/**
 * Check if user has all of the specified actions for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name to check
 * @param actions - Array of actions to check
 * @param userSystemRole - Optional user system role
 * @returns True if user has all of the actions
 */
export function hasAllPermissions(
	permissions: ModulePermissions | undefined | null,
	module: string,
	actions: PermissionAction[],
	userSystemRole?: string | null
): boolean {
	if (userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN') {
		return true;
	}

	return actions.every(action => hasPermission(permissions, module, action, userSystemRole));
}

/**
 * Get all allowed actions for a module
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name
 * @param userSystemRole - Optional user system role
 * @returns Array of allowed actions
 */
export function getAllowedActions(
	permissions: ModulePermissions | undefined | null,
	module: string,
	userSystemRole?: string | null
): PermissionAction[] {
	// ADMIN has all actions
	if (userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN') {
		return [...ALL_ACTIONS];
	}

	if (!permissions || !permissions[module]) {
		return [];
	}

	return permissions[module].filter(action => ALL_ACTIONS.includes(action));
}

/**
 * Get the highest permission level for a module
 * Hierarchy: DELETE > EDIT > CREATE > VIEW
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name
 * @param userSystemRole - Optional user system role
 * @returns The highest permission action or null if none
 */
export function getHighestPermission(
	permissions: ModulePermissions | undefined | null,
	module: string,
	userSystemRole?: string | null
): PermissionAction | null {
	if (userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN') {
		return 'DELETE'; // Highest level
	}

	const allowed = getAllowedActions(permissions, module, userSystemRole);
	
	// Return in order of hierarchy
	if (allowed.includes('DELETE')) return 'DELETE';
	if (allowed.includes('EDIT')) return 'EDIT';
	if (allowed.includes('CREATE')) return 'CREATE';
	if (allowed.includes('VIEW')) return 'VIEW';
	
	return null;
}

/**
 * Check if user has access to any module (has at least one permission)
 * 
 * @param permissions - The user's module permissions map
 * @param userSystemRole - Optional user system role
 * @returns True if user has at least one permission
 */
export function hasAnyModuleAccess(
	permissions: ModulePermissions | undefined | null,
	userSystemRole?: string | null
): boolean {
	if (userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN') {
		return true;
	}

	if (!permissions) return false;
	
	return Object.values(permissions).some(actions => actions && actions.length > 0);
}

/**
 * Get all modules the user has access to (at least VIEW)
 * 
 * @param permissions - The user's module permissions map
 * @param userSystemRole - Optional user system role
 * @param allModules - Optional list of all modules (for ADMIN)
 * @returns Array of accessible module names
 */
export function getAccessibleModules(
	permissions: ModulePermissions | undefined | null,
	userSystemRole?: string | null,
	allModules?: string[]
): string[] {
	if (userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN') {
		return allModules || [];
	}

	if (!permissions) return [];
	
	return Object.entries(permissions)
		.filter(([_, actions]) => actions && actions.includes('VIEW'))
		.map(([module]) => module);
}

/**
 * Create a permission context object for easier passing to components
 * 
 * @param permissions - The user's module permissions map
 * @param module - The module name
 * @param userSystemRole - Optional user system role
 * @returns Object with permission flags
 */
export function createPermissionContext(
	permissions: ModulePermissions | undefined | null,
	module: string,
	userSystemRole?: string | null
) {
	return {
		module,
		canView: canView(permissions, module, userSystemRole),
		canCreate: canCreate(permissions, module, userSystemRole),
		canEdit: canEdit(permissions, module, userSystemRole),
		canDelete: canDelete(permissions, module, userSystemRole),
		allowedActions: getAllowedActions(permissions, module, userSystemRole),
		isAdmin: userSystemRole === 'ADMIN' || userSystemRole === 'SUPER_ADMIN'
	};
}

/**
 * Permission context type for TypeScript
 */
export type PermissionContext = ReturnType<typeof createPermissionContext>;

// ============================================================================
// Account Role-Based Permissions
// ============================================================================

export type AccountRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Check if the current user can perform admin actions within an account
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user has admin permissions
 */
export function canPerformAdminActions(currentAccount?: { userRole?: string }): boolean {
	if (!currentAccount?.userRole) return false;
	
	const userRole = currentAccount.userRole.toUpperCase() as AccountRole;
	return userRole === 'ADMIN' || userRole === 'OWNER';
}

/**
 * Check if the current user has a specific role or higher
 * @param requiredRole - The minimum required role
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user meets the role requirement
 */
export function hasAccountRole(requiredRole: AccountRole, currentAccount?: { userRole?: string }): boolean {
	if (!currentAccount?.userRole) return false;
	
	const userRole = currentAccount.userRole.toUpperCase() as AccountRole;
	
	// Define role hierarchy (higher number = more permissions)
	const roleHierarchy: Record<AccountRole, number> = {
		'MEMBER': 2,
		'ADMIN': 3,
		'OWNER': 4
	};
	
	return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if the current user has any of the specified roles
 * @param roles - Array of acceptable roles
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user has any of the specified roles
 */
export function hasAnyAccountRole(roles: AccountRole[], currentAccount?: { userRole?: string }): boolean {
	if (!currentAccount?.userRole) return false;
	
	const userRole = currentAccount.userRole.toUpperCase() as AccountRole;
	return roles.includes(userRole);
}

/**
 * Check if the current user is the account owner
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user is the owner
 */
export function isAccountOwner(currentAccount?: { userRole?: string }): boolean {
	return hasAccountRole('OWNER', currentAccount) && currentAccount?.userRole?.toUpperCase() === 'OWNER';
}

/**
 * Check if the current user can edit account settings
 * Typically only ADMIN and OWNER roles can edit account settings
 * @param currentAccount - Account data with userRole or role property
 * @returns boolean indicating if user can edit account settings
 */
export function canEditAccount(currentAccount?: { userRole?: string; role?: string }): boolean {
	// Support both userRole and role properties for compatibility
	const accountWithRole = currentAccount?.userRole 
		? currentAccount 
		: { userRole: currentAccount?.role };
	return canPerformAdminActions(accountWithRole);
}

/**
 * Get a user-friendly role display name
 * @param role - The role to format
 * @returns formatted role name
 */
export function formatRole(role?: string): string {
	if (!role) return 'Member';
	
	switch (role.toUpperCase()) {
		case 'OWNER': return 'Owner';
		case 'ADMIN': return 'Admin';
		case 'MEMBER': return 'Member';
		default: return role;
	}
}
