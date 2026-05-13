import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceProfileDetail } from '$lib/server/device-profiles/deviceProfileLoader';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ params, locals, depends, cookies }: AuthenticatedLoadEvent) => {
        depends('app:deviceProfile');
        
        const { id: profileId } = params;
        if (!profileId) {
            throw error(400, 'Profile ID is required');
        }
        
        try {
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');
            
            return await loadDeviceProfileDetail(locals, profileId, {
                checkOwnership: true, // User can only see profiles from their accounts
                userId,
                accountId
            });
        } catch (err) {
            logger.error(`Error loading device profile details: ${err instanceof Error ? err.message : String(err)}`);
            if (err instanceof Error && 'status' in err) {
                throw err;
            }
            throw error(500, 'Failed to load device profile details');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;
