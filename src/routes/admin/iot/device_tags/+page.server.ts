import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent, AuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceTagList } from '$lib/server/device-tags/deviceTagLoader';
import { createDeviceTagActions } from '$lib/server/device-tags/deviceTagActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:deviceTags');
        
        try {
            // Admin routes don't need ownership checking - can see all device tags
            return await loadDeviceTagList(locals, url);
        } catch (e) {
            logger.error(`Error loading device tags: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load device tags');
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
const deviceTagActions = createDeviceTagActions({
    checkOwnership: false // Admin can delete any device tag
});

export const actions: Actions = {
    /**
     * Delete device tag action
     */
    delete: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await deviceTagActions.delete({
                request,
                locals
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
