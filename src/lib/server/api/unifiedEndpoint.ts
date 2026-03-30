/**
 * Unified API Endpoint Helpers
 * 
 * This module provides utilities for creating unified API endpoints that work
 * for both admin and user roles, eliminating the need for duplicate endpoints.
 * 
 * @see docs/local/ROUTES_API_MAPPING.md - Section 1: Unify API Endpoints
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { ResourceShareScope } from '@prisma/client';
import { successResponse, errorResponse, ErrorCodes, paginatedResponse } from '$lib/types/api';
import { hasPermission, requirePermission, type PermissionUser } from '$lib/server/security/permissions';
import { hasFeature, getLoaderOptionsWithFeatures, type FeatureUser, type SystemRole } from '$lib/server/features/flags';
import { logger } from '$lib/server/logger';

export type ResourceAccessLevel = 'admin' | 'owner' | 'shared_read';

export type ResourceAccessInput = {
	accountId?: string;
	createdBy?: string;
	shareScope?: ResourceShareScope;
	sharedWithAccountIds?: string[];
};

export function normalizeResourceAccessInput(resource: Record<string, unknown> | null | undefined): ResourceAccessInput {
	if (!resource) {
		return {};
	}
	const shared = resource.sharedWithAccounts as { accountId: string }[] | undefined;
	const fromRelation = Array.isArray(shared) ? shared.map((s) => s.accountId) : undefined;
	const fromField = resource.sharedWithAccountIds as string[] | undefined;
	const sharedWithAccountIds =
		fromRelation?.length
			? fromRelation
			: Array.isArray(fromField) && fromField.length
				? fromField
				: undefined;

	return {
		accountId: (resource.accountId as string) ?? undefined,
		createdBy: resource.createdBy as string | undefined,
		shareScope: resource.shareScope as ResourceShareScope | undefined,
		sharedWithAccountIds
	};
}

export function resourceVisibilityOrForAccount(accountId: string) {
	return [
		{ accountId },
		{ shareScope: ResourceShareScope.ALL_ACCOUNTS },
		{
			shareScope: ResourceShareScope.SELECTED_ACCOUNTS,
			sharedWithAccounts: { some: { accountId } }
		}
	];
}

/** Excludes PUBLIC_DEVELOPER catalog rows from account library / bundle pickers. */
export const whereNotPublicDeveloperCatalog = {
	NOT: { shareScope: ResourceShareScope.PUBLIC_DEVELOPER }
} as const;

export function resourceVisibilityOrForAccountIds(accountIds: string[]) {
	if (accountIds.length === 0) {
		return [{ id: { in: [] as string[] } }];
	}
	return [
		{ accountId: { in: accountIds } },
		{ shareScope: ResourceShareScope.ALL_ACCOUNTS },
		{
			shareScope: ResourceShareScope.SELECTED_ACCOUNTS,
			sharedWithAccounts: { some: { accountId: { in: accountIds } } }
		}
	];
}

/**
 * Unified endpoint context
 */
export interface UnifiedContext {
	/** Authenticated session */
	session: {
		user: {
			id: string;
			email: string;
			systemRole: SystemRole;
		};
	};
	/** Current account */
	account?: {
		id: string;
		name: string;
	};
	/** Request ID for tracking */
	requestId: string;
	/** Permission user context */
	permissionUser: PermissionUser;
	/** Feature user context */
	featureUser: FeatureUser;
	/** Event locals */
	locals: App.Locals;
	/** Prisma client with RLS */
	prisma: any;
	/** Client IP address */
	ipAddress: string;
	/** Request object */
	request: Request;
	/** Is user an admin */
	isAdmin: boolean;
	/** Account ID (optional) */
	accountId?: string;
}

/**
 * Options for unified endpoint behavior
 */
export interface UnifiedOptions {
	/** Required permission to access this endpoint */
	permission?: string;
	/** If true, bypass permission check (for legacy/compatibility) */
	skipPermission?: boolean;
	/** Required feature flag to access this endpoint */
	feature?: string;
	/** Allow guests (no authentication required) */
	allowGuests?: boolean;
}

/**
 * Creates a unified context from request event
 * 
 * @param event - SvelteKit request event
 * @param options - Unified options
 * @returns Unified context
 * @throws Error if authentication required but not present
 */
