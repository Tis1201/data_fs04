/**
 * Request Context Tracking
 * 
 * This module provides request ID generation and tracking across the application.
 * Request IDs help with debugging, tracing, and monitoring.
 * 
 * @see docs/local/ROUTES_API_MAPPING.md - Section 10: Implement Request Context Tracking
 */

import { randomBytes } from 'crypto';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Request context information
 */
export interface RequestContext {
	requestId: string;
	userId?: string;
	accountId?: string;
	role?: string;
	startTime: number;
	method: string;
	path: string;
	userAgent?: string;
	ip?: string;
}

/**
 * Generates a unique request ID
 * 
 * Format: timestamp-random (e.g., 1702123456789-a1b2c3d4e5)
 * 
 * @returns Unique request ID string
 */
export function generateRequestId(): string {
	const timestamp = Date.now();
	const random = randomBytes(5).toString('hex');
	return `${timestamp}-${random}`;
}

/**
 * Extracts request ID from headers or generates a new one
 * 
 * @param event - SvelteKit request event
 * @returns Request ID
 */
export function getOrCreateRequestId(event: RequestEvent): string {
	// Check if request ID was provided by client or proxy
	const existingId = event.request.headers.get('X-Request-ID') || 
	                   event.request.headers.get('X-Correlation-ID');
	
	if (existingId) {
		return existingId;
	}
	
	return generateRequestId();
}

/**
 * Creates request context from event
 * 
 * @param event - SvelteKit request event
 * @param requestId - Request ID (optional, will be generated if not provided)
 * @returns Request context object
 */
export function createRequestContext(
	event: RequestEvent,
	requestId?: string
): RequestContext {
	const id = requestId || getOrCreateRequestId(event);
	
	return {
		requestId: id,
		startTime: Date.now(),
		method: event.request.method,
		path: event.url.pathname,
		userAgent: event.request.headers.get('user-agent') || undefined,
		ip: event.getClientAddress()
	};
}

/**
 * Enriches request context with user information
 * 
 * @param context - Existing request context
 * @param userId - User ID
 * @param accountId - Account ID
 * @param role - User role
 * @returns Enriched context
 */
export function enrichRequestContext(
	context: RequestContext,
	userId?: string,
	accountId?: string,
	role?: string
): RequestContext {
	return {
		...context,
		userId,
		accountId,
		role
	};
}

/**
 * Calculates request duration
 * 
 * @param context - Request context
 * @returns Duration in milliseconds
 */
export function getRequestDuration(context: RequestContext): number {
	return Date.now() - context.startTime;
}

/**
 * Formats request context for logging
 * 
 * @param context - Request context
 * @returns Formatted log string
 */
export function formatRequestLog(context: RequestContext): string {
	const duration = getRequestDuration(context);
	const user = context.userId ? `user:${context.userId}` : 'anonymous';
	const account = context.accountId ? `account:${context.accountId}` : '';
	
	return `[${context.requestId}] ${context.method} ${context.path} ${user} ${account} ${duration}ms`;
}

/**
 * Creates a child request ID for nested operations
 * 
 * Useful for tracking sub-operations within a main request
 * 
 * @param parentRequestId - Parent request ID
 * @param operation - Operation name
 * @returns Child request ID
 */
export function createChildRequestId(parentRequestId: string, operation: string): string {
	const random = randomBytes(3).toString('hex');
	return `${parentRequestId}:${operation}-${random}`;
}

/**
 * Request context store for accessing context in nested functions
 * Uses AsyncLocalStorage pattern
 */
class RequestContextStore {
	private contexts = new Map<string, RequestContext>();

	set(requestId: string, context: RequestContext): void {
		this.contexts.set(requestId, context);
	}

	get(requestId: string): RequestContext | undefined {
		return this.contexts.get(requestId);
	}

	delete(requestId: string): void {
		this.contexts.delete(requestId);
	}

	cleanup(olderThan: number = 60000): void {
		const cutoff = Date.now() - olderThan;
		for (const [id, context] of this.contexts.entries()) {
			if (context.startTime < cutoff) {
				this.contexts.delete(id);
			}
		}
	}
}

export const requestContextStore = new RequestContextStore();

// Cleanup old contexts every 5 minutes
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		requestContextStore.cleanup(300000); // 5 minutes
	}, 300000);
}

