/**
 * API Deprecation System
 * 
 * This module provides utilities for marking API endpoints as deprecated
 * and tracking their usage for eventual removal.
 * 
 * @see docs/local/MIGRATION_STATUS.md
 */

import { logger } from '$lib/server/logger';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Deprecation configuration
 */
export interface DeprecationConfig {
	/** Replacement endpoint path */
	replacement: string;
	/** Deprecation date */
	deprecatedSince: string;
	/** Planned removal date (optional) */
	removalDate?: string;
	/** Additional notes */
	notes?: string;
	/** Whether to log warnings (default: true in dev, false in prod) */
	logWarnings?: boolean;
	/** Whether to add deprecation headers (default: true) */
	addHeaders?: boolean;
}

/**
 * Deprecated API endpoints mapping
 * 
 * Maps old endpoint paths to their deprecation configuration
 */
export const deprecatedEndpoints: Record<string, DeprecationConfig> = {
	// Device Profile APIs
	'/api/admin/iot/device-profiles': {
		replacement: '/api/v2/device-profiles',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01',
		notes: 'Use unified v2 endpoint that works for both admin and user roles'
	},
	'/api/user/iot/device-profiles': {
		replacement: '/api/v2/device-profiles',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01',
		notes: 'Use unified v2 endpoint that works for both admin and user roles'
	},

	// Resource APIs
	'/api/admin/resources': {
		replacement: '/api/v2/resources',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},
	'/api/user/resources': {
		replacement: '/api/v2/resources',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},
	'/api/admin/iot/resources': {
		replacement: '/api/v2/resources',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},

	// Bundle APIs
	'/api/admin/bundles': {
		replacement: '/api/v2/bundles',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},
	'/api/user/bundles': {
		replacement: '/api/v2/bundles',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},
	'/api/admin/iot/bundles': {
		replacement: '/api/v2/bundles',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},
	'/api/user/iot/bundles': {
		replacement: '/api/v2/bundles',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},

	// Device APIs (admin/user specific versions deprecated)
	'/api/admin/iot/devices': {
		replacement: '/api/v2/devices',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},
	'/api/user/iot/devices': {
		replacement: '/api/v2/devices',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},

	// Preclaim APIs
	'/api/admin/iot/preclaims': {
		replacement: '/api/v2/preclaims',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	},
	'/api/user/iot/preclaims': {
		replacement: '/api/v2/preclaims',
		deprecatedSince: '2025-12-09',
		removalDate: '2026-03-01'
	}
};

/**
 * Checks if a path is deprecated (supports wildcards)
 * 
 * @param path - Request path
 * @returns Deprecation config if deprecated, null otherwise
 */
export function getDeprecationInfo(path: string): DeprecationConfig | null {
	// Exact match
	if (deprecatedEndpoints[path]) {
		return deprecatedEndpoints[path];
	}

	// Check for wildcard matches (e.g., /api/admin/iot/bundles/*)
	for (const [pattern, config] of Object.entries(deprecatedEndpoints)) {
		if (path.startsWith(pattern + '/') || path === pattern) {
			return config;
		}
	}

	return null;
}

/**
 * Adds deprecation warning to response headers
 * 
 * @param response - Response object
 * @param config - Deprecation configuration
 * @returns Modified response
 */
