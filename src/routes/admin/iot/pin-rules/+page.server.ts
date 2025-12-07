import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { loadPinRuleList } from '$lib/server/pin-rules/pinRuleLoader';
import { createPinRuleActions } from '$lib/server/pin-rules/pinRuleActions';
import type { AuthenticatedLoadEvent, AuthenticatedEvent } from '$lib/server/security/guards';

/**
 * Load pin rule list data
 * Per structural standard: thin wrapper using shared loader
 */
export const load = restrict(
    async ({ url, locals, depends, auth }: AuthenticatedLoadEvent) => {
        // Add depends call for cache invalidation
        depends('app:pin-rules');
        
        const result = await loadPinRuleList(locals, url);
        
        return {
            user: auth.user,
            ...result
        };
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

/**
 * Pin rule actions
 * Per structural standard: thin wrapper using shared actions factory
 */
export const actions: Actions = {
    ...createPinRuleActions()
};
