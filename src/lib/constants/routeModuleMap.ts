/**
 * Route to Module Mapping
 * 
 * This file defines the mapping between routes and their required module permissions.
 * It is used by the module access control system to determine which permissions
 * are needed to access a specific route.
 * 
 * @see src/lib/server/security/modulePermissions.ts
 */

import type { PermissionAction } from './permissions';

/**
 * Route module configuration
 */
export interface RouteModuleConfig {
	/** The module name as defined in permissions.ts */
	module: string;
	/** The default action required to access this route */
	defaultAction: PermissionAction;
	/** Optional: Alternative actions that can grant access */
	alternativeActions?: PermissionAction[];
	/** Optional: Skip module check for this route (e.g., for public routes) */
	skipCheck?: boolean;
	/** Optional: Description for documentation */
	description?: string;
}

/**
 * Route patterns that match dynamic segments
 * Uses regex-like patterns where:
 * - [param] matches any segment
 * - ** matches any remaining path
 */
function normalizeRoute(path: string): string {
	// Remove trailing slashes and query parameters
	return path.replace(/\?.*$/, '').replace(/\/$/, '') || '/';
}

/**
 * Matches a path against a pattern with dynamic segments
 */
export function matchRoute(path: string, pattern: string): boolean {
	const normalizedPath = normalizeRoute(path);
	const normalizedPattern = normalizeRoute(pattern);

	// Convert pattern to regex
	const regexPattern = normalizedPattern
		.replace(/\[.*?\]/g, '[^/]+')  // [param] -> match any segment
		.replace(/\*\*/g, '.*');       // ** -> match anything

	const regex = new RegExp(`^${regexPattern}$`);
	return regex.test(normalizedPath);
}

/**
 * User routes module mapping
 */