export function addDeprecationHeaders(
	response: Response,
	config: DeprecationConfig
): Response {
	if (config.addHeaders === false) {
		return response;
	}

	const headers = new Headers(response.headers);
	
	headers.set('X-API-Deprecated', 'true');
	headers.set('X-API-Deprecated-Replacement', config.replacement);
	headers.set('X-API-Deprecated-Since', config.deprecatedSince);
	
	if (config.removalDate) {
		headers.set('X-API-Removal-Date', config.removalDate);
	}
	
	// Standard Deprecation header (RFC 8594)
	const sunsetDate = config.removalDate ? new Date(config.removalDate).toUTCString() : '';
	if (sunsetDate) {
		headers.set('Sunset', sunsetDate);
	}
	
	// Link header pointing to replacement
	headers.set('Link', `<${config.replacement}>; rel="alternate"`);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

/**
 * Logs deprecation warning
 * 
 * @param event - Request event
 * @param config - Deprecation configuration
 */
export function logDeprecationWarning(
	event: RequestEvent,
	config: DeprecationConfig
): void {
	const shouldLog = config.logWarnings !== false &&
	                  (process.env.NODE_ENV === 'development' || 
	                   process.env.LOG_DEPRECATION_WARNINGS === 'true');

	if (!shouldLog) {
		return;
	}

	logger.warn('Deprecated API endpoint accessed', {
		requestId: event.locals.requestId,
		path: event.url.pathname,
		replacement: config.replacement,
		deprecatedSince: config.deprecatedSince,
		removalDate: config.removalDate,
		userAgent: event.request.headers.get('user-agent'),
		referer: event.request.headers.get('referer')
	});
}

/**
 * Middleware function to handle deprecated endpoints
 * 
 * Usage in hooks.server.ts:
 * 
 * @example
 * ```typescript
 * import { handleDeprecatedEndpoint } from '$lib/server/api/deprecation';
 * 
 * export const handle: Handle = async ({ event, resolve }) => {
 *   // ... other middleware ...
 *   
 *   const response = await resolve(event);
 *   
 *   // Add deprecation headers if needed
 *   return handleDeprecatedEndpoint(event, response);
 * };
 * ```
 */
export function handleDeprecatedEndpoint(
	event: RequestEvent,
	response: Response
): Response {
	const deprecationInfo = getDeprecationInfo(event.url.pathname);

	if (!deprecationInfo) {
		return response;
	}

	// Log warning
	logDeprecationWarning(event, deprecationInfo);

	// Add headers
	return addDeprecationHeaders(response, deprecationInfo);
}

/**
 * Helper to check if endpoint is deprecated (for use in endpoint logic)
 * 
 * @param path - Path to check
 * @returns True if deprecated
 */
export function isDeprecated(path: string): boolean {
	return getDeprecationInfo(path) !== null;
}

/**
 * Gets deprecation message for client
 * 
 * @param config - Deprecation configuration
 * @returns Human-readable deprecation message
 */
export function getDeprecationMessage(config: DeprecationConfig): string {
	let message = `This endpoint is deprecated. Please use ${config.replacement} instead.`;
	
	if (config.removalDate) {
		message += ` This endpoint will be removed on ${config.removalDate}.`;
	}
	
	if (config.notes) {
		message += ` ${config.notes}`;
	}
	
	return message;
}

/**
 * Adds deprecation warning to JSON response body
 * Useful for API endpoints that want to include warning in response
 * 
 * @param responseData - Response data object
 * @param config - Deprecation configuration
 * @returns Response data with deprecation warning
 */
export function addDeprecationWarningToBody<T>(
	responseData: T,
	config: DeprecationConfig
): T & { _deprecation?: { message: string; replacement: string; removalDate?: string } } {
	return {
		...responseData,
		_deprecation: {
			message: getDeprecationMessage(config),
			replacement: config.replacement,
			removalDate: config.removalDate
		}
	};
}

/**
 * Tracks deprecated endpoint usage for metrics
 * Stores in memory (could be extended to store in database or metrics service)
 */
class DeprecationTracker {
	private usageCounts = new Map<string, number>();
	private lastUsed = new Map<string, Date>();

	track(path: string): void {
		const count = this.usageCounts.get(path) || 0;
		this.usageCounts.set(path, count + 1);
		this.lastUsed.set(path, new Date());
	}

	getStats(): Array<{ path: string; count: number; lastUsed: Date }> {
		const stats: Array<{ path: string; count: number; lastUsed: Date }> = [];
		
		for (const [path, count] of this.usageCounts.entries()) {
			const lastUsed = this.lastUsed.get(path)!;
			stats.push({ path, count, lastUsed });
		}
		
		return stats.sort((a, b) => b.count - a.count);
	}

	clear(): void {
		this.usageCounts.clear();
		this.lastUsed.clear();
	}
}

export const deprecationTracker = new DeprecationTracker();

/**
 * Gets deprecation statistics
 * Useful for monitoring which deprecated endpoints are still in use
 */
export function getDeprecationStats() {
	return deprecationTracker.getStats();
}

