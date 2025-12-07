import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadBundleList } from '$lib/server/bundles/bundleLoader';
import { createBundleActions } from '$lib/server/bundles/bundleActions';
import type { AuthenticatedEvent } from '$lib/server/security/guards';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }: AuthenticatedEvent) => {
        try {
            // User routes need ownership checking - only show bundles they own or have access to
            const userId = (locals as any).user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
            return await loadBundleList(locals, url, {
                checkOwnership: true,
                userId,
                accountId
            });
        } catch (e) {
            logger.error(`Error loading bundles: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load bundles');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with user privileges (ownership check enabled)
const bundleActions = createBundleActions({
    checkOwnership: true, // Users can only delete bundles they own
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
        [SystemRole.USER] // Only allow user role to access this action
    )
};