export const USER_ROUTE_MODULE_MAP: Record<string, RouteModuleConfig> = {
	// Dashboard
	'/user/dashboard': {
		module: 'USER_DASHBOARD',
		defaultAction: 'VIEW',
		description: 'User dashboard'
	},

	// IOT - Devices
	'/user/iot/devices': {
		module: 'USER_DEVICES',
		defaultAction: 'VIEW',
		description: 'Device list'
	},
	'/user/iot/devices/new': {
		module: 'USER_DEVICES',
		defaultAction: 'CREATE',
		description: 'Create new device'
	},
	'/user/iot/devices/[id]': {
		module: 'USER_DEVICES',
		defaultAction: 'VIEW',
		description: 'View device details'
	},
	'/user/iot/devices/[id]/edit': {
		module: 'USER_DEVICES',
		defaultAction: 'EDIT',
		description: 'Edit device'
	},
	'/user/iot/devices/[id]/terminal': {
		module: 'USER_DEVICES',
		defaultAction: 'EDIT',
		description: 'Device terminal access'
	},
	'/user/iot/devices/[id]/rdp': {
		module: 'USER_DEVICES',
		defaultAction: 'EDIT',
		description: 'Device RDP access'
	},

	// IOT - Device Tags
	'/user/iot/device_tags': {
		module: 'USER_DEVICE_TAGS',
		defaultAction: 'VIEW',
		description: 'Device tags list'
	},
	'/user/iot/device_tags/new': {
		module: 'USER_DEVICE_TAGS',
		defaultAction: 'CREATE',
		description: 'Create device tag'
	},
	'/user/iot/device_tags/[id]': {
		module: 'USER_DEVICE_TAGS',
		defaultAction: 'VIEW',
		description: 'View device tag'
	},

	// IOT - Device Profiles
	'/user/iot/device-profiles': {
		module: 'USER_DEVICE_PROFILES',
		defaultAction: 'VIEW',
		description: 'Device profiles list'
	},
	'/user/iot/device-profiles/new': {
		module: 'USER_DEVICE_PROFILES',
		defaultAction: 'CREATE',
		description: 'Create device profile'
	},
	'/user/iot/device-profiles/[id]': {
		module: 'USER_DEVICE_PROFILES',
		defaultAction: 'VIEW',
		description: 'View device profile'
	},
	'/user/iot/device-profiles/[id]/edit': {
		module: 'USER_DEVICE_PROFILES',
		defaultAction: 'EDIT',
		description: 'Edit device profile'
	},

	// IOT - Bundles
	'/user/iot/bundles': {
		module: 'USER_BUNDLES',
		defaultAction: 'VIEW',
		description: 'Bundles list'
	},
	'/user/iot/bundles/new': {
		module: 'USER_BUNDLES',
		defaultAction: 'CREATE',
		description: 'Create bundle'
	},
	'/user/iot/bundles/[id]': {
		module: 'USER_BUNDLES',
		defaultAction: 'VIEW',
		description: 'View bundle'
	},
	'/user/iot/bundles/[id]/edit': {
		module: 'USER_BUNDLES',
		defaultAction: 'EDIT',
		description: 'Edit bundle'
	},

	// IOT - Preclaims
	'/user/iot/preclaims': {
		module: 'USER_PRECLAIMS',
		defaultAction: 'VIEW',
		description: 'Preclaims list'
	},
	'/user/iot/preclaims/new': {
		module: 'USER_PRECLAIMS',
		defaultAction: 'CREATE',
		description: 'Create preclaim'
	},
	'/user/iot/preclaims/[id]': {
		module: 'USER_PRECLAIMS',
		defaultAction: 'VIEW',
		description: 'View preclaim'
	},
	'/user/iot/preclaims/[id]/edit': {
		module: 'USER_PRECLAIMS',
		defaultAction: 'EDIT',
		description: 'Edit preclaim'
	},

	// IOT - PIN Rules
	'/user/iot/pin-rules': {
		module: 'USER_PIN_RULES',
		defaultAction: 'VIEW',
		description: 'PIN rules list'
	},
	'/user/iot/pin-rules/new': {
		module: 'USER_PIN_RULES',
		defaultAction: 'CREATE',
		description: 'Create PIN rule'
	},
	'/user/iot/pin-rules/edit/[id]': {
		module: 'USER_PIN_RULES',
		defaultAction: 'EDIT',
		description: 'Edit PIN rule'
	},

	// Controllers - Radar
	'/user/controllers/radar': {
		module: 'USER_CONTROLLERS_RADAR',
		defaultAction: 'VIEW',
		description: 'Radar controllers list'
	},
	'/user/controllers/radar/new': {
		module: 'USER_CONTROLLERS_RADAR',
		defaultAction: 'CREATE',
		description: 'Create radar controller'
	},
	'/user/controllers/radar/[id]': {
		module: 'USER_CONTROLLERS_RADAR',
		defaultAction: 'VIEW',
		description: 'View radar controller'
	},

	// Resources
	'/user/resources': {
		module: 'USER_RESOURCES',
		defaultAction: 'VIEW',
		description: 'Resources list'
	},
	'/user/resources/new': {
		module: 'USER_RESOURCES',
		defaultAction: 'CREATE',
		description: 'Create resource'
	},
	'/user/resources/[id]': {
		module: 'USER_RESOURCES',
		defaultAction: 'VIEW',
		description: 'View resource'
	},

	// Settings - Account
	'/user/settings/account': {
		module: 'USER_ACCOUNT_SETTINGS',
		defaultAction: 'VIEW',
		description: 'Account settings'
	},

	// Settings - Users
	'/user/settings/users': {
		module: 'USER_USERS',
		defaultAction: 'VIEW',
		description: 'Users list'
	},
	'/user/settings/users/new': {
		module: 'USER_USERS',
		defaultAction: 'CREATE',
		description: 'Create user'
	},
	'/user/settings/users/[id]': {
		module: 'USER_USERS',
		defaultAction: 'VIEW',
		description: 'View user'
	},
	'/user/settings/users/[id]/sessions': {
		module: 'USER_USERS',
		defaultAction: 'VIEW',
		description: 'View user sessions'
	},

	// Profile (special - users can always access their own profile)
	'/user/profile': {
		module: 'USER_PROFILE',
		defaultAction: 'VIEW',
		skipCheck: true,  // Users can always access their own profile
		description: 'User profile'
	},

	// Support (public within user area)
	'/user/support': {
		module: 'USER_SUPPORT',
		defaultAction: 'VIEW',
		skipCheck: true,  // Always accessible
		description: 'Help & Support'
	},

	// Logs
	'/user/logs': {
		module: 'USER_LOGS',
		defaultAction: 'VIEW',
		description: 'View logs'
	}
};

/**
 * Admin routes module mapping
 */