export async function createUnifiedContext(
	event: RequestEvent,
	options: UnifiedOptions = {}
): Promise<UnifiedContext> {
	const { locals } = event;
	const requestId = locals.requestId;

	// Validate authentication
	const session = await locals.auth.validate();
	
	if (!session && !options.allowGuests) {
		throw Object.assign(
			new Error('Authentication required'),
			{ status: 401, code: ErrorCodes.UNAUTHORIZED }
		);
	}

	if (!session) {
		throw Object.assign(
			new Error('Session required'),
			{ status: 401, code: ErrorCodes.UNAUTHORIZED }
		);
	}

	// Create permission user context
	const permissionUser: PermissionUser = {
		id: session.user.id,
		role: session.user.systemRole as SystemRole,
		accountId: locals.currentAccount?.account?.id
	};

	// Create feature user context
	const featureUser: FeatureUser = {
		id: session.user.id,
		role: session.user.systemRole as SystemRole,
		accountId: locals.currentAccount?.account?.id
	};

	// Check required permission
	if (options.permission && !options.skipPermission) {
		await requirePermission(permissionUser, options.permission);
	}

	// Check required feature
	if (options.feature && !hasFeature(featureUser, options.feature)) {
		throw Object.assign(
			new Error(`Feature not available: ${options.feature}`),
			{ status: 403, code: 'FEATURE_NOT_AVAILABLE' }
		);
	}

	// Extract commonly used properties for convenience
	const isAdmin = session.user.systemRole === 'ADMIN';
	const accountId = locals.currentAccount?.account?.id;
	const ipAddress = (locals as any).ipAddress || event.getClientAddress();

	return {
		session: {
			user: {
				id: session.user.id,
				email: session.user.email,
				systemRole: session.user.systemRole as SystemRole
			}
		},
		account: locals.currentAccount?.account ? {
			id: locals.currentAccount.account.id,
			name: locals.currentAccount.account.name
		} : undefined,
		requestId,
		permissionUser,
		featureUser,
		locals,
		prisma: locals.prisma,
		ipAddress,
		request: event.request,
		isAdmin,
		accountId
	};
}

/**
 * Handles unified endpoint errors consistently
 * 
 * @param error - Error object
 * @param requestId - Request ID
 * @param operation - Operation name for logging
 * @returns JSON error response
 */
export function handleUnifiedError(error: any, requestId: string, operation?: string) {
	const errMsg = error?.message ?? String(error);
	logger.error(`Unified endpoint error${operation ? `: ${operation}` : ''}: ${errMsg}`, {
		requestId,
		error: errMsg,
		code: error?.code,
		stack: error?.stack
	});

	// Handle specific error types
	if (error.status === 401 || error.code === ErrorCodes.UNAUTHORIZED) {
		return json(
			errorResponse('Authentication required', ErrorCodes.UNAUTHORIZED),
			{ status: 401 }
		);
	}

	if (error.status === 403 || error.code === ErrorCodes.FORBIDDEN || error.code === 'INSUFFICIENT_PERMISSIONS') {
		return json(
			errorResponse(error.message || 'Permission denied', ErrorCodes.FORBIDDEN),
			{ status: 403 }
		);
	}

	if (error.status === 404 || error.code === ErrorCodes.NOT_FOUND) {
		return json(
			errorResponse(error.message || 'Resource not found', ErrorCodes.NOT_FOUND),
			{ status: 404 }
		);
	}

	if (error.status === 409 || error.code === ErrorCodes.CONFLICT) {
		return json(
			errorResponse(error.message || 'A resource with this value already exists', ErrorCodes.CONFLICT),
			{ status: 409 }
		);
	}

	if (error.status === 400 || error.code === ErrorCodes.VALIDATION_ERROR || error.code === ErrorCodes.INVALID_INPUT) {
		return json(
			errorResponse(error.message || 'Invalid request', error.code || ErrorCodes.VALIDATION_ERROR),
			{ status: 400 }
		);
	}

	if (error.code === 'FEATURE_NOT_AVAILABLE') {
		return json(
			errorResponse(error.message, ErrorCodes.FORBIDDEN),
			{ status: 403 }
		);
	}

	// Default internal error
	return json(
		errorResponse(
			'An error occurred processing your request',
			ErrorCodes.INTERNAL_ERROR,
			process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
		),
		{ status: 500 }
	);
}

/**
 * Wraps an endpoint handler with unified context creation and error handling
 * 
 * @param handler - Endpoint handler function
 * @param options - Unified options
 * @returns Wrapped request handler
 * 
 * @example
 * ```typescript
 * export const GET = unifiedEndpoint(
 *   async ({ context, params }) => {
 *     const device = await getDevice(params.id);
 *     return successResponse(device);
 *   },
 *   { permission: 'device.view' }
 * );
 * ```
 */
