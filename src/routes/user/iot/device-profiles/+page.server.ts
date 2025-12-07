import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceProfileList } from '$lib/server/device-profiles/deviceProfileLoader';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        // Mark for client-side invalidation
        depends('app:userDeviceProfiles');
        
        try {
            // User routes need ownership checking - only show device profiles from their accounts
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
            return await loadDeviceProfileList(locals, url, {
                checkOwnership: true, // User can only see profiles from their accounts
                userId,
                accountId
            });
        } catch (e) {
            logger.error(`Error loading device profiles: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load device profiles');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;
