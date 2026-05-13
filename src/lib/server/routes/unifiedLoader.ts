/**
 * Unified Route Loader System
 * 
 * This module provides utilities for creating unified route loaders that work
 * for both admin and user roles, eliminating duplicate route files.
 * 
 * @see docs/local/ROUTES_API_MAPPING.md - Phase 3: Consolidate Route Files
 */

import { redirect, error } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';
import { hasPermission, getLoaderOptions, type PermissionUser } from '$lib/server/security/permissions';
import { hasFeature, getUserFeatures, type FeatureUser, type SystemRole } from '$lib/server/features/flags';
import { logger } from '$lib/server/logger';

/**
 * Unified route context for page loads
 */
export interface UnifiedRouteContext {
	/** Authenticated user */
	user: {
		id: string;
		email: string;
		systemRole: SystemRole;
	};
	/** Current account */
	account?: {
		id: string;
		name: string;
		slug: string;
	};
	/** Request ID for tracking */
	requestId: string;
	/** Permission user context */
	permissionUser: PermissionUser;
	/** Feature user context */
	featureUser: FeatureUser;
	/** User's enabled features */
	features: string[];
	/** Base path for navigation (/admin or /user) */
	basePath: string;
	/** Whether user is admin */
	isAdmin: boolean;
	/** Loader options (for shared loaders) */
	loaderOptions: ReturnType<typeof getLoaderOptions>;
}

/**
 * Options for unified route loader
 */
export interface UnifiedLoaderOptions {
	/** Required permission to access this route */
	permission?: string;
	/** Required feature flag to access this route */
	feature?: string;
	/** Allowed roles (if not specified, USER and ADMIN are allowed) */
	roles?: SystemRole[];
	/** Redirect path if permission denied (default: login page) */
	redirectOnDenied?: string;
}

/**
 * Creates a unified route context from load event
 * 
 * @param event - SvelteKit load event
 * @param options - Loader options
 * @returns Unified route context
 * @throws Redirect if not authenticated or lacks permission
 */