export function unifiedEndpoint<T = any>(
	handler: (params: {
		context: UnifiedContext;
		event: RequestEvent;
		params: Record<string, string>;
	}) => Promise<T>,
	options: UnifiedOptions = {}
) {
	return async (event: RequestEvent) => {
		try {
			// Create unified context
			const context = await createUnifiedContext(event, options);

			// Call handler
			const result = await handler({
				context,
				event,
				params: event.params
			});

			// Return result (handler should return ApiResponse or data)
			// Pass through Response objects (e.g. streaming proxy responses)
			if (result instanceof Response) return result;
			return json(result);

		} catch (error: any) {
			return handleUnifiedError(error, event.locals.requestId, handler.name);
		}
	};
}

/**
 * Checks if user can read/use a catalog Resource (ownership or admin share rules).
 */
export function canAccessResource(
	context: UnifiedContext,
	resource: ResourceAccessInput | Record<string, unknown> | null | undefined
): boolean {
	const input =
		resource && typeof resource === 'object' && 'shareScope' in resource
			? normalizeResourceAccessInput(resource as Record<string, unknown>)
			: (resource as ResourceAccessInput) || {};

	// Admin can access all
	if (context.session.user.systemRole === 'ADMIN') {
		return true;
	}

	const aid = context.account?.id;

	// Owning account
	if (aid && input.accountId === aid) {
		return true;
	}

	// Shared to all accounts (requires active account context)
	if (aid && input.shareScope === ResourceShareScope.ALL_ACCOUNTS) {
		return true;
	}

	// Shared to selected accounts
	if (
		aid &&
		input.shareScope === ResourceShareScope.SELECTED_ACCOUNTS &&
		input.sharedWithAccountIds?.includes(aid)
	) {
		return true;
	}

	// Legacy: no active account — only the uploader
	if (!aid && input.createdBy === context.session.user.id) {
		return true;
	}

	return false;
}

export function getResourceAccessLevel(
	context: UnifiedContext,
	resource: ResourceAccessInput | Record<string, unknown>
): ResourceAccessLevel {
	const input =
		typeof resource === 'object' && resource !== null && 'shareScope' in resource
			? normalizeResourceAccessInput(resource as Record<string, unknown>)
			: (resource as ResourceAccessInput);

	if (context.session.user.systemRole === 'ADMIN') {
		return 'admin';
	}

	const aid = context.account?.id;
	if (aid && input.accountId === aid) {
		return 'owner';
	}

	if (!aid && input.createdBy === context.session.user.id) {
		return 'owner';
	}

	return 'shared_read';
}

