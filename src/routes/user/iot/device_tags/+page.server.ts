import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceTagList } from '$lib/server/device-tags/deviceTagLoader';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:userDeviceTags');
        
        try {
            // User routes need ownership checking - only show device tags from their accounts
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
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
export const actions = {
    // Actions can be added here if needed (e.g., delete from list page)
};