export const ADMIN_ROUTE_MODULE_MAP: Record<string, RouteModuleConfig> = {
	// Dashboard
	'/admin/dashboard': {
		module: 'DASHBOARD',
		defaultAction: 'VIEW',
		description: 'Admin dashboard'
	},

	// IOT - Factory Tokens
	'/admin/iot/factory_tokens': {
		module: 'FACTORY_TOKENS',
		defaultAction: 'VIEW',
		description: 'Factory tokens list'
	},
	'/admin/iot/factory_tokens/new': {
		module: 'FACTORY_TOKENS',
		defaultAction: 'CREATE',
		description: 'Create factory token'
	},
	'/admin/iot/factory_tokens/[id]': {
		module: 'FACTORY_TOKENS',
		defaultAction: 'VIEW',
		description: 'View factory token'
	},

	// IOT - Devices
	'/admin/iot/devices': {
		module: 'DEVICES',
		defaultAction: 'VIEW',
		description: 'Device list'
	},
	'/admin/iot/devices/new': {
		module: 'DEVICES',
		defaultAction: 'CREATE',
		description: 'Create device'
	},
	'/admin/iot/devices/[id]': {
		module: 'DEVICES',
		defaultAction: 'VIEW',
		description: 'View device'
	},
	'/admin/iot/devices/[id]/edit': {
		module: 'DEVICES',
		defaultAction: 'EDIT',
		description: 'Edit device'
	},

	// IOT - Device Tags
	'/admin/iot/device_tags': {
		module: 'DEVICE_TAGS',
		defaultAction: 'VIEW',
		description: 'Device tags list'
	},
	'/admin/iot/device_tags/new': {
		module: 'DEVICE_TAGS',
		defaultAction: 'CREATE',
		description: 'Create device tag'
	},
	'/admin/iot/device_tags/[id]': {
		module: 'DEVICE_TAGS',
		defaultAction: 'VIEW',
		description: 'View device tag'
	},

	// IOT - Device Profiles
	'/admin/iot/device-profiles': {
		module: 'DEVICE_PROFILES',
		defaultAction: 'VIEW',
		description: 'Device profiles list'
	},
	'/admin/iot/device-profiles/new': {
		module: 'DEVICE_PROFILES',
		defaultAction: 'CREATE',
		description: 'Create device profile'
	},
	'/admin/iot/device-profiles/[id]': {
		module: 'DEVICE_PROFILES',
		defaultAction: 'VIEW',
		description: 'View device profile'
	},
	'/admin/iot/device-profiles/[id]/edit': {
		module: 'DEVICE_PROFILES',
		defaultAction: 'EDIT',
		description: 'Edit device profile'
	},

	// IOT - Resources
	'/admin/iot/resources': {
		module: 'RESOURCES',
		defaultAction: 'VIEW',
		description: 'Resources list'
	},
	'/admin/iot/resources/new': {
		module: 'RESOURCES',
		defaultAction: 'CREATE',
		description: 'Create resource'
	},
	'/admin/iot/resources/[id]': {
		module: 'RESOURCES',
		defaultAction: 'VIEW',
		description: 'View resource'
	},

	// IOT - Bundles
	'/admin/iot/bundles': {
		module: 'BUNDLES',
		defaultAction: 'VIEW',
		description: 'Bundles list'
	},
	'/admin/iot/bundles/new': {
		module: 'BUNDLES',
		defaultAction: 'CREATE',
		description: 'Create bundle'
	},
	'/admin/iot/bundles/[id]': {
		module: 'BUNDLES',
		defaultAction: 'VIEW',
		description: 'View bundle'
	},
	'/admin/iot/bundles/[id]/edit': {
		module: 'BUNDLES',
		defaultAction: 'EDIT',
		description: 'Edit bundle'
	},

	// IOT - Preclaims
	'/admin/iot/preclaims': {
		module: 'PRECLAIMS',
		defaultAction: 'VIEW',
		description: 'Preclaims list'
	},
	'/admin/iot/preclaims/new': {
		module: 'PRECLAIMS',
		defaultAction: 'CREATE',
		description: 'Create preclaim'
	},
	'/admin/iot/preclaims/[id]': {
		module: 'PRECLAIMS',
		defaultAction: 'VIEW',
		description: 'View preclaim'
	},

	// IOT - PIN Rules
	'/admin/iot/pin-rules': {
		module: 'PIN_RULES',
		defaultAction: 'VIEW',
		description: 'PIN rules list'
	},
	'/admin/iot/pin-rules/new': {
		module: 'PIN_RULES',
		defaultAction: 'CREATE',
		description: 'Create PIN rule'
	},
	'/admin/iot/pin-rules/edit/[id]': {
		module: 'PIN_RULES',
		defaultAction: 'EDIT',
		description: 'Edit PIN rule'
	},

	// Controllers - Radar (Admin)
	'/admin/controllers/radar': {
		module: 'ADMIN_CONTROLLERS_RADAR',
		defaultAction: 'VIEW',
		description: 'Admin radar controllers list'
	},
	'/admin/controllers/radar/new': {
		module: 'ADMIN_CONTROLLERS_RADAR',
		defaultAction: 'CREATE',
		description: 'Create admin radar controller'
	},
	'/admin/controllers/radar/[id]': {
		module: 'ADMIN_CONTROLLERS_RADAR',
		defaultAction: 'VIEW',
		description: 'View admin radar controller'
	},
	'/admin/controllers/radar/[id]/configure': {
		module: 'ADMIN_CONTROLLERS_RADAR',
		defaultAction: 'EDIT',
		description: 'Configure admin radar controller'
	},

	// Access - Accounts
	'/admin/accounts/accounts': {
		module: 'ACCOUNTS',
		defaultAction: 'VIEW',
		description: 'Accounts list'
	},
	'/admin/accounts/accounts/new': {
		module: 'ACCOUNTS',
		defaultAction: 'CREATE',
		description: 'Create account'
	},
	'/admin/accounts/accounts/[id]': {
		module: 'ACCOUNTS',
		defaultAction: 'VIEW',
		description: 'View account'
	},

	// Access - Companies
	'/admin/accounts/companies': {
		module: 'COMPANIES',
		defaultAction: 'VIEW',
		description: 'Companies list'
	},
	'/admin/accounts/companies/new': {
		module: 'COMPANIES',
		defaultAction: 'CREATE',
		description: 'Create company'
	},
	'/admin/accounts/companies/[id]': {
		module: 'COMPANIES',
		defaultAction: 'VIEW',
		description: 'View company'
	},

	// Access - Groups
	'/admin/accounts/groups': {
		module: 'GROUPS',
		defaultAction: 'VIEW',
		description: 'Groups list'
	},
	'/admin/accounts/groups/new': {
		module: 'GROUPS',
		defaultAction: 'CREATE',
		description: 'Create group'
	},
	'/admin/accounts/groups/[id]': {
		module: 'GROUPS',
		defaultAction: 'VIEW',
		description: 'View group'
	},

	// Users
	'/admin/users': {
		module: 'ADMIN_USERS',
		defaultAction: 'VIEW',
		description: 'Users list'
	},
	'/admin/users/new': {
		module: 'ADMIN_USERS',
		defaultAction: 'CREATE',
		description: 'Create user'
	},
	'/admin/users/[id]': {
		module: 'ADMIN_USERS',
		defaultAction: 'VIEW',
		description: 'View user'
	},

	// Billing - Licenses
	'/admin/billing/licenses': {
		module: 'LICENSES',
		defaultAction: 'VIEW',
		description: 'Licenses list'
	},
	'/admin/billing/licenses/new': {
		module: 'LICENSES',
		defaultAction: 'CREATE',
		description: 'Create license'
	},

	// Integrations - Webhook
	'/admin/settings/webhook': {
		module: 'WEBHOOK',
		defaultAction: 'VIEW',
		description: 'Webhooks list'
	},
	'/admin/settings/webhook/new': {
		module: 'WEBHOOK',
		defaultAction: 'CREATE',
		description: 'Create webhook'
	},
	'/admin/settings/webhook/[id]': {
		module: 'WEBHOOK',
		defaultAction: 'VIEW',
		description: 'View webhook'
	},

	// Integrations - WhatsApp
	'/admin/settings/whatsapp/accounts': {
		module: 'WHATSAPP',
		defaultAction: 'VIEW',
		description: 'WhatsApp accounts'
	},

	// Integrations - Listeners
	'/admin/settings/listeners': {
		module: 'LISTENERS',
		defaultAction: 'VIEW',
		description: 'Listeners list'
	},
	'/admin/settings/listeners/new': {
		module: 'LISTENERS',
		defaultAction: 'CREATE',
		description: 'Create listener'
	},
	'/admin/settings/listeners/[id]': {
		module: 'LISTENERS',
		defaultAction: 'VIEW',
		description: 'View listener'
	},

	// Settings - General
	'/admin/settings/general': {
		module: 'GENERAL_SETTINGS',
		defaultAction: 'VIEW',
		description: 'General settings'
	},

	// Settings - Email
	'/admin/settings/email': {
		module: 'EMAIL_SETTINGS',
		defaultAction: 'VIEW',
		description: 'Email settings'
	},

	// Security - Signing Keys
	'/admin/jwt/signing_keys': {
		module: 'SIGNING_KEYS',
		defaultAction: 'VIEW',
		description: 'JWT signing keys'
	},
	'/admin/jwt/signing_keys/new': {
		module: 'SIGNING_KEYS',
		defaultAction: 'CREATE',
		description: 'Create signing key'
	},

	// Security - API Keys
	'/admin/settings/api_keys': {
		module: 'API_KEYS',
		defaultAction: 'VIEW',
		description: 'API keys list'
	},
	'/admin/settings/api_keys/new': {
		module: 'API_KEYS',
		defaultAction: 'CREATE',
		description: 'Create API key'
	},
	'/admin/settings/api_keys/[id]': {
		module: 'API_KEYS',
		defaultAction: 'VIEW',
		description: 'View API key'
	},

	// JWT - Refresh Tokens
	'/admin/jwt/refresh_tokens': {
		module: 'REFRESH_TOKENS',
		defaultAction: 'VIEW',
		description: 'Refresh tokens'
	},

	// JWT - Token Logs
	'/admin/jwt/token_logs': {
		module: 'TOKEN_LOGS',
		defaultAction: 'VIEW',
		description: 'Token logs'
	},

	// Vision - Streams
	'/admin/vision/streams': {
		module: 'STREAMS',
		defaultAction: 'VIEW',
		description: 'Vision streams'
	},
	'/admin/vision/streams/new': {
		module: 'STREAMS',
		defaultAction: 'CREATE',
		description: 'Create stream'
	},

	// Vision - Preview
	'/admin/vision/preview': {
		module: 'PREVIEW',
		defaultAction: 'VIEW',
		description: 'Vision preview'
	},

	// Monitor
	'/admin/monitor': {
		module: 'MONITOR',
		defaultAction: 'VIEW',
		description: 'System monitor'
	},

	// Debug - Messaging
	'/admin/debug/messaging': {
		module: 'DEBUG_MESSAGING',
		defaultAction: 'VIEW',
		description: 'Messaging debug'
	},

	// Debug - Redis
	'/admin/debug/redis': {
		module: 'DEBUG_REDIS',
		defaultAction: 'VIEW',
		description: 'Redis debug'
	}
};

