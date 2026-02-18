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
    async ({ url, locals, depends, cookies }: AuthenticatedLoadEvent) => {
        depends('app:userDeviceTags');
        
        try {
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');
            
            return await loadDeviceTagList(locals, url, {
                checkOwnership: true, // User can only see tags from their accounts
                userId,
                accountId
            });
        } catch (e) {
            logger.error(`Error loading device tags: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load device tags');
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
const deviceTagActions = createDeviceTagActions({
    checkOwnership: true // Users can only delete device tags they have access to
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
        [SystemRole.USER] // Only allow user role to access this action
    )
};
