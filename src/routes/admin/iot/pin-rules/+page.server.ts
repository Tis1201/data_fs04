import { redirect } from '@sveltejs/kit';
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

        if (!auth) {
            throw redirect(302, '/admin/iot/pin-rules');
        }
        
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
    deletePinRule: restrict(
        async ({ request, locals, auth }: AuthenticatedEvent) => {
            if (!auth) {
                throw new Error('Unauthorized');
            }
            return createPinRuleActions().deletePinRule({ request, locals, auth });
        },
        [SystemRole.ADMIN]
    )
};
