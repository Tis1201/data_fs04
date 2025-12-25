/**
 * Background Job System - Function Registry
 * 
 * Maps job names to handler functions.
 * All handlers are dynamically loaded from the handlers/ directory.
 */

import type { JobHandler, RegisteredJob } from './types';
import { logger } from '$lib/server/logger';

// The registry is a simple map of jobName -> { handler, description }
const registry = new Map<string, RegisteredJob>();

/**
 * Register a job handler.
 * @param name - Unique job name (e.g., "system:cleanup-tokens")
 * @param handler - The async function to execute
 * @param description - Optional description for admin UI
 */
export function registerJob<TData = unknown, TResult = unknown>(
    name: string,
    handler: JobHandler<TData, TResult>,
    description?: string
): void {
    if (registry.has(name)) {
        logger.warn(`[Jobs/Registry] Overwriting existing handler for: ${name}`);
    }
    registry.set(name, { handler: handler as JobHandler, description });
    logger.debug(`[Jobs/Registry] Registered: ${name}`);
}

/**
 * Get a handler by name.
 */
export function getHandler(name: string): JobHandler | undefined {
    return registry.get(name)?.handler;
}

/**
 * Check if a handler is registered.
 */
export function hasHandler(name: string): boolean {
    return registry.has(name);
}

/**
 * List all registered job names (for admin UI / debugging).
 */
export function listRegisteredJobs(): { name: string; description?: string }[] {
    return Array.from(registry.entries()).map(([name, { description }]) => ({
        name,
        description,
    }));
}

// ============================================================
// Register handlers here (or import from handlers/)
// ============================================================

// System jobs
import { cleanupExpiredTokens } from './handlers/cleanup-tokens';
registerJob('system:cleanup-tokens', cleanupExpiredTokens, 'Remove expired refresh tokens and sessions');

// Example job for testing
import { exampleJob } from './handlers/example';
registerJob('test:example', exampleJob, 'Example job for testing the worker');

export { registry };
