import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { loadDeviceTagDetail } from '$lib/server/device-tags/deviceTagLoader';
import { createDeviceTagActions } from '$lib/server/device-tags/deviceTagActions';
import { deviceTagSchema } from '../new/device-tag';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ params, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:deviceTag');
        
        const { id } = params;
        if (!id) {
            throw error(400, 'Device tag ID is required');
        }

        try {
            // Admin routes don't need ownership checking - can see all device tags
            return await loadDeviceTagDetail(
                locals,
                id,
                deviceTagSchema,
                {
                    checkOwnership: false // Admin doesn't need ownership check
                }
            );
        } catch (err) {
            logger.error(`Error loading device tag ${id}: ${err instanceof Error ? err.message : String(err)}`);
            if (err && typeof err === 'object' && 'status' in err) {
                throw err; // Re-throw SvelteKit errors
            }
            throw error(500, 'Failed to load device tag');
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
    checkOwnership: false // Admin can update any device tag
});

export const actions: Actions = {
    /**
     * Update device tag action
     */
    updateTag: restrict(
        async ({ params, request, locals }: AuthenticatedEvent) => {
            const { id } = params;
            if (!id) {
                throw error(400, 'Device tag ID is required');
            }
            return await deviceTagActions.update({
                params: { id },
                request,
                locals
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
