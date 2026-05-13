/**
 * Factory token actions
 * Centralized server-side action logic for factory token routes
 */

import type { AuthenticatedEvent } from '$lib/server/security/guards';

/**
 * Create factory token actions
 * Factory tokens are admin-only, so no ownership checking needed
 * Currently no actions are implemented, but this factory function
 * allows for future action additions (delete, generate, etc.)
 */
export function createFactoryTokenActions() {
    return {
        // Future actions can be added here:
        // delete: async (event: AuthenticatedEvent, tokenId: string) => { ... },
        // generate: async (event: AuthenticatedEvent, data: any) => { ... },
    };
}

