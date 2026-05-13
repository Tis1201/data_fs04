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
        depends('app:deviceProfiles');
        
        try {
            // Admin routes don't need ownership checking - can see all device profiles
            // But still filter to GLOBAL profiles only (not device-level copies)
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            
            return await loadDeviceProfileList(locals, url, {
                checkOwnership: false, // Admin can see all profiles
                userId // Pass userId for account membership filtering (admin sees profiles from their accounts)
            });
        } catch (e) {
            logger.error(`Error loading device profiles: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load device profiles');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;
