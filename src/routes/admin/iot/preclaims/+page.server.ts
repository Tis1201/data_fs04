import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadPreclaimList } from '$lib/server/preclaims/preclaimLoader';
import { createPreclaimActions } from '$lib/server/preclaims/preclaimActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:preclaimSets');
        
        try {
            // Admin routes don't need ownership checking - can see all preclaims
            return await loadPreclaimList(locals, url);
        } catch (e) {
            logger.error(`Error loading preclaims: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load preclaims');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with admin privileges (no ownership check needed)
const preclaimActions = createPreclaimActions({
    checkOwnership: false // Admin can toggle status of any preclaim
});

export const actions: Actions = {
    /**
     * Toggle preclaim set status action
     */
    toggleStatus: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await preclaimActions.toggleStatus({
                request,
                locals
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