/**
 * Combined route module map
 */
export const ROUTE_MODULE_MAP: Record<string, RouteModuleConfig> = {
	...USER_ROUTE_MODULE_MAP,
	...ADMIN_ROUTE_MODULE_MAP
};

/**
 * Finds the module configuration for a given route path
 * Supports dynamic route segments like [id]
 * 
 * @param path - The route path to lookup
 * @returns The module configuration or undefined if not found
 */
export function getRouteModuleConfig(path: string): RouteModuleConfig | undefined {
	const normalizedPath = normalizeRoute(path);

	// Try exact match first
	if (ROUTE_MODULE_MAP[normalizedPath]) {
		return ROUTE_MODULE_MAP[normalizedPath];
	}

	// Try pattern matching for dynamic routes
	for (const [pattern, config] of Object.entries(ROUTE_MODULE_MAP)) {
		if (matchRoute(normalizedPath, pattern)) {
			return config;
		}
	}

	return undefined;
}

/**
 * Determines the required action for a route based on HTTP method
 * 
 * @param method - HTTP method
 * @param config - Route module configuration
 * @returns The required permission action
 */
export function getActionForMethod(
	method: string,
	config: RouteModuleConfig
): PermissionAction {
	// For page loads (GET), use the default action
	if (method === 'GET') {
		return config.defaultAction;
	}

	// For form submissions, determine action based on the operation
	// This is a default mapping - specific routes may override
	switch (method) {
		case 'POST':
			return 'CREATE';
		case 'PUT':
		case 'PATCH':
			return 'EDIT';
		case 'DELETE':
			return 'DELETE';
		default:
			return config.defaultAction;
	}
}

/**
 * Gets all routes that require a specific module
 */
export function getRoutesForModule(module: string): string[] {
	return Object.entries(ROUTE_MODULE_MAP)
		.filter(([_, config]) => config.module === module)
		.map(([path]) => path);
}

/**
 * Gets all unique modules from the route map
 */
export function getAllModules(): string[] {
	const modules = new Set<string>();
	for (const config of Object.values(ROUTE_MODULE_MAP)) {
		modules.add(config.module);
	}
	return Array.from(modules).sort();
}