export function requireResourceMutationAccess(
	context: UnifiedContext,
	resource: ResourceAccessInput | Record<string, unknown> | null
): void {
	if (!resource) {
		throw Object.assign(
			new Error('Resource not found'),
			{ status: 404, code: ErrorCodes.NOT_FOUND }
		);
	}

	const level = getResourceAccessLevel(context, resource);
	if (level === 'shared_read') {
		throw Object.assign(
			new Error('You cannot modify resources shared to your account'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}
}

export function canAccessResourceFields(
	params: { systemRole: SystemRole; userId: string; accountId?: string },
	resource: ResourceAccessInput
): boolean {
	const ctx = {
		session: {
			user: {
				id: params.userId,
				email: '',
				systemRole: params.systemRole
			}
		},
		account: params.accountId ? { id: params.accountId, name: '' } : undefined
	} as UnifiedContext;
	return canAccessResource(ctx, resource);
}

export function getResourceAccessLevelFields(
	params: { systemRole: SystemRole; userId: string; accountId?: string },
	resource: ResourceAccessInput
): ResourceAccessLevel | null {
	if (!canAccessResourceFields(params, resource)) {
		return null;
	}
	const ctx = {
		session: {
			user: {
				id: params.userId,
				email: '',
				systemRole: params.systemRole
			}
		},
		account: params.accountId ? { id: params.accountId, name: '' } : undefined
	} as UnifiedContext;
	return getResourceAccessLevel(ctx, resource);
}

/**
 * Requires user to have access to resource, throws if not
 *
 * @param context - Unified context
 * @param resource - Resource row or normalized access input
 * @throws Error with 403 status if access denied
 */
export function requireResourceAccess(
	context: UnifiedContext,
	resource: ResourceAccessInput | Record<string, unknown> | null
): void {
	if (!resource) {
		throw Object.assign(
			new Error('Resource not found'),
			{ status: 404, code: ErrorCodes.NOT_FOUND }
		);
	}

	if (!canAccessResource(context, resource)) {
		throw Object.assign(
			new Error('Access denied to this resource'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}
}

/**
 * Gets query options based on user context
 * Automatically applies ownership filters for non-admin users
 * 
 * @param context - Unified context
 * @returns Query options
 */
export function getQueryOptions(context: UnifiedContext) {
	const isAdmin = context.session.user.systemRole === 'ADMIN';

	return {
		// Only filter by account if not admin
		where: isAdmin ? {} : {
			accountId: context.account?.id
		},
		// Include additional data based on features
		include: {
			account: hasFeature(context.featureUser, 'ui.includeAccountInfo')
		}
	};
}

/**
 * Gets loader options from unified context
 * 
 * @param context - Unified context
 * @returns Loader options with features applied
 */
export function getLoaderOptions(context: UnifiedContext) {
	return getLoaderOptionsWithFeatures(context.featureUser);
}

/**
 * Helper for paginated list endpoints
 * 
 * @param context - Unified context
 * @param event - Request event
 * @param fetcher - Function to fetch items
 * @param counter - Function to count total items
 * @returns Paginated response
 */
export async function handlePaginatedList<T>(
	context: UnifiedContext,
	event: RequestEvent,
	fetcher: (options: any) => Promise<T[]>,
	counter: (options: any) => Promise<number>
) {
	const url = event.url;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = Math.min(
		parseInt(url.searchParams.get('pageSize') || '20'),
		100 // Max page size
	);

	const queryOptions = getQueryOptions(context);
	const skip = (page - 1) * pageSize;

	const [items, total] = await Promise.all([
		fetcher({ ...queryOptions, skip, take: pageSize }),
		counter(queryOptions)
	]);

	return paginatedResponse(items, total, page, pageSize, {
		requestId: context.requestId
	});
}

/**
 * Creates a CRUD handler set for a resource type
 * 
 * @param config - CRUD configuration
 * @returns Object with GET, POST, PUT, DELETE handlers
 * 
 * @example
 * ```typescript
 * export const { GET, POST, PUT, DELETE } = createCrudHandlers({
 *   resourceName: 'device',
 *   permissions: {
 *     read: 'device.view',
 *     create: 'device.edit',
 *     update: 'device.edit',
 *     delete: 'device.delete'
 *   },
 *   handlers: {
 *     get: async (id, context) => await prisma.device.findUnique({ where: { id } }),
 *     create: async (data, context) => await prisma.device.create({ data }),
 *     update: async (id, data, context) => await prisma.device.update({ where: { id }, data }),
 *     delete: async (id, context) => await prisma.device.delete({ where: { id } })
 *   }
 * });
 * ```
 */
export function createCrudHandlers<T>(config: {
	resourceName: string;
	permissions: {
		read: string;
		create: string;
		update: string;
		delete: string;
	};
	handlers: {
		get: (id: string, context: UnifiedContext) => Promise<T | null>;
		create: (data: any, context: UnifiedContext) => Promise<T>;
		update: (id: string, data: any, context: UnifiedContext) => Promise<T>;
		delete: (id: string, context: UnifiedContext) => Promise<void>;
	};
	mapGetResponse?: (resource: T, context: UnifiedContext) => unknown;
}) {
	return {
		GET: unifiedEndpoint(
			async ({ context, params }) => {
				const resource = await config.handlers.get(params.id, context);
				
				if (!resource) {
					throw Object.assign(
						new Error(`${config.resourceName} not found`),
						{ status: 404, code: ErrorCodes.NOT_FOUND }
					);
				}

				requireResourceAccess(context, resource as any);

				const payload = config.mapGetResponse
					? config.mapGetResponse(resource, context)
					: resource;

				return successResponse(payload, { requestId: context.requestId });
			},
			{ permission: config.permissions.read }
		),

		POST: unifiedEndpoint(
			async ({ context, event }) => {
				const data = await event.request.json();
				const resource = await config.handlers.create(data, context);

				return successResponse(resource, { requestId: context.requestId });
			},
			{ permission: config.permissions.create }
		),

		PUT: unifiedEndpoint(
			async ({ context, event, params }) => {
				const existing = await config.handlers.get(params.id, context);
				requireResourceAccess(context, existing as any);
				requireResourceMutationAccess(context, existing as any);

				const data = await event.request.json();
				const resource = await config.handlers.update(params.id, data, context);

				return successResponse(resource, { requestId: context.requestId });
			},
			{ permission: config.permissions.update }
		),

		DELETE: unifiedEndpoint(
			async ({ context, params }) => {
				const existing = await config.handlers.get(params.id, context);
				requireResourceAccess(context, existing as any);
				requireResourceMutationAccess(context, existing as any);

				await config.handlers.delete(params.id, context);

				return successResponse({ deleted: true }, { requestId: context.requestId });
			},
			{ permission: config.permissions.delete }
		)
	};
}

