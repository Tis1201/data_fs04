import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceList } from '$lib/server/devices/deviceLoader';
import { createDeviceActions } from '$lib/server/devices/deviceActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        // Mark for client-side invalidation
        depends('app:devices');
        
        try {
            // Admin routes don't need ownership checking - can see all devices
            return await loadDeviceList(locals, url, {
                checkOwnership: false,
                includeStats: true,        // Admin gets device statistics
                includeRealTimeStatus: true // Admin gets real-time status
            });
        } catch (e) {
            logger.error(`Error loading devices: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load devices');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with admin privileges (create enabled, no ownership check)
const deviceActions = createDeviceActions({
    checkOwnership: false,  // Admin can delete/toggle any device
    enableCreate: true      // Admin can create devices
});

export const actions: Actions = {
    /**
     * Create device action (Admin only)
     */
    create: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            if (!deviceActions.create) {
                throw error(403, 'Create device action not available');
            }
            return await deviceActions.create({
                request,
                locals
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),

    /**
     * Toggle device status action
     */
    toggleStatus: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await deviceActions.toggleStatus({
                request,
                locals
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),

    /**
     * Delete device action
     */
    delete: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await deviceActions.delete({
                request,
                locals
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
