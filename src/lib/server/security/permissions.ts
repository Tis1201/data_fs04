/**
 * Permission-Based Middleware
 * 
 * This module provides centralized permission checking for the application.
 * All permission logic is defined here for easy auditing and modification.
 * 
 * @see docs/local/ROUTES_API_MAPPING.md - Section 3: Create Permission-Based Middleware
 */

export type SystemRole = 'ADMIN' | 'USER' | 'GUEST';

/**
 * User context for permission checking
 */
export interface PermissionUser {
	id: string;
	role: SystemRole;
	accountId?: string;
	groupIds?: string[];
}

/**
 * Resource context for permission checking
 */
export interface PermissionResource {
	accountId?: string;
	createdBy?: string;
	ownerId?: string;
	isPublic?: boolean;
	[key: string]: any;
}

/**
 * Permission check function signature
 */
export type PermissionCheck = (
	user: PermissionUser,
	resource?: PermissionResource
) => boolean | Promise<boolean>;

/**
 * Permission definition with role-based checks
 */
export interface PermissionDefinition {
	ADMIN?: PermissionCheck;
	USER?: PermissionCheck;
	GUEST?: PermissionCheck;
	description?: string;
}

/**
 * Core permission definitions
 * 
 * Each permission has role-based checks. If a role is not defined,
 * it defaults to false (no permission).
 */
export const permissions: Record<string, PermissionDefinition> = {
	// ========================================
	// Device Permissions
	// ========================================
	'device.view': {
		ADMIN: () => true, // Admin can view all devices
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'View device details'
	},

	'device.edit': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Edit device configuration'
	},

	'device.delete': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			// Users can delete devices they own in their account
			return resource.accountId === user.accountId && resource.createdBy === user.id;
		},
		description: 'Delete device'
	},

	'device.control': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Control device (reboot, install apps, etc.)'
	},

	'device.simulator': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Access device simulator'
	},

	'device.viewAllAccounts': {
		ADMIN: () => true,
		USER: () => false,
		description: 'View devices across all accounts'
	},

	// ========================================
	// Bundle Permissions
	// ========================================
	'bundle.view': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'View bundle details'
	},

	'bundle.edit': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Edit bundle configuration'
	},

	'bundle.delete': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId && resource.createdBy === user.id;
		},
		description: 'Delete bundle'
	},

	'bundle.create': {
		ADMIN: () => true,
		USER: () => true,
		description: 'Create new bundle'
	},

	'bundle.publish': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Publish bundle to devices'
	},

	'bundle.stopAllWaves': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Stop all deployment waves (advanced feature)'
	},

	'bundle.autoStartWaves': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Automatically start next deployment wave'
	},

	// ========================================
	// Device Profile Permissions
	// ========================================
	'deviceProfile.view': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'View device profile'
	},

	'deviceProfile.edit': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Edit device profile'
	},

	'deviceProfile.delete': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId && resource.createdBy === user.id;
		},
		description: 'Delete device profile'
	},

	'deviceProfile.assign': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Assign profile to devices'
	},

	// ========================================
	// Resource Permissions
	// ========================================
	'resource.view': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			// Can view if owned by account or is public
			return resource.accountId === user.accountId || resource.isPublic === true;
		},
		description: 'View resource details'
	},

	'resource.edit': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Edit resource'
	},

	'resource.delete': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId && resource.createdBy === user.id;
		},
		description: 'Delete resource'
	},

	'resource.create': {
		ADMIN: () => true,
		USER: () => true,
		description: 'Create new resource'
	},

	'resource.changeOwnership': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Change resource account ownership'
	},

	'resource.viewAllAccounts': {
		ADMIN: () => true,
		USER: () => false,
		description: 'View resources across all accounts'
	},

	// ========================================
	// Upload Permissions
	// ========================================
	'upload.create': {
		ADMIN: () => true,
		USER: () => true,
		description: 'Create presigned URLs for file uploads'
	},

	// ========================================
	// Preclaim Permissions
	// ========================================
	'preclaim.view': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'View preclaim set'
	},

	'preclaim.edit': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId;
		},
		description: 'Edit preclaim set'
	},

	'preclaim.delete': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.accountId === user.accountId && resource.createdBy === user.id;
		},
		description: 'Delete preclaim set'
	},

	'preclaim.viewAllAccounts': {
		ADMIN: () => true,
		USER: () => false,
		description: 'View preclaim sets across all accounts'
	},

	// ========================================
	// Account & User Permissions
	// ========================================
	'account.view': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			return resource.id === user.accountId;
		},
		description: 'View account details'
	},

	'account.edit': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Edit account settings'
	},

	'account.viewAll': {
		ADMIN: () => true,
		USER: () => false,
		description: 'View all accounts'
	},

	'user.view': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			// Can view users in same account
			return resource.accountId === user.accountId;
		},
		description: 'View user details'
	},

	'user.edit': {
		ADMIN: () => true,
		USER: (user, resource) => {
			if (!resource) return false;
			// Can only edit own profile
			return resource.id === user.id;
		},
		description: 'Edit user details'
	},

	'user.invite': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Invite new users'
	},

	// ========================================
	// System Permissions
	// ========================================
	'system.debug': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Access debug tools and information'
	},

	'system.monitoring': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Access system monitoring'
	},

	'system.settings': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Modify system settings'
	},

	// ========================================
	// Advanced Features
	// ========================================
	'feature.verboseLogging': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Enable verbose logging'
	},

	'feature.advancedDebug': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Access advanced debugging features'
	},

	// ========================================
	// Admin-Specific Permissions
	// ========================================
	'admin.accessSimulator': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Access device simulator'
	},

	'admin.viewAllResources': {
		ADMIN: () => true,
		USER: () => false,
		description: 'View all resources across all accounts (debug mode)'
	},

	'admin.debug': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Access debug tools (connections, subscriptions)'
	},

	'admin.jwtKeys': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Manage JWT signing keys (create, rotate, generate)'
	},

	'admin.test': {
		ADMIN: () => true,
		USER: () => false,
		description: 'Access test endpoints (timeout checks, etc.)'
	}
};