export async function createUnifiedRouteContext(
	event: ServerLoadEvent,
	options: UnifiedLoaderOptions = {}
): Promise<UnifiedRouteContext> {
	const { locals, url } = event;
	const requestId = locals.requestId;

	// Validate authentication
	const session = await locals.auth.validate();
	
	if (!session) {
		logger.warn('Unauthenticated access attempt', {
			requestId,
			path: url.pathname
		});
		throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	const systemRole = session.user.systemRole as SystemRole;

	// Check allowed roles
	if (options.roles && !options.roles.includes(systemRole)) {
		logger.warn('Role not allowed for route', {
			requestId,
			userRole: systemRole,
			allowedRoles: options.roles,
			path: url.pathname
		});
		throw redirect(302, options.redirectOnDenied || '/');
	}

	// Create permission user context
	const permissionUser: PermissionUser = {
		id: session.user.id,
		role: systemRole,
		accountId: locals.currentAccount?.account?.id
	};

	// Create feature user context
	const featureUser: FeatureUser = {
		id: session.user.id,
		role: systemRole,
		accountId: locals.currentAccount?.account?.id
	};

	// Check required permission
	if (options.permission) {
		const hasAccess = await hasPermission(permissionUser, options.permission);
		if (!hasAccess) {
			logger.warn('Permission denied for route', {
				requestId,
				userId: session.user.id,
				permission: options.permission,
				path: url.pathname
			});
			throw error(403, 'You do not have permission to access this page');
		}
	}

	// Check required feature
	if (options.feature && !hasFeature(featureUser, options.feature)) {
		logger.warn('Feature not available for route', {
			requestId,
			userId: session.user.id,
			feature: options.feature,
			path: url.pathname
		});
		throw error(403, 'This feature is not available for your account');
	}

	// Determine base path from URL
	const basePath = url.pathname.startsWith('/admin') ? '/admin' : '/user';
	const isAdmin = systemRole === 'ADMIN';

	// Get enabled features for user
	const features = getUserFeatures(featureUser);

	// Get loader options
	const loaderOptions = getLoaderOptions(permissionUser);

	return {
		user: {
			id: session.user.id,
			email: session.user.email,
			systemRole
		},
		account: locals.currentAccount?.account,
		requestId,
		permissionUser,
		featureUser,
		features,
		basePath,
		isAdmin,
		loaderOptions
	};
}

/**
 * Wraps a route loader with unified context creation
 * 
 * @param loader - Route loader function
 * @param options - Loader options
 * @returns Wrapped load function
 * 
 * @example
 * ```typescript
 * export const load = unifiedLoader(
 *   async ({ context, params }) => {
 *     const device = await loadDeviceDetail(params.id, context.loaderOptions);
 *     return { device };
 *   },
 *   { permission: 'device.view' }
 * );
 * ```
 */
export function unifiedLoader<T = any>(
	loader: (params: {
		context: UnifiedRouteContext;
		event: ServerLoadEvent;
		params: Record<string, string>;
	}) => Promise<T>,
	options: UnifiedLoaderOptions = {}
) {
	return async (event: ServerLoadEvent): Promise<T> => {
		// Create unified context
		const context = await createUnifiedRouteContext(event, options);

		// Log route access
		logger.info('Route accessed', {
			requestId: context.requestId,
			userId: context.user.id,
			role: context.user.systemRole,
			path: event.url.pathname
		});

		// Call loader
		const result = await loader({
			context,
			event,
			params: event.params
		});

		return result;
	};
}

/**
 * Helper to get API base path based on context
 * 
 * @param context - Unified route context
 * @returns API base path (/api/admin or /api/user or /api/v2)
 */
export function getApiBasePath(context: UnifiedRouteContext, useV2 = true): string {
	if (useV2) {
		return '/api/v2';
	}
	return context.isAdmin ? '/api/admin' : '/api/user';
}

/**
 * Helper to get route base path for navigation
 * 
 * @param context - Unified route context
 * @returns Base path for navigation
 */
export function getRouteBasePath(context: UnifiedRouteContext): string {
	return context.basePath;
}

/**
 * Helper to construct full route path
 * 
 * @param context - Unified route context
 * @param relativePath - Relative path (e.g., '/iot/devices/123')
 * @returns Full path
 */
export function constructRoutePath(context: UnifiedRouteContext, relativePath: string): string {
	const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
	return `${context.basePath}${cleanPath}`;
}

/**
 * Checks if route should show admin features
 * 
 * @param context - Unified route context
 * @returns True if admin features should be shown
 */
export function shouldShowAdminFeatures(context: UnifiedRouteContext): boolean {
	return context.isAdmin;
}

/**
 * Gets UI configuration based on context
 * 
 * @param context - Unified route context
 * @returns UI configuration object
 */
export function getUIConfig(context: UnifiedRouteContext) {
	return {
		showAccountInfo: hasFeature(context.featureUser, 'ui.includeAccountInfo'),
		showAdvancedFilters: hasFeature(context.featureUser, 'ui.advancedFilters'),
		showExportButton: hasFeature(context.featureUser, 'ui.exportData'),
		showSimulator: hasFeature(context.featureUser, 'device.simulator'),
		showDebugPanel: hasFeature(context.featureUser, 'system.debugPanel'),
		verboseLogging: hasFeature(context.featureUser, 'device.verboseLogging')
	};
}

/**
 * Type guard to check if user can manage resource
 * 
 * @param context - Unified route context
 * @param resource - Resource with optional accountId
 * @returns True if user can manage (edit/delete)
 */
export function canManageResource(
	context: UnifiedRouteContext,
	resource?: { accountId?: string; createdBy?: string }
): boolean {
	if (!resource) return false;
	
	// Admin can manage all
	if (context.isAdmin) return true;
	
	// User can manage if same account
	if (context.account && resource.accountId === context.account.id) {
		return true;
	}
	
	return false;
}

/**
 * Type guard to check if user owns resource
 * 
 * @param context - Unified route context
 * @param resource - Resource with createdBy
 * @returns True if user created the resource
 */
export function isResourceOwner(
	context: UnifiedRouteContext,
	resource?: { createdBy?: string }
): boolean {
	if (!resource || !resource.createdBy) return false;
	return resource.createdBy === context.user.id;
}

/**
 * Helper for role-based data filtering
 * Creates Prisma where clause based on user context
 * 
 * @param context - Unified route context
 * @param additionalWhere - Additional where conditions
 * @returns Prisma where clause
 */
export function createWhereClause(
	context: UnifiedRouteContext,
	additionalWhere: Record<string, any> = {}
) {
	// Admin sees all
	if (context.isAdmin) {
		return additionalWhere;
	}
	
	// User sees only their account's resources
	return {
		accountId: context.account?.id,
		...additionalWhere
	};
}

/**
 * Helper to create breadcrumb navigation
 * 
 * @param context - Unified route context
 * @param path - Current path segments
 * @returns Breadcrumb array
 */
export function createBreadcrumbs(
	context: UnifiedRouteContext,
	...segments: Array<{ label: string; href?: string }>
) {
	const baseBreadcrumb = {
		label: context.isAdmin ? 'Admin' : 'Dashboard',
		href: context.basePath
	};
	
	return [baseBreadcrumb, ...segments];
}

/**
 * Validates that required fields exist in context
 * Useful for pages that require an account
 * 
 * @param context - Unified route context
 * @param requirements - What to validate
 * @throws Error if requirements not met
 */
export function validateContext(
	context: UnifiedRouteContext,
	requirements: {
		requireAccount?: boolean;
	} = {}
): void {
	if (requirements.requireAccount && !context.account) {
		throw error(400, 'No active account selected. Please select an account first.');
	}
}

