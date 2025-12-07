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
export const actions = {
    // Actions can be added here if needed (e.g., delete from list page)
};
