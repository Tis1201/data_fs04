import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadBundleList } from '$lib/server/bundles/bundleLoader';
import { createBundleActions } from '$lib/server/bundles/bundleActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }: AuthenticatedEvent) => {
        try {
            // Admin routes don't need ownership checking - can see all bundles
            return await loadBundleList(locals, url);
        } catch (e) {
            logger.error(`Error loading bundles: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load bundles');
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
const bundleActions = createBundleActions({
    checkOwnership: false, // Admin can delete any bundle
    enableAdvancedFeatures: false // List page doesn't need advanced features
});

export const actions: Actions = {
    /**
     * Delete bundle action
     */
    delete: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await bundleActions.delete({
                request,
                locals
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