/**
 * Checks if a user has a specific permission
 * 
 * @param user - User context
 * @param permission - Permission name (e.g., 'device.view')
 * @param resource - Optional resource context
 * @returns True if user has permission, false otherwise
 * 
 * @example
 * ```typescript
 * const canView = await hasPermission(user, 'device.view', device);
 * if (!canView) {
 *   throw error(403, 'Permission denied');
 * }
 * ```
 */
export async function hasPermission(
	user: PermissionUser,
	permission: string,
	resource?: PermissionResource
): Promise<boolean> {
	const permissionDef = permissions[permission];
	
	if (!permissionDef) {
		console.warn(`Unknown permission: ${permission}`);
		return false;
	}

	const roleCheck = permissionDef[user.role];
	
	if (!roleCheck) {
		return false;
	}

	const result = roleCheck(user, resource);
	
	// Handle both sync and async checks
	return result instanceof Promise ? await result : result;
}

/**
 * Checks if a user has permission, throws error if not
 * 
 * @param user - User context
 * @param permission - Permission name
 * @param resource - Optional resource context
 * @throws Error with 403 status if permission denied
 * 
 * @example
 * ```typescript
 * await requirePermission(user, 'device.edit', device);
 * // Continue with edit operation...
 * ```
 */
export async function requirePermission(
	user: PermissionUser,
	permission: string,
	resource?: PermissionResource
): Promise<void> {
	const allowed = await hasPermission(user, permission, resource);
	
	if (!allowed) {
		const error = new Error(`Permission denied: ${permission}`);
		(error as any).status = 403;
		(error as any).code = 'INSUFFICIENT_PERMISSIONS';
		throw error;
	}
}

/**
 * Checks multiple permissions (requires ALL)
 * 
 * @param user - User context
 * @param permissionList - Array of permission names
 * @param resource - Optional resource context
 * @returns True if user has ALL permissions
 */
export async function hasAllPermissions(
	user: PermissionUser,
	permissionList: string[],
	resource?: PermissionResource
): Promise<boolean> {
	const checks = await Promise.all(
		permissionList.map(p => hasPermission(user, p, resource))
	);
	
	return checks.every(result => result === true);
}

/**
 * Checks multiple permissions (requires ANY)
 * 
 * @param user - User context
 * @param permissionList - Array of permission names
 * @param resource - Optional resource context
 * @returns True if user has ANY permission
 */
export async function hasAnyPermission(
	user: PermissionUser,
	permissionList: string[],
	resource?: PermissionResource
): Promise<boolean> {
	const checks = await Promise.all(
		permissionList.map(p => hasPermission(user, p, resource))
	);
	
	return checks.some(result => result === true);
}

/**
 * Utility: Check if user should bypass ownership checks
 * 
 * @param user - User context
 * @returns True if user is admin (bypasses ownership)
 */
export function shouldCheckOwnership(user: PermissionUser): boolean {
	return user.role !== 'ADMIN';
}

/**
 * Utility: Get loader options based on user permissions
 * 
 * @param user - User context
 * @returns Standard loader options object
 * 
 * @example
 * ```typescript
 * const options = getLoaderOptions(user);
 * const device = await loadDeviceDetail(id, options);
 * ```
 */
export function getLoaderOptions(user: PermissionUser) {
	return {
		checkOwnership: shouldCheckOwnership(user),
		verboseLogging: user.role === 'ADMIN',
		accountId: user.accountId,
		userId: user.id,
		role: user.role
	};
}

/**
 * Lists all permissions available for a user's role
 * 
 * @param user - User context
 * @returns Array of permission names the user has
 */
export function getUserPermissions(user: PermissionUser): string[] {
	const userPermissions: string[] = [];
	
	for (const [name, definition] of Object.entries(permissions)) {
		if (definition[user.role]) {
			userPermissions.push(name);
		}
	}
	
	return userPermissions;
}

/**
 * Gets all permission definitions (for documentation/UI)
 * 
 * @returns Map of permission names to their descriptions
 */
export function getAllPermissions(): Record<string, string> {
	const result: Record<string, string> = {};
	
	for (const [name, definition] of Object.entries(permissions)) {
		if (definition.description) {
			result[name] = definition.description;
		}
	}
	
	return result;
}

