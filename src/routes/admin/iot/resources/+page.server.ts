import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { loadResourceList } from '$lib/server/resources/resourceLoader';
import { createResourceActions } from '$lib/server/resources/resourceActions';
import type { AuthenticatedLoadEvent, AuthenticatedEvent } from '$lib/server/security/guards';

/**
 * Load resource list data
 * Per structural standard: thin wrapper using shared loader
 */
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        // Add depends call for cache invalidation
        depends('app:resources');
        
        return await loadResourceList(locals, url);
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

/**
 * Resource actions
 * Per structural standard: thin wrapper using shared actions factory
 */
export const actions: Actions = {
    update: restrict(
        async (event: AuthenticatedEvent) => {
            const id = event.params.id;
            if (!id) {
                return fail(400, { error: 'Resource ID is required' });
            }
            return createResourceActions().update({ ...event, params: { ...event.params, id } });
        },
        [SystemRole.ADMIN]
    ),
    delete: restrict(
        async (event: AuthenticatedEvent) => {
            const id = event.params.id;
            if (!id) {
                return fail(400, { error: 'Resource ID is required' });
            }
            return createResourceActions().delete({ ...event, params: { ...event.params, id } });
        },
        [SystemRole.ADMIN]
    )
};
